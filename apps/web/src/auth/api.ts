import { request } from '../lib/http';

export type PublicUser = { id: string; email: string; name: string; locale: string };
export type MyFarm = { farmId: string; farmName: string; role: string };
export type Session = { accessToken: string; refreshToken: string; user: PublicUser };

// Auth endpoints are `direct`: they must never trigger the authed delegate's
// 401 refresh-and-replay (a failed login/refresh is terminal, not retryable).

export function loginRequest(email: string, password: string) {
  return request<Session>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    direct: true,
  });
}

export function refreshRequest(refreshToken: string) {
  return request<Session>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    direct: true,
  });
}

export function logoutRequest(refreshToken: string) {
  return request<{ ok: true }>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
    direct: true,
  });
}

export function myFarmsRequest(accessToken: string) {
  return request<{ farms: MyFarm[] }>('/api/me/farms', { token: accessToken });
}
