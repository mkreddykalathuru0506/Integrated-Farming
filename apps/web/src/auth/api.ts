import { request } from '../lib/http';

export type PublicUser = { id: string; email: string; name: string; locale: string };
export type MyFarm = { farmId: string; farmName: string; role: string };
export type Session = {
  accessToken: string;
  refreshToken: string;
  /** RefreshToken row id (slice 11.3 API) — used to mark "this device" in the sessions list. */
  sessionId?: string;
  user: PublicUser;
};

/** The enumeration-proof generic response of OTP issuance endpoints. */
export type OtpIssued = { ok: true; retryAfterSec: number };

// Auth endpoints are `direct`: they must never trigger the authed delegate's
// 401 refresh-and-replay (a failed login/refresh is terminal, not retryable).

export function loginRequest(email: string, password: string) {
  return request<Session>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    direct: true,
  });
}

export function registerRequest(input: {
  email: string;
  name: string;
  password: string;
  phone?: string;
}) {
  return request<{ user: PublicUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
    direct: true,
  });
}

export function otpRequestRequest(email: string, purpose: 'LOGIN' | 'RESET_PASSWORD') {
  return request<OtpIssued>('/api/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ email, purpose }),
    direct: true,
  });
}

export function otpVerifyRequest(email: string, code: string) {
  return request<Session>('/api/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ email, purpose: 'LOGIN', code }),
    direct: true,
  });
}

export function forgotRequest(email: string) {
  return request<OtpIssued>('/api/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
    direct: true,
  });
}

export function resetRequest(email: string, code: string, newPassword: string) {
  return request<{ ok: true }>('/api/auth/reset', {
    method: 'POST',
    body: JSON.stringify({ email, code, newPassword }),
    direct: true,
  });
}

/**
 * Authenticated password change. Requires the presenting refresh token so the API
 * keeps THIS session alive while revoking every other one. Not `direct`: the authed
 * delegate injects the Bearer token (and replays once after an expired-token 401).
 */
export function changePasswordRequest(input: {
  currentPassword: string;
  newPassword: string;
  refreshToken: string;
}) {
  return request<{ ok: true }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
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

/** Revoke every session except the presenting one. Returns how many were revoked. */
export function revokeOtherSessionsRequest(refreshToken: string) {
  return request<{ revoked: number }>('/api/me/sessions/revoke-others', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
