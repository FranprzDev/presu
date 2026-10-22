import PDFDocument from 'pdfkit';
import type { Brief } from './brief.js';

export async function renderQuotePdf(input: {
  projectName: string;
  brief: Brief;
  currency: string;
  hourlyRateCents: number;
  totalMinCents: number;
  totalMaxCents: number;
}) {
  const doc = new PDFDocument({ margin: 52, size: 'A4' });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const money = (amount: number) => `${input.currency} ${(amount / 100).toFixed(2)}`;

  doc.fontSize(22).text('Presu · Propuesta de cotización');
  doc.moveDown().fontSize(15).text(input.projectName);
  doc.moveDown().fontSize(11).text(input.brief.summary);
  doc.moveDown().fontSize(14).text('Alcance incluido');
  for (const item of input.brief.included) doc.fontSize(10).text(`• ${item}`);
  doc.moveDown().fontSize(14).text('Fuera de alcance');
  for (const item of input.brief.excluded) doc.fontSize(10).text(`• ${item}`);
  doc.moveDown().fontSize(14).text('Supuestos');
  for (const item of input.brief.assumptions) doc.fontSize(10).text(`• ${item}`);
  doc.moveDown().fontSize(14).text('Estimación por módulo');
  for (const estimate of input.brief.estimates) {
    doc.fontSize(10).text(`${estimate.module}: ${estimate.minHours}–${estimate.maxHours} h`);
  }
  doc.moveDown().fontSize(14).text('Cotización estimada');
  doc.fontSize(11).text(`${money(input.totalMinCents)} – ${money(input.totalMaxCents)}`);
  doc.fontSize(9).text(`Tarifa aplicada: ${money(input.hourlyRateCents)} por hora.`);
  doc.moveDown().fontSize(9).text(
    'Evaluación limitada a definición e implementabilidad según la información disponible; no acredita demanda de mercado.',
  );
  doc.end();
  return finished;
}
