/**
 * WeatherProvider adapter (Brief §7). Open-Meteo is free + keyless (decision #5).
 * Default impl is the Mock so tests/CI never hit the network; the live impl is opt-in
 * via WEATHER_PROVIDER=open-meteo. Always surfaces a `source` + `observedAt` so the UI
 * can show "as of <ts>, source <x>".
 */
export type WeatherObservation = {
  tempC: number;
  humidityPct: number | null;
  condition: string | null;
  observedAt: Date;
  source: string;
};

export interface WeatherProvider {
  readonly name: string;
  getCurrent(lat: number, lon: number): Promise<WeatherObservation>;
}

/** Deterministic mock — used in tests/CI and as the graceful fallback. */
export class MockWeatherProvider implements WeatherProvider {
  readonly name = 'mock';
  constructor(private readonly fixed?: Partial<WeatherObservation>) {}
  async getCurrent(): Promise<WeatherObservation> {
    return {
      tempC: this.fixed?.tempC ?? 38,
      humidityPct: this.fixed?.humidityPct ?? 70,
      condition: this.fixed?.condition ?? 'Clear',
      observedAt: this.fixed?.observedAt ?? new Date('2026-06-23T06:00:00.000Z'),
      source: 'mock',
    };
  }
}

/** Live Open-Meteo (free, no API key). Only used when WEATHER_PROVIDER=open-meteo. */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly name = 'open-meteo';
  async getCurrent(lat: number, lon: number): Promise<WeatherObservation> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const body = (await res.json()) as {
      current?: { time?: string; temperature_2m?: number; relative_humidity_2m?: number; weather_code?: number };
    };
    const c = body.current;
    if (!c || typeof c.temperature_2m !== 'number') throw new Error('open-meteo: malformed response');
    return {
      tempC: c.temperature_2m,
      humidityPct: typeof c.relative_humidity_2m === 'number' ? c.relative_humidity_2m : null,
      condition: c.weather_code !== undefined ? `code ${c.weather_code}` : null,
      observedAt: c.time ? new Date(c.time) : new Date(),
      source: 'open-meteo',
    };
  }
}

/** Provider selection: mock unless explicitly opted into a live provider via env. */
export function makeWeatherProvider(): WeatherProvider {
  if (process.env.NODE_ENV !== 'test' && process.env.WEATHER_PROVIDER === 'open-meteo') {
    return new OpenMeteoWeatherProvider();
  }
  return new MockWeatherProvider();
}
