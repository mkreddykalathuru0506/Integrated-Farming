/** Total cost in integer paise for a quantity at a unit price (paise/unit), rounded. */
export function purchaseTotalPaise(qty: number, unitPricePaise: number): number {
  return Math.round(qty * unitPricePaise);
}
