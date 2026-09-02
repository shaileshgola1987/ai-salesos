import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Product, QuotationStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../whatsapp/conversations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QueryQuotationsDto } from './dto/query-quotations.dto';
import { QuotationItemInputDto } from './dto/quotation-item-input.dto';

const PUBLIC_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const NUMBER_ALLOCATION_ATTEMPTS = 3;

interface QuotationLine {
  productId?: string;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  taxRatePercent: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  sortOrder: number;
}

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly conversations: ConversationsService,
  ) {}

  private readonly include = {
    lead: { select: { id: true, name: true, companyName: true, phone: true, email: true } },
    customer: { select: { id: true, name: true, companyName: true, phone: true, email: true } },
    createdBy: { select: { id: true, name: true } },
    items: { orderBy: { sortOrder: 'asc' as const } },
  } satisfies Prisma.QuotationInclude;

  list(organizationId: string, query: QueryQuotationsDto) {
    const where: Prisma.QuotationWhereInput = {
      organizationId,
      ...(query.status && { status: query.status }),
      ...(query.leadId && { leadId: query.leadId }),
      ...(query.customerId && { customerId: query.customerId }),
    };
    return this.prisma.quotation.findMany({
      where,
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(organizationId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, organizationId },
      include: this.include,
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  getOrganizationBasics(organizationId: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true, gstin: true },
    });
  }

  /** For the unauthenticated, signature-verified PDF link (see verifyPublicLink) — not org-scoped. */
  async getForPublicPdf(id: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id },
      include: { ...this.include, organization: { select: { name: true, gstin: true } } },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async create(organizationId: string, creatorId: string, dto: CreateQuotationDto) {
    if (dto.leadId) await this.assertLeadInOrg(organizationId, dto.leadId);
    if (dto.customerId) await this.assertCustomerInOrg(organizationId, dto.customerId);

    const lines = await this.buildLines(organizationId, dto.items);
    const totals = this.computeTotals(lines);

    for (let attempt = 0; attempt < NUMBER_ALLOCATION_ATTEMPTS; attempt++) {
      const number = await this.nextNumber(organizationId);
      try {
        const quotation = await this.prisma.quotation.create({
          data: {
            organizationId,
            number,
            leadId: dto.leadId,
            customerId: dto.customerId,
            createdById: creatorId,
            validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
            notes: dto.notes,
            ...totals,
            items: { create: lines },
          },
          include: this.include,
        });
        return quotation;
      } catch (err) {
        const isNumberCollision =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        if (!isNumberCollision || attempt === NUMBER_ALLOCATION_ATTEMPTS - 1) throw err;
      }
    }
    throw new ConflictException('Failed to allocate a quotation number, please retry');
  }

  async update(organizationId: string, id: string, dto: UpdateQuotationDto) {
    const quotation = await this.getOne(organizationId, id);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('Only draft quotations can be edited');
    }
    if (dto.leadId) await this.assertLeadInOrg(organizationId, dto.leadId);
    if (dto.customerId) await this.assertCustomerInOrg(organizationId, dto.customerId);

    const data: Prisma.QuotationUpdateInput = {
      notes: dto.notes,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    };
    if (dto.leadId !== undefined) {
      data.lead = dto.leadId ? { connect: { id: dto.leadId } } : { disconnect: true };
    }
    if (dto.customerId !== undefined) {
      data.customer = dto.customerId ? { connect: { id: dto.customerId } } : { disconnect: true };
    }

    if (dto.items) {
      const lines = await this.buildLines(organizationId, dto.items);
      const totals = this.computeTotals(lines);
      await this.prisma.quotationItem.deleteMany({ where: { quotationId: id } });
      Object.assign(data, totals, { items: { create: lines } });
    }

    return this.prisma.quotation.update({ where: { id }, data, include: this.include });
  }

  async updateStatus(organizationId: string, id: string, status: QuotationStatus) {
    await this.getOne(organizationId, id);
    return this.prisma.quotation.update({
      where: { id },
      data: { status, ...(status === QuotationStatus.SENT && { sentAt: new Date() }) },
      include: this.include,
    });
  }

  async remove(organizationId: string, id: string) {
    const quotation = await this.getOne(organizationId, id);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('Only draft quotations can be deleted');
    }
    await this.prisma.quotation.delete({ where: { id } });
  }

  /** Shares the quotation PDF over WhatsApp (subject to the 24h session window — see
   * ConversationsService.sendMessage) and marks it SENT on first send. */
  async sendViaWhatsApp(
    organizationId: string,
    id: string,
    requestingUserId: string,
    overridePhone?: string,
  ) {
    const quotation = await this.getOne(organizationId, id);
    const phone = overridePhone ?? quotation.lead?.phone ?? quotation.customer?.phone;
    if (!phone) {
      throw new BadRequestException(
        'This quotation has no linked lead/customer — link one or pass a phone explicitly',
      );
    }

    const conversation = await this.conversations.findOrCreateByPhone(
      organizationId,
      phone,
      quotation.leadId ?? undefined,
    );
    await this.conversations.sendMessage(organizationId, conversation.id, requestingUserId, {
      body: `Quotation ${quotation.number}`,
      mediaUrl: this.buildPublicPdfUrl(id),
      mediaType: 'DOCUMENT',
    });

    if (quotation.status === QuotationStatus.DRAFT) {
      await this.prisma.quotation.update({
        where: { id },
        data: { status: QuotationStatus.SENT, sentAt: new Date() },
      });
    }

    return this.getOne(organizationId, id);
  }

  /** A signed, time-limited link Meta (or any recipient) can fetch the PDF from without a
   * session — WhatsApp Cloud API needs a link-based media send, so this can't require our
   * normal JWT auth. See WebhookController-adjacent MediaController for the analogous pattern. */
  buildPublicPdfUrl(quotationId: string): string {
    const baseUrl = this.config.get<string>('PUBLIC_API_URL', 'http://localhost:4000/api');
    const expiresAt = Date.now() + PUBLIC_LINK_TTL_MS;
    const sig = this.sign(quotationId, expiresAt);
    return `${baseUrl}/quotations/${quotationId}/pdf/public?exp=${expiresAt}&sig=${sig}`;
  }

  verifyPublicLink(quotationId: string, exp: string, sig: string): boolean {
    const expiresAt = Number(exp);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

    const expected = Buffer.from(this.sign(quotationId, expiresAt), 'hex');
    const provided = Buffer.from(sig ?? '', 'hex');
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }

  private sign(quotationId: string, expiresAt: number): string {
    const secret = this.config.get<string>(
      'QUOTATION_LINK_SECRET',
      this.config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    );
    return createHmac('sha256', secret).update(`${quotationId}:${expiresAt}`).digest('hex');
  }

  private async nextNumber(organizationId: string): Promise<string> {
    const count = await this.prisma.quotation.count({ where: { organizationId } });
    return `Q-${String(count + 1).padStart(4, '0')}`;
  }

  private async buildLines(
    organizationId: string,
    inputs: QuotationItemInputDto[],
  ): Promise<QuotationLine[]> {
    const productIds = [...new Set(inputs.map((i) => i.productId).filter((id): id is string => !!id))];
    const products = productIds.length
      ? await this.prisma.product.findMany({ where: { id: { in: productIds }, organizationId } })
      : [];
    const productMap = new Map<string, Product>(products.map((p) => [p.id, p]));
    const missing = productIds.filter((id) => !productMap.has(id));
    if (missing.length > 0) {
      throw new NotFoundException('One or more products not found in this organization');
    }

    return inputs.map((input, index) => {
      const product = input.productId ? productMap.get(input.productId) : undefined;
      const description = input.description ?? product?.name;
      if (!description) {
        throw new BadRequestException('Each item needs a description or a productId');
      }
      const unitPriceValue = input.unitPrice ?? (product ? Number(product.unitPrice) : undefined);
      if (unitPriceValue === undefined) {
        throw new BadRequestException('Each item needs a unitPrice or a productId');
      }
      const taxRatePercentValue =
        input.taxRatePercent ?? (product ? Number(product.taxRatePercent) : 0);

      const quantity = new Prisma.Decimal(input.quantity);
      const unitPrice = new Prisma.Decimal(unitPriceValue);
      const taxRatePercent = new Prisma.Decimal(taxRatePercentValue);

      return {
        productId: input.productId,
        description,
        quantity,
        unitPrice,
        taxRatePercent,
        lineTotal: quantity.mul(unitPrice),
        sortOrder: index,
      };
    });
  }

  private computeTotals(lines: QuotationLine[]) {
    const zero = new Prisma.Decimal(0);
    const subtotal = lines.reduce((sum, line) => sum.add(line.lineTotal), zero);
    const taxAmount = lines.reduce(
      (sum, line) => sum.add(line.lineTotal.mul(line.taxRatePercent).div(100)),
      zero,
    );
    return { subtotal, taxAmount, totalAmount: subtotal.add(taxAmount) };
  }

  private async assertLeadInOrg(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found in this organization');
  }

  private async assertCustomerInOrg(organizationId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) throw new NotFoundException('Customer not found in this organization');
  }
}
