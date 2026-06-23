import { describe, it, expect } from 'vitest';
import { evaluateColdChain } from '../src/dispatch/calc';

describe('cold-chain dispatch gate (§6)', () => {
  it('allows a non-perishable load (no lots) without refrigeration', () => {
    expect(evaluateColdChain({ hasFrozen: false, hasFresh: false, refrigeratedTransport: false, dispatchTempC: null })).toEqual({
      ok: true,
      reason: null,
    });
  });

  it('blocks frozen product in a non-refrigerated vehicle', () => {
    const r = evaluateColdChain({ hasFrozen: true, hasFresh: false, refrigeratedTransport: false, dispatchTempC: null });
    expect(r).toEqual({ ok: false, reason: 'REFRIGERATION_REQUIRED' });
  });

  it('blocks frozen product loaded above −18°C', () => {
    const r = evaluateColdChain({ hasFrozen: true, hasFresh: false, refrigeratedTransport: true, dispatchTempC: -10 });
    expect(r).toEqual({ ok: false, reason: 'TEMP_TOO_WARM_FROZEN' });
  });

  it('allows frozen product refrigerated at −20°C', () => {
    const r = evaluateColdChain({ hasFrozen: true, hasFresh: false, refrigeratedTransport: true, dispatchTempC: -20 });
    expect(r.ok).toBe(true);
  });

  it('blocks fresh meat above 7°C', () => {
    const r = evaluateColdChain({ hasFrozen: false, hasFresh: true, refrigeratedTransport: true, dispatchTempC: 10 });
    expect(r).toEqual({ ok: false, reason: 'TEMP_OUT_OF_RANGE_FRESH' });
  });

  it('allows fresh meat refrigerated at 4°C', () => {
    expect(evaluateColdChain({ hasFrozen: false, hasFresh: true, refrigeratedTransport: true, dispatchTempC: 4 }).ok).toBe(true);
  });

  it('allows refrigerated transport when temp is not recorded', () => {
    expect(evaluateColdChain({ hasFrozen: true, hasFresh: false, refrigeratedTransport: true, dispatchTempC: null }).ok).toBe(true);
  });
});
