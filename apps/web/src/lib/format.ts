/**
 * Central formatting helpers (India domain rules, Brief §6):
 * - dates display DD-MM-YYYY in Asia/Kolkata;
 * - money is integer paise end-to-end (never floats), ₹ with Indian digit grouping.
 */

const IST = 'Asia/Kolkata';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const isoDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: IST });

/**
 * Today's calendar date in Asia/Kolkata as `YYYY-MM-DD` — the correct default for
 * date inputs and "is today" checks. Never use `new Date().toISOString().slice(0,10)`:
 * that is the UTC day, which is the PREVIOUS day for 00:00–05:30 IST (Brief §6).
 */
export function todayIST(now: Date = new Date()): string {
  return isoDayFmt.format(now);
}

/** ISO timestamp/Date → `DD-MM-YYYY` in Asia/Kolkata. Invalid/empty input → ''. */
export function fmtDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateFmt.format(d).replace(/\//g, '-') : '';
}

/** ISO timestamp/Date → `DD-MM-YYYY, HH:mm` (24 h) in Asia/Kolkata. Invalid/empty input → ''. */
export function fmtDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d).replace(/\//g, '-') : '';
}

/** Indian grouping for whole rupees (lakh/crore): 1234567 → "12,34,567". Accepts bigint. */
const inrGroups = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * Integer paise → `₹1,23,456.78` (Indian digit grouping, always 2 decimals).
 * BigInt arithmetic throughout — no float precision loss at any magnitude.
 * Non-integer or unparseable input → ''.
 */
export function fmtInr(paise: string | number | bigint): string {
  let p: bigint;
  try {
    p = BigInt(paise);
  } catch {
    return '';
  }
  const neg = p < 0n;
  const abs = neg ? -p : p;
  const rupees = abs / 100n;
  const rem = abs % 100n;
  return `${neg ? '-' : ''}₹${inrGroups.format(rupees)}.${rem.toString().padStart(2, '0')}`;
}

/**
 * Compact Indian currency from integer paise: ₹1.24L, ₹2.30Cr, ₹4.5k, ₹820.
 * (Display-only rounding; extracted from Dashboard so every screen compacts identically.)
 */
export function fmtInrCompact(paise: string | number | bigint): string {
  const r = Number(paise) / 100;
  if (Number.isNaN(r)) return '';
  const a = Math.abs(r);
  const s = r < 0 ? '-' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}k`;
  return `${s}₹${inrGroups.format(a)}`;
}

/**
 * User-typed rupee string → integer-paise string, or null when invalid.
 * Accepts optional sign, Indian comma grouping and at most 2 decimals
 * ("1,234.5" → "123450"); rejects >2 decimals and any non-numeric input.
 * BigInt arithmetic — never floats (§0 money rule).
 */
export function rupeesToPaise(input: string): string | null {
  const s = input.trim().replace(/,/g, '');
  const m = /^(-)?(\d*)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const [, sign, whole = '', frac = ''] = m;
  if (whole === '' && frac === '') return null;
  const paise = BigInt(whole || '0') * 100n + BigInt((frac + '00').slice(0, 2));
  if (paise === 0n) return '0';
  return `${sign ? '-' : ''}${paise.toString()}`;
}
