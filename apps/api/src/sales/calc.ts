/** Money is integer paise. qty is a positive number (kg/units). */
export function lineTotalPaise(qty: number, unitPricePaise: number | bigint): bigint {
  // round to nearest paise; qty may be fractional (e.g. 12.5 kg)
  return BigInt(Math.round(qty * Number(unitPricePaise)));
}

export function orderTotalPaise(lines: { lineTotalPaise: bigint }[]): bigint {
  return lines.reduce((sum, l) => sum + l.lineTotalPaise, 0n);
}
