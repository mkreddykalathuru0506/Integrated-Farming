import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { OWNER } from './helpers';

/**
 * Pixel sweep (slice 11.10) — screenshots EVERY panel route at 360×740 and
 * 1280×800, light and dark, into a local folder for human review. Skipped by
 * default (not a CI gate): run with
 *
 *   SCREENSHOT_SWEEP=1 pnpm --filter @ifm/web e2e e2e/screenshots.e2e.ts
 *
 * Prereq: migrated + seeded DB (same as the journey suite). Also soft-asserts
 * zero horizontal page overflow on every route (Brief §2 — 360px rule).
 */
const SWEEP = process.env.SCREENSHOT_SWEEP === '1';

/** Every panel route (components/nav.tsx SECTIONS — keep in sync). */
const ROUTES = [
  '/',
  '/livestock/species',
  '/livestock/batches',
  '/livestock/animals',
  '/daily/workers',
  '/daily/tasks',
  '/daily/logs',
  '/health/health',
  '/health/vaccination',
  '/health/breeding',
  '/health/hatchery',
  '/finance/feed',
  '/finance/expenses',
  '/finance/emi',
  '/finance/invoices',
  '/sales/orders',
  '/sales/coldstorage',
  '/sales/processing',
  '/sales/dispatch',
  '/maintenance/assets',
  '/maintenance/byproducts',
  '/maintenance/circularity',
  '/intelligence/weather',
  '/intelligence/market',
  '/reports',
  '/settings/units',
  '/settings/team',
  '/settings/activity',
  '/settings/settings',
] as const;

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 740 },
  { name: 'desktop-1280', width: 1280, height: 800 },
] as const;
const THEMES = ['light', 'dark'] as const;

// Local-only output (gitignored). Resolved from the workspace cwd (apps/web) —
// the e2e files run as ESM, so no __dirname here.
const OUT_DIR = resolve('e2e', '.screens');

test.describe('pixel sweep — every panel, 2 viewports × 2 themes', () => {
  test.skip(!SWEEP, 'manual sweep — set SCREENSHOT_SWEEP=1 to run');

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`${vp.name} · ${theme}`, async ({ page }) => {
        test.setTimeout(600_000);
        await page.setViewportSize({ width: vp.width, height: vp.height });

        // Seed the theme BEFORE first paint: index.html's no-flash script reads
        // localStorage['ifm.theme'] to add `.dark`, and ThemeToggle only reflects that
        // class on mount (it never re-reads localStorage). addInitScript runs ahead of
        // page scripts, so the class is right from the first paint and persists across
        // SPA navigation (no reload to wipe it).
        await page.addInitScript((t) => {
          try {
            localStorage.setItem('ifm.theme', t as string);
          } catch {
            /* ignore */
          }
        }, theme);

        // Login (viewport-agnostic — the journey helper asserts the desktop rail,
        // which is hidden at 360px).
        await page.goto('/');
        await page.locator('input[type=email]').fill(OWNER.email);
        await page.locator('input[type=password]').fill(OWNER.password);
        await page.getByRole('button', { name: /^sign in$/i }).click();
        // Only the authed shell has the sticky Topbar <header> (login has a <main> too).
        await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });

        mkdirSync(OUT_DIR, { recursive: true });
        for (const route of ROUTES) {
          // SPA navigation (pushState + popstate — what the in-app router listens to):
          // full page.goto() reloads re-run the refresh-token rotation on every route
          // and can race it, dropping the session mid-sweep (login-screen shots).
          await page.evaluate((r) => {
            window.history.pushState(null, '', r);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }, route);
          await expect(page.locator('header')).toBeVisible({ timeout: 15_000 });
          // Fonts first: fallback-font metrics are wider and briefly overflow nowrap
          // chips at 360px — measuring pre-swap reports phantom overflow (cold vite).
          await page.evaluate(() => document.fonts.ready.then(() => undefined));
          await page.waitForTimeout(1200); // let queries land; skeletons settle
          const slug = route === '/' ? 'overview' : route.slice(1).replace(/\//g, '-');
          await page.screenshot({
            path: join(OUT_DIR, `${vp.name}--${theme}--${slug}.png`),
            fullPage: true,
            animations: 'disabled',
          });
          // The page body must never scroll horizontally (Brief §2 / CLAUDE.md DoD).
          const overflow = await page.evaluate(() => {
            const doc = document.documentElement;
            const px = doc.scrollWidth - doc.clientWidth;
            if (px <= 0) return { px, offenders: [] as string[] };
            const limit = doc.clientWidth;
            const offenders: string[] = [];
            for (const el of Array.from(document.querySelectorAll('*'))) {
              const r = el.getBoundingClientRect();
              if (r.right > limit + 1 && r.width > 0) {
                const e = el as HTMLElement;
                offenders.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 80)} right=${Math.round(r.right)}`);
              }
            }
            return { px, offenders: offenders.slice(0, 6) };
          });
          if (overflow.px > 0) {
            console.log(`OVERFLOW ${route} @ ${vp.name}/${theme} = ${overflow.px}px`, overflow.offenders);
          }
          expect.soft(overflow.px, `horizontal overflow on ${route} @ ${vp.name}/${theme}`).toBeLessThanOrEqual(0);
        }
      });
    }
  }
});
