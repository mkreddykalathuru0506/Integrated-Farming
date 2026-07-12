export type PasswordStrength = 'weak' | 'good' | 'strong';

/**
 * Tiny heuristic for the register-form hint (NOT a policy gate — the API only
 * enforces min 8): character-class variety + length ≥ 12 → weak / good / strong.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < 8) return 'weak';
  let score = 0;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;
  if (score >= 4) return 'strong';
  if (score >= 3) return 'good';
  return 'weak';
}
