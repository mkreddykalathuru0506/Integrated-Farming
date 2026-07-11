import { test, expect } from '@playwright/test';
import { apiLogin, createCustomer, loginAsOwner, uniq } from './helpers';

/**
 * Brief §11 journey: raise a GST-compliant invoice.
 * Two lines at different GST rates against an intra-state customer (farm state
 * is Telangana in the seed) → sequential FY number + CGST/SGST split.
 *
 * Line 1: 10 × ₹100 @ 5%  → ₹1,000 + ₹50 GST
 * Line 2:  5 × ₹200 @ 12% → ₹1,000 + ₹120 GST
 * Subtotal ₹2,000 · CGST ₹85 · SGST ₹85 · Total ₹2,170
 */
test('raise invoice: 2 lines, FY number, GST split in detail', async ({ page, request }) => {
  const auth = await apiLogin(request);
  const customerName = uniq('E2E Customer');
  await createCustomer(request, auth, customerName, 'Telangana'); // same state → CGST+SGST

  await loginAsOwner(page);
  await page.goto('/finance/invoices');

  await page.getByRole('button', { name: 'Raise invoice' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Raise an invoice' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Customer').selectOption({ label: `${customerName} (Telangana)` });

  // Line 1 — default 5% GST rate.
  await dialog.getByLabel('Description').fill('Broiler birds');
  await dialog.getByLabel('Qty').first().fill('10');
  await dialog.getByLabel('Unit price').fill('100');

  // Line 2 — 12% GST rate.
  await dialog.getByRole('button', { name: 'Add line' }).click();
  await dialog.getByLabel('Description').nth(1).fill('Manure bags');
  await dialog.getByLabel('Qty').nth(1).fill('5');
  await dialog.getByLabel('Unit price').nth(1).fill('200');
  await dialog.getByLabel('GST rate').nth(1).selectOption('1200');

  // Live estimate mirrors the server (intra-state split).
  await expect(dialog.getByText('Intra-state supply → CGST + SGST')).toBeVisible();
  await expect(dialog.getByText('₹2,170.00')).toBeVisible();

  await dialog.getByRole('button', { name: 'Raise invoice' }).click();
  await expect(dialog).toBeHidden();

  // Row appears with a gap-free Indian-FY invoice number (INV-<FY>-####).
  await page.getByPlaceholder('Search invoices…').fill(customerName);
  const row = page.getByRole('row', { name: /INV-\d{4}-\d{2}-\d{4}/ }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(customerName);
  await expect(row).toContainText('₹2,170.00');

  // Detail dialog shows the exact CGST/SGST split (no IGST for intra-state).
  await row.click();
  const detail = page.getByRole('dialog', { name: /Invoice INV-/ });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('CGST')).toBeVisible();
  await expect(detail.getByText('SGST')).toBeVisible();
  await expect(detail.getByText('₹85.00')).toHaveCount(2); // CGST + SGST
  await expect(detail.getByText('₹2,000.00')).toBeVisible(); // subtotal
  await expect(detail.getByText('₹2,170.00')).toBeVisible(); // total
  await expect(detail.getByText('IGST')).toHaveCount(0);
});
