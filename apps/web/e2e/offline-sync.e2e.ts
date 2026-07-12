import { test, expect } from '@playwright/test';
import { loginAsOwner } from './helpers';

// Critical journey: a field worker logs offline and it syncs on reconnect.
test('daily log offline → reconnect → syncs (no duplicate)', async ({ page, context }) => {
  await loginAsOwner(page);

  // Daily logging lives at /daily/logs since the per-panel routes (Phase 11).
  await page.goto('/daily/logs');
  const dailyLog = page.getByTestId('daily-log');
  await expect(dailyLog).toBeVisible();
  // Wait for the log form (batches loaded) before cutting the network.
  await expect(page.getByTestId('log-qty')).toBeVisible();

  // Go offline, then submit a feed log — it should queue.
  await context.setOffline(true);
  await page.getByTestId('log-qty').fill('15');
  await page.getByTestId('log-submit').click();
  await expect(page.getByTestId('log-pending')).toBeVisible();

  // Back online → the queue flushes on the 'online' event and pending clears.
  await context.setOffline(false);
  await expect(page.getByTestId('log-pending')).toHaveCount(0);
});
