/**
 * Cold-chain gate for a dispatch (§6: fresh meat 0–7°C, frozen ≤ −18°C, refrigerated transport).
 * Returns ok=false with a machine reason when the load would break the chain.
 */
export type ColdChainInput = {
  hasFrozen: boolean;
  hasFresh: boolean;
  refrigeratedTransport: boolean;
  dispatchTempC: number | null;
};
export type ColdChainResult = { ok: boolean; reason: string | null };

export function evaluateColdChain(input: ColdChainInput): ColdChainResult {
  const requiresRefrigeration = input.hasFrozen || input.hasFresh;
  if (!requiresRefrigeration) return { ok: true, reason: null }; // e.g. live birds, no perishable product

  if (!input.refrigeratedTransport) return { ok: false, reason: 'REFRIGERATION_REQUIRED' };

  if (input.dispatchTempC !== null) {
    if (input.hasFrozen && input.dispatchTempC > -18) return { ok: false, reason: 'TEMP_TOO_WARM_FROZEN' };
    if (input.hasFresh && (input.dispatchTempC < 0 || input.dispatchTempC > 7)) {
      return { ok: false, reason: 'TEMP_OUT_OF_RANGE_FRESH' };
    }
  }
  return { ok: true, reason: null };
}
