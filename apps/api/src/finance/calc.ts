/** Per-unit cost in integer paise (floor division). count <= 0 → 0. */
export function perUnitPaise(totalPaise: bigint, count: number): bigint {
  if (count <= 0) return 0n;
  return totalPaise / BigInt(count);
}

/** True if `date` falls on or before now + `days` (i.e. due/overdue or expiring soon). */
export function dueWithin(date: Date, days: number, now: Date): boolean {
  return date.getTime() <= now.getTime() + days * 86_400_000;
}
