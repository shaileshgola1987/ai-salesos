import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string, query: QueryProductsDto) {
    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(query.isActive !== undefined && { isActive: query.isActive === 'true' }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.prisma.product.findMany({ where, orderBy: { name: 'asc' } });
  }

  async getOne(organizationId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  create(organizationId: string, dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        organizationId,
        name: dto.name,
        sku: dto.sku,
        description: dto.description,
        unit: dto.unit ?? 'pcs',
        unitPrice: dto.unitPrice,
        taxRatePercent: dto.taxRatePercent ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateProductDto) {
    await this.getOne(organizationId, id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    // Products referenced by past quotation line items are archived, not deleted, so
    // historical quotations keep rendering correctly (QuotationItem snapshots the price
    // anyway, but the catalog entry itself should still exist for lookups/exports).
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}
