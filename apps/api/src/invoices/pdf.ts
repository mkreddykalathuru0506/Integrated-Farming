import PDFDocument from 'pdfkit';
import { formatPaise } from '@ifm/shared';

export type InvoiceForPdf = {
  invoiceNumber: string;
  issueDate: Date;
  fssaiLicenseNo: string | null;
  customerName: string;
  customerGstin: string | null;
  subtotalPaise: bigint;
  cgstPaise: bigint;
  sgstPaise: bigint;
  igstPaise: bigint;
  totalPaise: bigint;
  lines: {
    description: string;
    hsnSac: string | null;
    qty: string;
    unitPricePaise: bigint;
    gstRateBps: number;
    lineTotalPaise: bigint;
  }[];
};

/** Adapter so tests can swap a mock. The real impl renders a GST/FSSAI invoice PDF. */
export interface InvoicePdf {
  render(inv: InvoiceForPdf): Promise<Buffer>;
}

export class PdfKitInvoicePdf implements InvoicePdf {
  render(inv: InvoiceForPdf): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Tax Invoice', { align: 'center' });
      doc.moveDown(0.5).fontSize(10);
      doc.text(`Invoice: ${inv.invoiceNumber}`);
      doc.text(`Date: ${inv.issueDate.toISOString().slice(0, 10)}`);
      if (inv.fssaiLicenseNo) doc.text(`FSSAI License: ${inv.fssaiLicenseNo}`); // legally required on every bill
      doc.moveDown(0.5);
      doc.text(`Bill to: ${inv.customerName}${inv.customerGstin ? ` (GSTIN ${inv.customerGstin})` : ''}`);
      doc.moveDown(0.5);

      for (const l of inv.lines) {
        doc.text(
          `${l.description} — ${l.qty} × ${formatPaise(Number(l.unitPricePaise))} @ ${l.gstRateBps / 100}% = ${formatPaise(Number(l.lineTotalPaise))}` +
            (l.hsnSac ? `  [HSN/SAC ${l.hsnSac}]` : ''),
        );
      }
      doc.moveDown(0.5);
      doc.text(`Subtotal: ${formatPaise(Number(inv.subtotalPaise))}`);
      if (inv.igstPaise > 0n) doc.text(`IGST: ${formatPaise(Number(inv.igstPaise))}`);
      else {
        doc.text(`CGST: ${formatPaise(Number(inv.cgstPaise))}`);
        doc.text(`SGST: ${formatPaise(Number(inv.sgstPaise))}`);
      }
      doc.fontSize(12).text(`Total: ${formatPaise(Number(inv.totalPaise))}`, { underline: true });

      doc.end();
    });
  }
}
