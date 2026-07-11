/**
 * Typed HTTP core — the single transport under every API call in the web app.
 *
 * - `ApiError` carries the HTTP status + stable machine `code` (from the API's
 *   `{ error: { code } }` envelope, with status-based fallbacks) so callers can
 *   branch on codes instead of parsing messages.
 * - `qs()` builds query strings with `encodeURIComponent` on every key/value.
 * - `request<T>()` / `requestBlob()` check `res.ok` everywhere, parse JSON
 *   safely and throw `ApiError` on failure (network failures → code NETWORK).
 * - All non-auth calls flow through a swappable fetch delegate; AuthContext
 *   installs its `authedFetch` there so every call gets token injection and
 *   single-flight 401 refresh-and-replay without threading tokens around.
 */

/** Base URL of the API server — the one place it is read from the env. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

const FALLBACK_CODES: Record<number, string> = {
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export type QueryParams = Record<string, string | number | boolean | undefined>;

/** Build an encoded query string (`?a=b&c=d`), skipping undefined values. */
export function qs(params: QueryParams): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const baseFetch: FetchLike = (input, init) => fetch(input, init);

// Swappable delegate: AuthContext installs authedFetch here (token injection +
// 401 single-flight refresh-and-replay) so it applies to every request().
let fetchDelegate: FetchLike = baseFetch;

export function setRequestFetch(fn: FetchLike): void {
  fetchDelegate = fn;
}

export function resetRequestFetch(): void {
  fetchDelegate = baseFetch;
}

export type RequestOptions = Omit<RequestInit, 'headers'> & {
  /** Bearer token; converted callers omit it (the authed delegate injects it). */
  token?: string;
  /** Tenant scope — sent as the X-Farm-Id header. */
  farmId?: string;
  headers?: Record<string, string>;
  /**
   * Bypass the installed authed-fetch delegate. Auth endpoints (login/refresh/
   * logout) must set this so a 401 from them never triggers refresh-and-replay.
   */
  direct?: boolean;
};

async function toApiError(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  const err = (body as { error?: { code?: string; message?: string; details?: unknown } } | null)
    ?.error;
  return new ApiError(
    res.status,
    err?.code ?? FALLBACK_CODES[res.status] ?? 'REQUEST_FAILED',
    err?.message ?? `Request failed with status ${res.status}`,
    err?.details,
  );
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const { token, farmId, direct, headers, ...init } = opts;
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (farmId) h['X-Farm-Id'] = farmId;

  const doFetch = direct ? baseFetch : fetchDelegate;
  let res: Response;
  try {
    res = await doFetch(`${API_URL}${path}`, { ...init, headers: h });
  } catch {
    // fetch rejects (TypeError) only on network-level failure (offline, DNS, CORS).
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

/** JSON request against the API. Throws ApiError when the response is not ok. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts);
  if (res.status === 204) return undefined as T;
  const body: unknown = await res.json().catch(() => ({}));
  return body as T;
}

/** Binary GET (PDF/Excel). Throws ApiError on failure instead of yielding an error-body blob. */
export async function requestBlob(path: string, opts: RequestOptions = {}): Promise<Blob> {
  const res = await send(path, opts);
  return res.blob();
}
