const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export type PublicUser = { id: string; email: string; name: string; locale: string };

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: { code?: string } })?.error?.code ?? 'REQUEST_FAILED');
  }
  return body as T;
}

export function loginRequest(email: string, password: string) {
  return jsonFetch<{ accessToken: string; refreshToken: string; user: PublicUser }>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
  );
}

export function logoutRequest(refreshToken: string) {
  return jsonFetch<{ ok: true }>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
