/** Rule-based risk flags. Pure functions so the "why" is testable and deterministic. */

export type RiskEval = {
  atRisk: boolean;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  reason: string;
  /** Temperature-Humidity Index, present when the THI rule produced this evaluation. */
  thi?: number;
};

/**
 * Reason text is STORED on the RiskFlag, so it is composed server-side in the farm's
 * `defaultLocale`. Deliberately a tiny hardcoded en/hi map per band (documented choice:
 * two translations per string, no i18next on the server — revisit if a 3rd locale lands).
 */
export type Locale = 'en' | 'hi';

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

// ---------- THI heat stress (slice 11.7) ----------

/**
 * Temperature-Humidity Index for livestock:
 *   THI = 0.8·T + (RH/100)·(T − 14.4) + 46.4   (T in °C, RH in %)
 * Formula: NRC (1971) adaptation of Thom's (1959) discomfort index, as used for cattle
 * heat-stress work (e.g. Mader, Davis & Brown-Brandl 2006, J. Anim. Sci. 84:712–719).
 */
export function thi(tempC: number, humidityPct: number): number {
  return 0.8 * tempC + (humidityPct / 100) * (tempC - 14.4) + 46.4;
}

export type ThiBand = 'none' | 'alert' | 'danger' | 'emergency';

/**
 * Species THI bands (documented sources):
 * - Cattle: Livestock Weather Safety Index categories (LCI 1970; USDA/Univ. of Nebraska
 *   feedlot guidance, Mader et al.): alert ≥75, danger ≥79, emergency ≥84.
 * - Poultry: broiler heat-stress guidance (e.g. Purswell et al. 2012, Trans. ASABE;
 *   Ross/Aviagen hot-climate management): alert ≥72, danger ≥78.
 */
export function thiBands(value: number): { cattle: ThiBand; poultry: ThiBand } {
  const cattle: ThiBand = value >= 84 ? 'emergency' : value >= 79 ? 'danger' : value >= 75 ? 'alert' : 'none';
  const poultry: ThiBand = value >= 78 ? 'danger' : value >= 72 ? 'alert' : 'none';
  return { cattle, poultry };
}

const BAND_RANK: Record<ThiBand, number> = { none: 0, alert: 1, danger: 2, emergency: 3 };

/** Hardcoded per-band copy (en/hi) — see the Locale note above. */
const THI_TEXT: Record<
  Locale,
  {
    prefix: (t: number, h: number, v: string) => string;
    speciesLabel: { cattle: string; poultry: string };
    band: Record<Exclude<ThiBand, 'none'>, string>;
    recommendation: Record<Exclude<ThiBand, 'none'>, string>;
    ok: (v: string) => string;
  }
> = {
  en: {
    prefix: (t, h, v) => `Heat stress: THI ${v} at ${t}°C / ${h}% humidity`,
    speciesLabel: { cattle: 'cattle', poultry: 'poultry' },
    band: { alert: 'alert', danger: 'danger', emergency: 'emergency' },
    recommendation: {
      alert: 'Provide shade and cool clean drinking water, and increase ventilation/airflow.',
      danger:
        'Run fans/foggers or sprinklers, shift feeding to early morning and evening, and keep cool drinking water available at all times.',
      emergency:
        'Emergency cooling now: maximise airflow, use sprinklers/foggers, give unlimited cool drinking water, and suspend handling or transport.',
    },
    ok: (v) => `No heat stress (THI ${v})`,
  },
  hi: {
    prefix: (t, h, v) => `गर्मी का तनाव: THI ${v} — ${t}°C / ${h}% आर्द्रता`,
    speciesLabel: { cattle: 'मवेशी', poultry: 'मुर्गीपालन' },
    band: { alert: 'सतर्कता', danger: 'खतरा', emergency: 'आपातकाल' },
    recommendation: {
      alert: 'छाया और ठंडा साफ पीने का पानी दें, तथा हवा का प्रवाह/वेंटिलेशन बढ़ाएँ।',
      danger:
        'पंखे/फॉगर या स्प्रिंकलर चलाएँ, चारा सुबह जल्दी और शाम को दें, और हर समय ठंडा पीने का पानी उपलब्ध रखें।',
      emergency:
        'तुरंत आपात शीतलन करें: हवा का प्रवाह अधिकतम करें, स्प्रिंकलर/फॉगर चलाएँ, भरपूर ठंडा पीने का पानी दें, और पशुओं का स्थानांतरण/हैंडलिंग रोक दें।',
    },
    ok: (v) => `गर्मी का तनाव नहीं (THI ${v})`,
  },
};

/**
 * THI-based heat-stress evaluation (requires humidity). Severity: any species band at
 * danger/emergency → CRITICAL; alert → WARNING. The reason carries the THI value, the
 * per-species band and an actionable recommendation for the worst band, in `locale`.
 */
export function thiHeatStressRisk(tempC: number, humidityPct: number, locale: Locale = 'en'): RiskEval {
  const value = Math.round(thi(tempC, humidityPct) * 10) / 10;
  const v = value.toFixed(1);
  const bands = thiBands(value);
  const worst: ThiBand = BAND_RANK[bands.cattle] >= BAND_RANK[bands.poultry] ? bands.cattle : bands.poultry;
  const text = THI_TEXT[locale];
  if (worst === 'none') {
    return { atRisk: false, severity: 'INFO', reason: text.ok(v), thi: value };
  }
  const severity = worst === 'alert' ? 'WARNING' : 'CRITICAL';
  // Only species at/above their alert threshold appear in the reason.
  const parts = (['cattle', 'poultry'] as const)
    .filter((s) => bands[s] !== 'none')
    .map((s) => `${text.speciesLabel[s]}: ${text.band[bands[s] as Exclude<ThiBand, 'none'>]}`);
  const reason = `${text.prefix(tempC, humidityPct, v)} — ${parts.join(', ')}. ${text.recommendation[worst]}`;
  return { atRisk: true, severity, reason, thi: value };
}

/**
 * Combined heat rule used by weather fetch + the proactive sweep:
 * humidity present → THI banding; humidity absent → the temperature-only fallback above.
 */
export function evaluateHeatRisk(tempC: number, humidityPct: number | null, locale: Locale = 'en'): RiskEval {
  if (humidityPct == null) return heatStressRisk(tempC, humidityPct);
  return thiHeatStressRisk(tempC, humidityPct, locale);
}

// ---------- Mortality spike (slice 11.7) ----------

const MORTALITY_TEXT: Record<
  Locale,
  {
    spike: (code: string, deaths: number, pct: string, population: number) => string;
    recommendation: string;
    ok: (code: string, pct: string) => string;
  }
> = {
  en: {
    spike: (code, deaths, pct, population) =>
      `Mortality spike in batch ${code}: ${deaths} deaths in 24h (${pct}% of ${population})`,
    recommendation:
      'Isolate sick stock, check feed, water and ventilation, and consult a veterinarian.',
    ok: (code, pct) => `Mortality normal for batch ${code} (${pct}% in 24h)`,
  },
  hi: {
    spike: (code, deaths, pct, population) =>
      `बैच ${code} में मृत्यु दर में उछाल: 24 घंटे में ${deaths} मौतें (${population} में से ${pct}%)`,
    recommendation: 'बीमार पशुओं को अलग करें, चारा/पानी और वेंटिलेशन जाँचें, और पशु चिकित्सक से संपर्क करें।',
    ok: (code, pct) => `बैच ${code} की मृत्यु दर सामान्य (24 घंटे में ${pct}%)`,
  },
};

/**
 * Daily mortality-spike rule: deaths in the trailing 24h measured against the batch
 * population at the start of that window (`currentCount + deaths24h` — currentCount is
 * post-decrement). >2% → WARNING, >5% → CRITICAL. Reason carries the numbers + batch code.
 */
export function mortalitySpikeRisk(input: {
  deaths24h: number;
  currentCount: number;
  batchCode: string;
  locale?: Locale;
}): RiskEval {
  const { deaths24h, currentCount, batchCode } = input;
  const text = MORTALITY_TEXT[input.locale ?? 'en'];
  const population = currentCount + deaths24h;
  if (deaths24h <= 0 || population <= 0) {
    return { atRisk: false, severity: 'INFO', reason: text.ok(batchCode, '0.0') };
  }
  const pctNum = (deaths24h / population) * 100;
  const pct = pctNum.toFixed(1);
  if (pctNum <= 2) {
    return { atRisk: false, severity: 'INFO', reason: text.ok(batchCode, pct) };
  }
  const severity = pctNum > 5 ? 'CRITICAL' : 'WARNING';
  return {
    atRisk: true,
    severity,
    reason: `${text.spike(batchCode, deaths24h, pct, population)} — ${text.recommendation}`,
  };
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
