import { vi } from 'vitest';

export type RouteHandler = (init: RequestInit | undefined, url: string) => Response | Promise<Response>;

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Stub global fetch with handlers keyed by pathname; unmatched paths throw. */
export function mockFetchRoutes(routes: Record<string, RouteHandler>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = new URL(url).pathname;
    const handler = routes[path];
    if (!handler) throw new TypeError(`No mock route for ${path}`);
    return handler(init, url);
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}
