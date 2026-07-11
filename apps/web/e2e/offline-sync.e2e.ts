import { test, expect } from '@playwright/test';

// Critical journey: a field worker logs offline and it syncs on reconnect.
test('daily log offline → reconnect → syncs (no duplicate)', async ({ page, context }) => {
  await page.goto('/');

  // Log in as the seeded owner.
  await page.locator('input[type=email]').fill('owner@demo.farm');
  await page.locator('input[type=password]').fill('Passw0rd!');
  // Exact match: the login view also has a "Sign in with a code instead" button (slice 11.3).
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

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
