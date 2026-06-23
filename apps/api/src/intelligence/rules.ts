/** Rule-based risk flags. Pure functions so the "why" is testable and deterministic. */

export type RiskEval = {
  atRisk: boolean;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  reason: string;
};

/**
 * Heat-stress for livestock (§6 welfare). High ambient temperature, amplified by humidity.
 * ≥38°C → CRITICAL; ≥35°C → WARNING; ≥32°C with high humidity (≥80%) → WARNING.
 */
export function heatStressRisk(tempC: number, humidityPct: number | null): RiskEval {
  const h = humidityPct ?? 0;
  if (tempC >= 38) {
    return { atRisk: true, severity: 'CRITICAL', reason: `Heat stress: ${tempC}°C (≥38°C) — provide shade, water, ventilation` };
  }
  if (tempC >= 35) {
    return { atRisk: true, severity: 'WARNING', reason: `Heat stress: ${tempC}°C (≥35°C) at ${h}% humidity` };
  }
  if (tempC >= 32 && h >= 80) {
    return { atRisk: true, severity: 'WARNING', reason: `Heat stress: ${tempC}°C with high humidity (${h}%)` };
  }
  return { atRisk: false, severity: 'INFO', reason: `No heat stress (${tempC}°C, ${h}% humidity)` };
}

/**
 * Market price-drop alert. Drop of `thresholdPct`% or more from the previous observed price.
 */
export function priceDropRisk(prevPaise: bigint, currPaise: bigint, thresholdPct = 10): RiskEval {
  if (prevPaise <= 0n) return { atRisk: false, severity: 'INFO', reason: 'No prior price to compare' };
  const dropPct = Number(((prevPaise - currPaise) * 10000n) / prevPaise) / 100; // 2dp
  if (dropPct >= thresholdPct) {
    const severity = dropPct >= thresholdPct * 2 ? 'CRITICAL' : 'WARNING';
    return { atRisk: true, severity, reason: `Price dropped ${dropPct.toFixed(1)}% (≥${thresholdPct}%) since last reading` };
  }
  return { atRisk: false, severity: 'INFO', reason: `Price change ${dropPct.toFixed(1)}% (below ${thresholdPct}% alert)` };
}
