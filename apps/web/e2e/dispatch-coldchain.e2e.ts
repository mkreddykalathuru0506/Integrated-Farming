import { test, expect } from '@playwright/test';
import { apiLogin, apiPatch, apiPost, createBatch, createCustomer, loginAsOwner, uniq } from './helpers';

/**
 * Brief §11 journey: take + dispatch an order with the §6 cold-chain hard gate.
 * Setup (API): confirmed sales order + a FROZEN product lot from a processed batch.
 * Then in the UI: dispatch WITHOUT refrigerated transport → blocked with the
 * cold-chain explanation; retry WITH refrigerated transport at −20°C → dispatched.
 */
test('dispatch: cold-chain gate blocks, compliant retry dispatches', async ({ page, request }) => {
  const auth = await apiLogin(request);

  // A clean batch (no withdrawal) → processing run → FROZEN lot.
  const batch = await createBatch(request, auth, uniq('E2E-DC'));
  const { run } = await apiPost<{ run: { lots: Array<{ id: string; lotCode: string }> } }>(
    request,
    auth,
    '/api/farm/processing',
    {
      sourceBatchId: batch.id,
      inputCount: 5,
      lots: [{ productName: 'E2E Frozen Chicken', state: 'FROZEN', quantityKg: 20 }],
    },
  );
  const lotId = run.lots[0]!.id;

  // A confirmed order to dispatch against.
  const customer = await createCustomer(request, auth, uniq('E2E Buyer'));
  const { order } = await apiPost<{ order: { id: string; orderNumber: string } }>(request, auth, '/api/farm/orders', {
    customerId: customer.id,
    lines: [{ description: 'Frozen chicken 5kg', qty: 5, unitPricePaise: 250000 }],
  });
  await apiPatch(request, auth, `/api/farm/orders/${order.id}/status`, { status: 'CONFIRMED' });

  await loginAsOwner(page);
  await page.goto('/sales/dispatch');

  await page.getByRole('button', { name: 'New dispatch' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Dispatch a confirmed order' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Confirmed order').selectOption(order.id);
  await dialog.getByLabel('Product lot').selectOption(lotId);
  await dialog.getByLabel('Qty (kg)').fill('5');

  // The UI states the frozen requirement up front.
  await expect(dialog.getByText(/Frozen product on board/)).toBeVisible();

  // Attempt 1 — no refrigerated transport → 422 COLD_CHAIN_FAIL with explanation.
  await dialog.getByLabel('Refrigerated transport').uncheck();
  await dialog.getByLabel(/Load temp/).fill('-20');
  await dialog.getByRole('button', { name: 'Dispatch', exact: true }).click();
  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('Blocked: this load would break the cold chain');
  await expect(alert).toContainText('refrigerated transport');
  await expect(dialog).toBeVisible(); // still open — nothing left the farm

  // Attempt 2 — refrigerated at −20°C (≤ −18°C for frozen) → dispatched.
  await dialog.getByLabel('Refrigerated transport').check();
  await dialog.getByRole('button', { name: 'Dispatch', exact: true }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole('row', { name: new RegExp(order.orderNumber) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Cold chain OK');
  await expect(row).toContainText('Refrigerated');
});
