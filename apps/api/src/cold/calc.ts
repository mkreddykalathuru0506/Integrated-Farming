export type ProductState = 'FRESH' | 'FROZEN';

/** §6 cold-chain bands: fresh meat 0–7°C, frozen ≤ −18°C (freezers run down to ~−30). */
export function defaultBand(mode: ProductState): { minTempC: number; maxTempC: number } {
  return mode === 'FRESH' ? { minTempC: 0, maxTempC: 7 } : { minTempC: -30, maxTempC: -18 };
}

/** A reading is out of range if colder than min or warmer than max (inclusive band). */
export function isOutOfRange(temperatureC: number, minTempC: number, maxTempC: number): boolean {
  return temperatureC < minTempC || temperatureC > maxTempC;
}
