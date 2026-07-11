import { test, expect } from '@playwright/test';
import { apiLogin, createBatch, loginAsOwner, uniq } from './helpers';

/**
 * Brief §11 journey + §6 hard domain rule: a batch under an active medication
 * withdrawal period MUST be blocked from processing/sale until it elapses.
 * Record medication (7 withdrawal days) through the UI, then attempt to
 * process that batch → expect the withdrawal-block explanation.
 */
test('withdrawal gate: medicated batch is blocked from processing', async ({ page, request }) => {
  const auth = await apiLogin(request);
  const batch = await createBatch(request, auth, uniq('E2E-WD'));

  await loginAsOwner(page);

  // 1) Record medication with withdrawal days on the batch.
  await page.goto('/health');
  await page.getByRole('button', { name: 'Record medication' }).click();
  const med = page.getByRole('dialog', { name: 'Record medication' });
  await expect(med).toBeVisible();
  await med.getByLabel('Batch').selectOption(batch.id);
  await med.getByLabel('Drug name').fill('Oxytetracycline');
  await med.getByLabel('Withdrawal days').fill('7');
  await med.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(med).toBeHidden();

  // 2) Attempt to process the medicated batch → hard-blocked with explanation.
  await page.goto('/sales/processing');
  await page.getByRole('button', { name: 'Process batch' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Process a batch' });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Source batch').selectOption(batch.id);
  await dialog.getByLabel('Product name').fill('Dressed chicken');
  await dialog.getByLabel('Qty (kg)').fill('5');
  await dialog.getByRole('button', { name: 'Process', exact: true }).click();

  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('Blocked: medication withdrawal active');
  await expect(alert).toContainText('withdrawal period has not elapsed');
  await expect(dialog).toBeVisible(); // nothing was processed
});
