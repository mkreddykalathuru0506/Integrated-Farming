import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, DataRow, PanelHeading, PanelNote } from '../ui';
import { acknowledgeRisk, getWeather, listRisks, type RiskFlag, type Weather } from './api';

const SEVERITY_CLASS: Record<string, string> = {
  CRITICAL: 'text-destructive',
  WARNING: 'text-warning',
  INFO: 'text-muted-foreground',
};

function fmtTs(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function WeatherPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [risks, setRisks] = useState<RiskFlag[]>([]);
  const [needsLocation, setNeedsLocation] = useState(false);

  const loadRisks = useCallback(() => {
    if (!accessToken) return;
    listRisks(accessToken, farmId).then((r) => setRisks(r.risks)).catch(() => undefined);
  }, [accessToken, farmId]);

  const loadWeather = useCallback(
    (refresh = false) => {
      if (!accessToken) return;
      getWeather(accessToken, farmId, refresh)
        .then((w) => {
          setWeather(w);
          setNeedsLocation(false);
          loadRisks();
        })
        .catch((err: Error) => {
          if (err.message === 'LOCATION_REQUIRED') setNeedsLocation(true);
        });
    },
    [accessToken, farmId, loadRisks],
  );

  useEffect(() => {
    loadWeather(false);
    loadRisks();
  }, [loadWeather, loadRisks]);

  async function onAck(id: string) {
    if (!accessToken) return;
    await acknowledgeRisk(accessToken, farmId, id).then(loadRisks).catch(() => undefined);
  }

  const openRisks = risks.filter((r) => r.status === 'OPEN');

  return (
    <section className="space-y-3">
      <PanelHeading>{t('weather.title')}</PanelHeading>

      {needsLocation ? (
        <PanelNote>{t('weather.needLocation')}</PanelNote>
      ) : weather ? (
        <div className="rounded-xl bg-accent/10 p-3 text-sm">
          <p className="text-lg font-semibold text-accent tabular">
            {weather.weather.tempC}°C
            {weather.weather.humidityPct !== null ? ` · ${weather.weather.humidityPct}% RH` : ''}
          </p>
          <p className="text-xs text-accent">
            {t('weather.asOf', { ts: fmtTs(weather.weather.fetchedAt), source: weather.weather.source })}
          </p>
          {canWrite && (
            <Button type="button" variant="secondary" onClick={() => loadWeather(true)} className="mt-2">
              {t('weather.refresh')}
            </Button>
          )}
        </div>
      ) : (
        <PanelNote>{t('weather.loading')}</PanelNote>
      )}

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">{t('weather.alerts')}</p>
        {openRisks.length === 0 ? (
          <PanelNote>{t('weather.noAlerts')}</PanelNote>
        ) : (
          <ul className="space-y-1 text-sm">
            {openRisks.map((r) => (
              <DataRow key={r.id} className="items-start gap-2 py-1.5">
                <span>
                  <span className={`font-semibold ${SEVERITY_CLASS[r.severity] ?? ''}`}>{t(`risk.type.${r.type}`)}</span>
                  <span className="block text-xs text-muted-foreground">{r.reason}</span>
                </span>
                {canWrite && (
                  <button type="button" onClick={() => void onAck(r.id)} className="shrink-0 text-xs font-semibold text-success hover:underline">
                    {t('weather.ack')}
                  </button>
                )}
              </DataRow>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
