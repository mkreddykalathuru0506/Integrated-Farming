import { isApiError } from '../lib/http';

/**
 * Map a pre-auth API failure to a stable i18n key. Every auth flow (login,
 * OTP, register, forgot/reset) shares this so wording stays consistent.
 */
export function authErrorKey(err: unknown): string {
  if (isApiError(err)) {
    if (err.code === 'NETWORK') return 'auth.errors.offline';
    if (err.code === 'OTP_INVALID') return 'auth.errors.otpInvalid';
    if (err.code === 'EMAIL_TAKEN') return 'errors.EMAIL_TAKEN';
    if (err.status === 429) return 'auth.errors.rateLimited';
    if (err.status === 401) return 'auth.errors.invalid';
    if (err.code === 'VALIDATION') return 'errors.VALIDATION';
  }
  return 'errors.generic';
}
