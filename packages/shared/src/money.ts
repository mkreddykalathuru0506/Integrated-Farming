/**
 * Money is ALWAYS stored and computed as integer paise (₹1 = 100 paise).
 * Never use floats for currency. These are the canonical helpers reused everywhere.
 */
export type Paise = number;

/** Convert a rupee amount to integer paise (rounded to the nearest paise). */
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

/** Convert integer paise back to a rupee number (for display/calculation only). */
export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

/**
 * Format integer paise as an Indian-grouped ₹ string.
 * e.g. 123456789 -> "₹12,34,567.89"
 */
export function formatPaise(paise: Paise, opts: { withSymbol?: boolean } = {}): string {
  const { withSymbol = true } = opts;
  const negative = paise < 0;
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100);
  const paisePart = abs % 100;
  const body = `${groupIndian(rupees)}.${paisePart.toString().padStart(2, '0')}`;
  return `${negative ? '-' : ''}${withSymbol ? '₹' : ''}${body}`;
}

/** Indian digit grouping: last 3 digits, then groups of 2 (lakh/crore). */
function groupIndian(n: number): string {
  const s = n.toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${grouped},${last3}`;
}
