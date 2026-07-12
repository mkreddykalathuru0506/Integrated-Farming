import { describe, it, expect } from 'vitest';
import {
  evaluateHeatRisk,
  heatStressRisk,
  mortalitySpikeRisk,
  priceDropRisk,
  thi,
  thiBands,
  thiHeatStressRisk,
} from '../src/intelligence/rules';

describe('heat-stress rule', () => {
  it('flags CRITICAL at ≥38°C', () => {
    const r = heatStressRisk(39, 60);
    expect(r.atRisk).toBe(true);
    expect(r.severity).toBe('CRITICAL');
    expect(r.reason).toContain('39');
  });

  it('flags WARNING at ≥35°C', () => {
    expect(heatStressRisk(36, 50)).toMatchObject({ atRisk: true, severity: 'WARNING' });
  });

  it('flags WARNING at 32°C with high humidity', () => {
    expect(heatStressRisk(33, 85).atRisk).toBe(true);
    expect(heatStressRisk(33, 50).atRisk).toBe(false);
  });

  it('no risk in mild conditions', () => {
    expect(heatStressRisk(28, 40).atRisk).toBe(false);
  });
});

describe('price-drop rule', () => {
  it('flags a drop ≥ threshold', () => {
    const r = priceDropRisk(10000n, 8500n, 10); // 15% drop
    expect(r.atRisk).toBe(true);
    expect(r.reason).toContain('15.0%');
  });

  it('escalates to CRITICAL at ≥ 2× threshold', () => {
    expect(priceDropRisk(10000n, 7000n, 10).severity).toBe('CRITICAL'); // 30% drop
  });

  it('no flag below threshold', () => {
    expect(priceDropRisk(10000n, 9500n, 10).atRisk).toBe(false); // 5% drop
  });

  it('no prior price → no flag', () => {
    expect(priceDropRisk(0n, 5000n).atRisk).toBe(false);
  });
});

describe('THI heat-stress rule (slice 11.7)', () => {
  it('computes THI = 0.8T + (RH/100)(T − 14.4) + 46.4', () => {
    expect(thi(38, 70)).toBeCloseTo(93.32, 2);
    expect(thi(30, 40)).toBeCloseTo(76.64, 2);
  });

  it('bands cattle at 75/79/84 and poultry at 72/78 (documented sources)', () => {
    expect(thiBands(71.9)).toEqual({ cattle: 'none', poultry: 'none' });
    expect(thiBands(72)).toEqual({ cattle: 'none', poultry: 'alert' });
    expect(thiBands(75)).toEqual({ cattle: 'alert', poultry: 'alert' });
    expect(thiBands(78)).toEqual({ cattle: 'alert', poultry: 'danger' });
    expect(thiBands(79)).toEqual({ cattle: 'danger', poultry: 'danger' });
    expect(thiBands(84)).toEqual({ cattle: 'emergency', poultry: 'danger' });
  });

  it('poultry-only alert band → WARNING, reason mentions poultry only', () => {
    const r = thiHeatStressRisk(28, 30); // THI 72.9
    expect(r).toMatchObject({ atRisk: true, severity: 'WARNING', thi: 72.9 });
    expect(r.reason).toContain('poultry: alert');
    expect(r.reason).not.toContain('cattle');
  });

  it('alert band → WARNING with ventilation/water advice', () => {
    const r = thiHeatStressRisk(30, 40); // THI 76.6 — both species alert
    expect(r.severity).toBe('WARNING');
    expect(r.reason).toContain('THI 76.6');
    expect(r.reason).toContain('cattle: alert');
    expect(r.reason).toContain('ventilation');
  });

  it('danger band → CRITICAL with fans/feeding-time advice', () => {
    const r = thiHeatStressRisk(32, 50); // THI 80.8 — both species danger
    expect(r.severity).toBe('CRITICAL');
    expect(r.reason).toContain('cattle: danger');
    expect(r.reason).toContain('early morning');
  });

  it('emergency band → CRITICAL with suspend-handling advice; hi locale is translated', () => {
    const en = thiHeatStressRisk(38, 70); // THI 93.3
    expect(en.severity).toBe('CRITICAL');
    expect(en.reason).toContain('Heat stress: THI 93.3');
    expect(en.reason).toContain('cattle: emergency');
    expect(en.reason).toContain('suspend handling');

    const hi = thiHeatStressRisk(38, 70, 'hi');
    expect(hi.severity).toBe('CRITICAL');
    expect(hi.reason).toContain('THI 93.3');
    expect(hi.reason).toContain('गर्मी का तनाव');
    expect(hi.reason).toContain('मवेशी: आपातकाल');
  });

  it('below every threshold → no risk (localized ok text)', () => {
    expect(thiHeatStressRisk(25, 30).atRisk).toBe(false); // THI 69.6
    expect(thiHeatStressRisk(25, 30, 'hi').reason).toContain('THI 69.6');
  });

  it('evaluateHeatRisk uses THI with humidity and falls back without it', () => {
    expect(evaluateHeatRisk(30, 40).thi).toBeCloseTo(76.6, 1);
    const fallback = evaluateHeatRisk(39, null);
    expect(fallback.thi).toBeUndefined();
    expect(fallback).toMatchObject({ atRisk: true, severity: 'CRITICAL' });
    expect(fallback.reason).toBe(heatStressRisk(39, null).reason);
  });
});

describe('mortality-spike rule (slice 11.7)', () => {
  it('no deaths → no risk', () => {
    expect(mortalitySpikeRisk({ deaths24h: 0, currentCount: 100, batchCode: 'B-1' }).atRisk).toBe(false);
  });

  it('exactly 2% of the pre-death population → no risk (> is strict)', () => {
    expect(mortalitySpikeRisk({ deaths24h: 2, currentCount: 98, batchCode: 'B-1' }).atRisk).toBe(false);
  });

  it('>2% → WARNING with numbers + batch code', () => {
    const r = mortalitySpikeRisk({ deaths24h: 3, currentCount: 97, batchCode: 'B-42' });
    expect(r).toMatchObject({ atRisk: true, severity: 'WARNING' });
    expect(r.reason).toContain('B-42');
    expect(r.reason).toContain('3 deaths');
    expect(r.reason).toContain('3.0%');
    expect(r.reason).toContain('100');
  });

  it('>5% → CRITICAL; hi locale is translated', () => {
    const r = mortalitySpikeRisk({ deaths24h: 6, currentCount: 94, batchCode: 'B-42', locale: 'hi' });
    expect(r).toMatchObject({ atRisk: true, severity: 'CRITICAL' });
    expect(r.reason).toContain('B-42');
    expect(r.reason).toContain('मृत्यु दर में उछाल');
    expect(r.reason).toContain('6.0%');
  });
});
