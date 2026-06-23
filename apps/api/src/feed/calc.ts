/** Total cost in integer paise for a quantity at a unit price (paise/unit), rounded. */
export function purchaseTotalPaise(qty: number, unitPricePaise: number): number {
  return Math.round(qty * unitPricePaise);
}

/** Feed Conversion Ratio = feed (kg) / weight gain (kg), 2 dp. null if no gain. */
export function fcr(feedKg: number, gainKg: number): number | null {
  if (gainKg <= 0) return null;
  return Math.round((feedKg / gainKg) * 100) / 100;
}
