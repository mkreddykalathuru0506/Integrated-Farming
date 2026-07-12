import { expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Shared helpers for the Playwright journeys (Brief §11).
 *
 * The suite runs against a real API + web dev server (see playwright.config.ts
 * webServer) and the idempotent Prisma seed: `demo-farm` with owner@demo.farm.
 * Tests create their own uniquely-coded records so files can run in parallel
 * against the shared database.
 */

export const API_URL =
  process.env.E2E_API_URL ?? `http://localhost:${process.env.E2E_API_PORT ?? 4100}`;

/** Fixed ids/credentials from apps/api/prisma/seed.ts (dev-only, ADR-0002). */
export const FARM_ID = 'demo-farm';
export const OWNER = { email: 'owner@demo.farm', password: 'Passw0rd!' };

/** Unique per-run suffix so parallel tests never collide on codes/names. */
export function uniq(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** UI login as the seeded owner; resolves once the authenticated shell renders. */
export async function loginAsOwner(page: Page): Promise<void> {
  await page.goto('/');
  // Landing front door (slice 11.11): unauthenticated `/` shows the marketing
  // page; click through to the sign-in card. Guarded on visibility so the helper
  // also works on branches without the landing (pre-merge).
  const emailInput = page.locator('input[type=email]');
  const landingSignIn = page.getByTestId('landing-signin');
  await expect(emailInput.or(landingSignIn).first()).toBeVisible();
  if (await landingSignIn.isVisible()) await landingSignIn.click();
  await emailInput.fill(OWNER.email);
  await page.locator('input[type=password]').fill(OWNER.password);
  // Exact-name match: the login view also has an OTP toggle ("Sign in with a
  // code instead") that a bare /sign in/i would ambiguously match (strict mode).
  await page.getByRole('button', { name: /^sign in$/i }).click();
  // The sidebar (desktop rail) only exists inside the authenticated shell.
  await expect(page.locator('aside').getByRole('link', { name: 'Livestock' })).toBeVisible();
}

// ---------------------------------------------------------------- API seeding

export type ApiAuth = { headers: Record<string, string> };

/** API login + farm scope headers for direct seeding calls in test setup. */
export async function apiLogin(request: APIRequestContext): Promise<ApiAuth> {
  const res = await request.post(`${API_URL}/api/auth/login`, { data: OWNER });
  if (!res.ok()) throw new Error(`API login failed: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { accessToken: string };
  return {
    headers: { Authorization: `Bearer ${body.accessToken}`, 'X-Farm-Id': FARM_ID },
  };
}

async function apiCall<T>(
  request: APIRequestContext,
  auth: ApiAuth,
  method: 'get' | 'post' | 'patch',
  path: string,
  data?: unknown,
): Promise<T> {
  const res = await request[method](`${API_URL}${path}`, {
    headers: auth.headers,
    ...(data === undefined ? {} : { data }),
  });
  if (!res.ok()) throw new Error(`${method.toUpperCase()} ${path} -> ${res.status()}: ${await res.text()}`);
  return (await res.json()) as T;
}

export const apiGet = <T>(r: APIRequestContext, a: ApiAuth, path: string) => apiCall<T>(r, a, 'get', path);
export const apiPost = <T>(r: APIRequestContext, a: ApiAuth, path: string, data: unknown) =>
  apiCall<T>(r, a, 'post', path, data);
export const apiPatch = <T>(r: APIRequestContext, a: ApiAuth, path: string, data: unknown) =>
  apiCall<T>(r, a, 'patch', path, data);

/** Create an ACTIVE batch on a seeded BATCH-tracked species; returns its id. */
export async function createBatch(
  request: APIRequestContext,
  auth: ApiAuth,
  code: string,
  initialCount = 50,
): Promise<{ id: string; code: string }> {
  const { species } = await apiGet<{ species: Array<{ id: string; trackingMode: string }> }>(
    request,
    auth,
    '/api/farm/species',
  );
  const batchSpecies = species.find((s) => s.trackingMode === 'BATCH');
  if (!batchSpecies) throw new Error('No BATCH-tracked species seeded');
  const { batch } = await apiPost<{ batch: { id: string; code: string } }>(request, auth, '/api/farm/batches', {
    speciesId: batchSpecies.id,
    code,
    initialCount,
  });
  return batch;
}

/** Create a customer (state drives the CGST/SGST vs IGST split); returns its id. */
export async function createCustomer(
  request: APIRequestContext,
  auth: ApiAuth,
  name: string,
  state?: string,
): Promise<{ id: string; name: string }> {
  const { customer } = await apiPost<{ customer: { id: string; name: string } }>(
    request,
    auth,
    '/api/farm/customers',
    { name, ...(state ? { state } : {}) },
  );
  return customer;
}
