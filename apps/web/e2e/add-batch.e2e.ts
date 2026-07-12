import { test, expect } from '@playwright/test';
import { loginAsOwner, uniq } from './helpers';

// Brief §11 journey: add a batch through the UI and see it in the list.
test('add batch: dialog → submit → row appears in the batches table', async ({ page }) => {
  const code = uniq('E2E-AB');
  await loginAsOwner(page);
  await page.goto('/livestock/batches');

  await page.getByRole('button', { name: 'Add batch' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Add batch' });
  await expect(dialog).toBeVisible();

  // First real option = first seeded BATCH-tracked species (index 0 is "Choose…").
  await dialog.getByLabel('Species').selectOption({ index: 1 });
  await dialog.getByLabel('Batch code').fill(code);
  await dialog.getByLabel('Initial count').fill('25');
  await dialog.getByRole('button', { name: 'Add batch' }).click();
  await expect(dialog).toBeHidden();

  // Filter the table to the new batch — resilient against parallel test data.
  await page.getByPlaceholder('Search…').fill(code);
  const row = page.getByRole('row', { name: new RegExp(code) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('25'); // initial count
  await expect(row).toContainText('Active');
});
