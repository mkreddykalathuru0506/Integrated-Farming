import { request } from '../lib/http';
import type { PublicUser } from '../auth/api';

/**
 * Profile + session endpoints (/api/me, slice 11.3 API). User-scoped, not
 * farm-scoped — plain `request` calls; the authed delegate injects the token.
 */

export type UpdateMeBody = { name?: string; phone?: string; locale?: string };

export type SessionRow = {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  ip: string | null;
  userAgent: string | null;
};

/** Query keys for user-scoped (non-farm) data. Cleared with the cache on logout. */
export const meKeys = {
  sessions: ['me', 'sessions'] as const,
};

export function updateMeRequest(body: UpdateMeBody) {
  return request<{ user: PublicUser }>('/api/me', { method: 'PATCH', body: JSON.stringify(body) });
}

export function listSessionsRequest() {
  return request<{ sessions: SessionRow[] }>('/api/me/sessions');
}

export function revokeSessionRequest(id: string) {
  return request<{ ok: true }>(`/api/me/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
