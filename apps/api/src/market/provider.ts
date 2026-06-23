/**
 * MarketRateProvider adapter (Brief §7, decision #4). Live source = Agmarknet/data.gov.in,
 * which needs a FREE api key (a credential, not a payment). The live impl is a stub that is
 * inert unless MARKET_API_KEY is set — no key is committed, and CI/tests use the Mock.
 * Manual entry is the primary path; this provider is the optional "pull live" convenience.
 */
export type MarketObservation = {
  commodity: string;
  market: string | null;
  pricePaise: bigint;
  unit: string;
  observedAt: Date;
  source: string;
};

export interface MarketRateProvider {
  readonly name: string;
  getRate(commodity: string, market?: string): Promise<MarketObservation>;
}

/** Deterministic mock — used in tests/CI and as the graceful fallback. */
export class MockMarketRateProvider implements MarketRateProvider {
  readonly name = 'mock';
  constructor(private readonly pricePaise = 4500000n) {} // ₹45,000 / unit
  async getRate(commodity: string, market?: string): Promise<MarketObservation> {
    return {
      commodity,
      market: market ?? 'Mock Mandi',
      pricePaise: this.pricePaise,
      unit: 'quintal',
      observedAt: new Date('2026-06-23T00:00:00.000Z'),
      source: 'mock',
    };
  }
}

/** Live data.gov.in/Agmarknet stub — only active when MARKET_API_KEY is configured. */
export class DataGovMarketRateProvider implements MarketRateProvider {
  readonly name = 'agmarknet';
  constructor(private readonly apiKey: string) {}
  async getRate(commodity: string, market?: string): Promise<MarketObservation> {
    // Owner-gated: wiring the real data.gov.in resource is a follow-up (needs the free key
    // in env). Until then this throws so callers fall back to the mock / manual entry.
    void this.apiKey;
    void market;
    throw new Error('agmarknet provider not configured');
  }
}

/** Provider selection: mock unless a live provider is explicitly configured via env. */
export function makeMarketRateProvider(): MarketRateProvider {
  if (process.env.NODE_ENV !== 'test' && process.env.MARKET_PROVIDER === 'agmarknet' && process.env.MARKET_API_KEY) {
    return new DataGovMarketRateProvider(process.env.MARKET_API_KEY);
  }
  return new MockMarketRateProvider();
}
