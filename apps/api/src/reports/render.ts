import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { formatPaise } from '@ifm/shared';
import type { ReportSummary } from './data';

const money = (paise: string) => formatPaise(Number(paise));
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

/** Farm summary as a PDF (pdfkit). Returns a Buffer. */
export function renderSummaryPdf(s: ReportSummary): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Farm Summary Report', { align: 'center' });
    doc.moveDown(0.5).fontSize(10);
    doc.text(`Farm: ${s.farm.name}${s.farm.state ? `, ${s.farm.state}` : ''}`);
    if (s.farm.fssaiLicenseNo) doc.text(`FSSAI License: ${s.farm.fssaiLicenseNo}`);
    doc.text(`Period: ${day(s.range.from)} to ${day(s.range.to)}`);
    doc.text(`Generated: ${s.generatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`);

    doc.moveDown(0.7).fontSize(13).text('Financial (P&L)');
    doc.fontSize(10);
    doc.text(`Revenue: ${money(s.financial.revenuePaise)}`);
    doc.text(`Cost: ${money(s.financial.costPaise)}`);
    doc.text(`Profit: ${money(s.financial.profitPaise)}`);

    doc.moveDown(0.7).fontSize(13).text('Livestock');
    doc.fontSize(10);
    doc.text(`Active batches: ${s.livestock.activeBatches}`);
    doc.text(`Total birds/animals: ${s.livestock.totalBirds}`);
    doc.text(`Mortality events: ${s.livestock.mortalityEvents} (${s.livestock.mortalityCount} head)`);

    doc.moveDown(0.7).fontSize(13).text('Feed');
    doc.fontSize(10);
    doc.text(`Consumption: ${s.feed.consumptionKg} kg`);
    doc.text(`Feed cost: ${money(s.feed.consumptionCostPaise)}`);

    if (s.market.length) {
      doc.moveDown(0.7).fontSize(13).text('Latest market rates');
      doc.fontSize(10);
      for (const m of s.market) doc.text(`${m.commodity}: ${money(m.pricePaise)}/${m.unit}`);
    }

    doc.moveDown(0.7).fontSize(13).text('Risk alerts');
    doc.fontSize(10);
    doc.text(`Open: ${s.risks.open} (critical: ${s.risks.critical})`);

    doc.end();
  });
}

/** Farm summary as an .xlsx workbook (exceljs). Returns a Buffer. */
export async function renderSummaryXlsx(s: ReportSummary): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IFM';

  const overview = wb.addWorksheet('Summary');
  overview.columns = [
    { header: 'Metric', key: 'metric', width: 28 },
    { header: 'Value', key: 'value', width: 28 },
  ];
  overview.addRows([
    { metric: 'Farm', value: s.farm.name },
    { metric: 'State', value: s.farm.state ?? '' },
    { metric: 'FSSAI License', value: s.farm.fssaiLicenseNo ?? '' },
    { metric: 'Period from', value: day(s.range.from) },
    { metric: 'Period to', value: day(s.range.to) },
    { metric: 'Revenue', value: money(s.financial.revenuePaise) },
    { metric: 'Cost', value: money(s.financial.costPaise) },
    { metric: 'Profit', value: money(s.financial.profitPaise) },
    { metric: 'Active batches', value: s.livestock.activeBatches },
    { metric: 'Total birds/animals', value: s.livestock.totalBirds },
    { metric: 'Mortality events', value: s.livestock.mortalityEvents },
    { metric: 'Mortality head', value: s.livestock.mortalityCount },
    { metric: 'Feed consumption (kg)', value: s.feed.consumptionKg },
    { metric: 'Feed cost', value: money(s.feed.consumptionCostPaise) },
    { metric: 'Open risks', value: s.risks.open },
    { metric: 'Critical risks', value: s.risks.critical },
  ]);
  overview.getRow(1).font = { bold: true };

  if (s.market.length) {
    const mkt = wb.addWorksheet('Market');
    mkt.columns = [
      { header: 'Commodity', key: 'commodity', width: 24 },
      { header: 'Price', key: 'price', width: 16 },
      { header: 'Unit', key: 'unit', width: 12 },
    ];
    mkt.getRow(1).font = { bold: true };
    for (const m of s.market) mkt.addRow({ commodity: m.commodity, price: money(m.pricePaise), unit: m.unit });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
