import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import {
  createBreeding,
  listBreeding,
  listSpecies,
  updateBreeding,
  type BreedingRecord,
  type SpeciesSummary,
} from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; records: BreedingRecord[] };
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

export function BreedingPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [species, setSpecies] = useState<SpeciesSummary[]>([]);
  const [speciesId, setSpeciesId] = useState('');
  const [date, setDate] = useState('');
  const [nameById, setNameById] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    listBreeding(accessToken, farmId)
      .then((r) => setLoad({ status: 'ready', records: r.records }))
      .catch(() => setLoad({ status: 'error' }));
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!accessToken) return;
    listSpecies(accessToken, farmId)
      .then((r) => {
        setSpecies(r.species);
        setNameById(Object.fromEntries(r.species.map((s) => [s.id, s.name])));
        setSpeciesId((prev) => prev || r.species.find((s) => s.trackingMode === 'INDIVIDUAL')?.id || r.species[0]?.id || '');
      })
      .catch(() => undefined);
  }, [accessToken, farmId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !date) return;
    await createBreeding(accessToken, farmId, { speciesId, breedingDate: `${date}T00:00:00.000Z` })
      .then(() => {
        setDate('');
        refresh();
      })
      .catch(() => undefined);
  }

  async function complete(id: string) {
    if (!accessToken) return;
    await updateBreeding(accessToken, farmId, id, { status: 'COMPLETED' }).then(refresh).catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('breeding.title')}</h2>

      {load.status === 'loading' && <p className="text-sm text-slate-500">{t('breeding.loading')}</p>}
      {load.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {t('breeding.error')}
        </p>
      )}
      {load.status === 'ready' && load.records.length === 0 && (
        <p className="text-sm text-slate-500">{t('breeding.empty')}</p>
      )}
      {load.status === 'ready' && load.records.length > 0 && (
        <ul className="space-y-2">
          {load.records.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate text-slate-800">
                  {r.speciesId ? (nameById[r.speciesId] ?? '—') : '—'} · {t(`breeding.status.${r.status}`)}
                </p>
                <p className="text-xs text-slate-500">
                  {t('breeding.due')}: {fmt(r.expectedDueDate)}
                </p>
              </div>
              {canWrite && r.status !== 'COMPLETED' && (
                <Button size="sm" variant="secondary" onClick={() => void complete(r.id)}>
                  {t('breeding.complete')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && species.length > 0 && (
        <form onSubmit={onAdd} className="space-y-2 rounded-lg bg-slate-50 p-3">
          <Select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)}>
            {species.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="flex-1" />
            <Button type="submit">{t('breeding.record')}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
