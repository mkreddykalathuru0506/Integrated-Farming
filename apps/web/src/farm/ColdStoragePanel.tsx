import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, PanelHeading, PanelNote, Select } from '../ui';
import {
  createColdStorage,
  listColdStorages,
  recordTemp,
  type ColdStorage,
} from './api';

export function ColdStoragePanel({
  farmId,
  canWrite,
  canLog,
}: {
  farmId: string;
  canWrite: boolean;
  canLog: boolean;
}) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [stores, setStores] = useState<ColdStorage[]>([]);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'FRESH' | 'FROZEN'>('FROZEN');
  const [temps, setTemps] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listColdStorages(accessToken, farmId).then((r) => setStores(r.stores)).catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await createColdStorage(accessToken, farmId, { name, mode })
      .then(() => {
        setName('');
        refresh();
      })
      .catch(() => undefined);
  }

  async function onLogTemp(id: string) {
    if (!accessToken) return;
    const raw = temps[id];
    if (raw === undefined || raw === '') return;
    await recordTemp(accessToken, farmId, id, { temperatureC: Number(raw) })
      .then(() => {
        setTemps((p) => ({ ...p, [id]: '' }));
        refresh();
      })
      .catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('cold.title')}</PanelHeading>

      {stores.length === 0 ? (
        <PanelNote>{t('cold.empty')}</PanelNote>
      ) : (
        <ul className="space-y-2 text-sm">
          {stores.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="text-xs text-muted-foreground tabular">
                  {t(`cold.mode.${s.mode}`)} · {s.minTempC}…{s.maxTempC}°C
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                {s.latest ? (
                  <span className={s.latest.isOutOfRange ? 'font-semibold text-destructive tabular' : 'text-muted-foreground tabular'}>
                    {s.latest.temperatureC}°C {s.latest.isOutOfRange ? `· ${t('cold.outOfRange')}` : `· ${t('cold.ok')}`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t('cold.noReading')}</span>
                )}
                {s.breachCount > 0 && (
                  <span className="text-xs text-destructive tabular">{t('cold.breaches', { count: s.breachCount })}</span>
                )}
              </div>
              {canLog && (
                <div className="mt-2 flex gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    value={temps[s.id] ?? ''}
                    onChange={(e) => setTemps((p) => ({ ...p, [s.id]: e.target.value }))}
                    placeholder={t('cold.tempC')}
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" onClick={() => void onLogTemp(s.id)}>
                    {t('cold.logTemp')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onCreate} className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <p className="text-xs text-muted-foreground">{t('cold.add')}</p>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('cold.name')} required className="flex-1" />
            <Select value={mode} onChange={(e) => setMode(e.target.value as 'FRESH' | 'FROZEN')} className="w-32">
              <option value="FROZEN">{t('cold.mode.FROZEN')}</option>
              <option value="FRESH">{t('cold.mode.FRESH')}</option>
            </Select>
          </div>
          <Button type="submit" full variant="secondary">
            {t('cold.addBtn')}
          </Button>
        </form>
      )}
    </section>
  );
}
