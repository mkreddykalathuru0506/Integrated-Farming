/** Per-unit cost in integer paise (floor division). count <= 0 → 0. */
export function perUnitPaise(totalPaise: bigint, count: number): bigint {
  if (count <= 0) return 0n;
  return totalPaise / BigInt(count);
}
