import PDFDocument from 'pdfkit';
import { env } from '../config/env.js';
import { PricingSummary } from './pricing.js';

export interface QuotePdfOptions {
  summary: PricingSummary;
  customerName?: string;
  projectTitle?: string;
}

export const buildQuotePdf = async (options: QuotePdfOptions): Promise<Buffer> => {
  const { summary, customerName, projectTitle } = options;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk) => chunks.push(chunk as Buffer));

  doc.fontSize(18).text(env.BRAND_COMPANY_NAME ?? 'Simpro Quote Agent', { align: 'left' });
  doc.moveDown();
  doc.fontSize(12).text(`ABN: ${env.BRAND_ABN ?? 'TBD'}`);
  if (env.BRAND_ADDRESS) doc.text(env.BRAND_ADDRESS);
  if (env.BRAND_PHONE) doc.text(env.BRAND_PHONE);
  if (env.BRAND_EMAIL) doc.text(env.BRAND_EMAIL);
  doc.moveDown();

  if (customerName) {
    doc.fontSize(14).text(`Quote for ${customerName}`);
  }
  if (projectTitle) {
    doc.fontSize(12).text(`Project: ${projectTitle}`);
  }
  doc.moveDown();

  doc.fontSize(12).text('Line Items');
  doc.moveDown(0.5);

  summary.lines.forEach((line, index) => {
    doc.fontSize(11).text(`${index + 1}. ${line.description}`);
    doc.text(
      `Qty: ${line.quantity} | Unit ex GST: $${line.unitPriceExGst.toFixed(2)} | Total ex GST: $${line.lineTotalExGst.toFixed(
        2
      )} | GST: ${(line.gstRate * 100).toFixed(0)}%`
    );
    doc.moveDown(0.5);
  });

  doc.moveDown();
  doc.fontSize(12).text(`Subtotal (ex GST): $${summary.subtotalExGst.toFixed(2)}`);
  doc.text(`GST: $${summary.gstTotal.toFixed(2)}`);
  doc.text(`Total (inc GST): $${summary.subtotalIncGst.toFixed(2)}`);
  if (summary.callOutFeeApplied) {
    doc.text('Call-out fee applied to meet minimum.');
  }

  doc.moveDown(2);
  doc.fontSize(10).text('Generated automatically by the Simpro Quote Agent.');

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
  });
};
