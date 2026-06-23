/** Hatch/fertility rate as a percentage (1 decimal). 0 eggs → 0. */
export function rate(total: number, part: number | null | undefined): number {
  if (!total || total <= 0 || !part) return 0;
  return Math.round((part / total) * 1000) / 10;
}
