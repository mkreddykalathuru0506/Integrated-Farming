import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, PanelError, PanelHeading, PanelNote, Select } from '../ui';
import {
  createHatchery,
  listHatchery,
  listSpecies,
  updateHatchery,
  type HatcheryBatch,
  type SpeciesSummary,
} from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; batches: HatcheryBatch[] };
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString() : '—');

export function HatcheryPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [species, setSpecies] = useState<SpeciesSummary[]>([]);
  const [speciesId, setSpeciesId] = useState('');
  const [code, setCode] = useState('');
  const [setDate, setSetDate] = useState('');
  const [eggs, setEggs] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [hatched, setHatched] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    listHatchery(accessToken, farmId)
      .then((r) => setLoad({ status: 'ready', batches: r.batches }))
      .catch(() => setLoad({ status: 'error' }));
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!accessToken) return;
    listSpecies(accessToken, farmId)
      .then((r) => {
        setSpecies(r.species);
        setSpeciesId((prev) => prev || r.species.find((s) => s.code === 'CHICKEN')?.id || r.species[0]?.id || '');
      })
      .catch(() => undefined);
  }, [accessToken, farmId]);

  async function onSet(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !setDate) return;
    setFormError(null);
    try {
      await createHatchery(accessToken, farmId, { speciesId, code, setDate: `${setDate}T00:00:00.000Z`, eggCount: Number(eggs) });
      setCode('');
      setEggs('');
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error && err.message === 'NO_INCUBATION_DAYS' ? t('hatchery.noIncubation') : t('hatchery.addError'),
      );
    }
  }

  async function recordHatch(b: HatcheryBatch) {
    if (!accessToken) return;
    const n = Number(hatched[b.id] ?? '');
    if (!n) return;
    await updateHatchery(accessToken, farmId, b.id, { status: 'HATCHED', hatchedCount: n }).then(refresh).catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('hatchery.title')}</PanelHeading>

      {load.status === 'loading' && <PanelNote>{t('hatchery.loading')}</PanelNote>}
      {load.status === 'error' && <PanelError>{t('hatchery.error')}</PanelError>}
      {load.status === 'ready' && load.batches.length === 0 && <PanelNote>{t('hatchery.empty')}</PanelNote>}
      {load.status === 'ready' && load.batches.length > 0 && (
        <ul className="space-y-2">
          {load.batches.map((b) => (
            <li key={b.id} className="space-y-1 rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">
                  {b.code} <span className="text-xs text-muted-foreground tabular">· {b.eggCount} eggs · {t(`hatchery.status.${b.status}`)}</span>
                </span>
                {b.hatchedCount != null && <span className="text-xs text-success tabular">{t('hatchery.rate', { rate: b.hatchRate })}</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('hatchery.set')} {d(b.setDate)} → {t('hatchery.candle')} {d(b.candlingDate)} → {t('hatchery.lockdown')}{' '}
                {d(b.lockdownDate)} → {t('hatchery.hatch')} {d(b.expectedHatchDate)}
              </p>
              {canWrite && b.status !== 'HATCHED' && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="number"
                    min={0}
                    value={hatched[b.id] ?? ''}
                    onChange={(e) => setHatched({ ...hatched, [b.id]: e.target.value })}
                    placeholder={t('hatchery.hatchedCount')}
                    className="w-28"
                  />
                  <Button size="sm" onClick={() => void recordHatch(b)}>
                    {t('hatchery.recordHatch')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && species.length > 0 && (
        <form onSubmit={onSet} className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <Select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)}>
            {species.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('hatchery.code')} required />
          <div className="flex gap-2">
            <Input type="date" value={setDate} onChange={(e) => setSetDate(e.target.value)} required className="flex-1" />
            <Input type="number" min={1} value={eggs} onChange={(e) => setEggs(e.target.value)} placeholder={t('hatchery.eggCount')} required className="flex-1" />
          </div>
          {formError && <PanelError>{formError}</PanelError>}
          <Button type="submit" full>
            {t('hatchery.setEggs')}
          </Button>
        </form>
      )}
    </section>
  );
}
