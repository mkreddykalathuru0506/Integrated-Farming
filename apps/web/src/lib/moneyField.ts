import { z } from 'zod';
import { rupeesToPaise } from './format';

/**
 * Zod string field for a user-typed rupee amount (slice 11.8a). Valid only when it
 * converts to a NON-NEGATIVE integer-paise value with at most 2 decimals — matching
 * the API's paise schema (z.union([int().nonnegative(), string /^\d+$/])). Without
 * this guard a negative like "-2500" passes client zod but 400s server-side, so the
 * user gets a generic toast instead of an inline field error.
 *
 * @param messageKey i18n key surfaced as the field error
 * @param optional   when true, an empty string is allowed (unset optional field)
 */
export function rupeeField(messageKey: string, optional = false) {
  return z.string().refine((s) => {
    if (s.trim() === '') return optional;
    const paise = rupeesToPaise(s);
    return paise !== null && !paise.startsWith('-');
  }, messageKey);
}
