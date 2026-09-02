import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { Organization, Quotation, QuotationItem } from '@prisma/client';

type PartyInfo = {
  name: string;
  companyName: string | null;
  phone: string;
  email: string | null;
} | null;

export interface QuotationForPdf extends Quotation {
  items: QuotationItem[];
  lead: PartyInfo;
  customer: PartyInfo;
  createdBy: { name: string };
}

const COLUMNS = [
  { label: 'Description', width: 200 },
  { label: 'Qty', width: 50 },
  { label: 'Unit Price', width: 80 },
  { label: 'GST %', width: 55 },
  { label: 'Line Total', width: 90 },
];
const TABLE_WIDTH = COLUMNS.reduce((sum, c) => sum + c.width, 0);

function formatCurrency(value: unknown): string {
  return `Rs. ${Number(value).toFixed(2)}`;
}

function formatDate(value: Date | null): string {
  return value ? value.toLocaleDateString('en-IN') : '';
}

/** Renders a Quotation to a PDF buffer for download/preview or WhatsApp sharing. */
@Injectable()
export class QuotationsPdfService {
  render(
    organization: Pick<Organization, 'name' | 'gstin'>,
    quotation: QuotationForPdf,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderHeader(doc, organization, quotation);
      this.renderRecipient(doc, quotation);
      this.renderItemsTable(doc, quotation);
      this.renderTotals(doc, quotation);
      this.renderFooter(doc, quotation);

      doc.end();
    });
  }

  private renderHeader(
    doc: PDFKit.PDFDocument,
    organization: Pick<Organization, 'name' | 'gstin'>,
    quotation: QuotationForPdf,
  ) {
    doc.fontSize(20).fillColor('#111827').text(organization.name);
    if (organization.gstin) {
      doc.fontSize(9).fillColor('#555').text(`GSTIN: ${organization.gstin}`);
    }
    doc.moveDown();

    doc.fillColor('#111827').fontSize(16).text(`Quotation ${quotation.number}`, { align: 'right' });
    doc
      .fontSize(9)
      .fillColor('#555')
      .text(`Date: ${formatDate(quotation.createdAt)}`, { align: 'right' });
    if (quotation.validUntil) {
      doc.text(`Valid until: ${formatDate(quotation.validUntil)}`, { align: 'right' });
    }
    doc.moveDown();
  }

  private renderRecipient(doc: PDFKit.PDFDocument, quotation: QuotationForPdf) {
    const recipient = quotation.lead ?? quotation.customer;
    doc.fillColor('#111827').fontSize(11).text('Bill To:');
    doc.fontSize(10);
    if (recipient) {
      doc.text(recipient.name);
      if (recipient.companyName) doc.text(recipient.companyName);
      doc.text(recipient.phone);
      if (recipient.email) doc.text(recipient.email);
    } else {
      doc.text('—');
    }
    doc.moveDown();
  }

  private renderItemsTable(doc: PDFKit.PDFDocument, quotation: QuotationForPdf) {
    const startX = doc.x;
    let y = doc.y;

    doc.rect(startX, y, TABLE_WIDTH, 20).fill('#111827');
    doc.fillColor('#ffffff').fontSize(9);
    let cellX = startX;
    for (const col of COLUMNS) {
      doc.text(col.label, cellX + 4, y + 6, { width: col.width - 8 });
      cellX += col.width;
    }
    y += 22;

    doc.fillColor('#111827');
    for (const item of quotation.items) {
      const values = [
        item.description,
        Number(item.quantity).toString(),
        formatCurrency(item.unitPrice),
        `${Number(item.taxRatePercent)}%`,
        formatCurrency(item.lineTotal),
      ];
      cellX = startX;
      for (let i = 0; i < COLUMNS.length; i++) {
        doc.fontSize(9).text(values[i], cellX + 4, y, { width: COLUMNS[i].width - 8 });
        cellX += COLUMNS[i].width;
      }
      y += 20;
    }

    doc
      .moveTo(startX, y)
      .lineTo(startX + TABLE_WIDTH, y)
      .strokeColor('#d1d5db')
      .stroke();

    doc.y = y + 10;
    doc.x = startX;
  }

  private renderTotals(doc: PDFKit.PDFDocument, quotation: QuotationForPdf) {
    doc
      .fontSize(10)
      .fillColor('#111827')
      .text(`Subtotal: ${formatCurrency(quotation.subtotal)}`, { align: 'right', width: TABLE_WIDTH });
    doc.text(`GST: ${formatCurrency(quotation.taxAmount)}`, { align: 'right', width: TABLE_WIDTH });
    doc
      .fontSize(12)
      .text(`Total: ${formatCurrency(quotation.totalAmount)}`, { align: 'right', width: TABLE_WIDTH });
  }

  private renderFooter(doc: PDFKit.PDFDocument, quotation: QuotationForPdf) {
    if (quotation.notes) {
      doc.moveDown(2);
      doc.fontSize(10).fillColor('#111827').text('Notes:', { underline: true });
      doc.fontSize(9).fillColor('#374151').text(quotation.notes);
    }

    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor('#9ca3af')
      .text(`Prepared by ${quotation.createdBy.name} · AI SalesOS`, { align: 'center' });
  }
}
