import { describe, it, expect } from 'vitest';
import { heatStressRisk, priceDropRisk } from '../src/intelligence/rules';

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
