import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import {
  createAnimal,
  listAnimals,
  listSpecies,
  listUnits,
  recordMortality,
  recordMovement,
  type Animal,
  type SpeciesSummary,
  type Unit,
} from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; animals: Animal[] };
const SEXES = ['UNKNOWN', 'FEMALE', 'MALE'] as const;

export function AnimalsPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [indivSpecies, setIndivSpecies] = useState<SpeciesSummary[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [speciesId, setSpeciesId] = useState('');
  const [tag, setTag] = useState('');
  const [sex, setSex] = useState<string>('UNKNOWN');
  const [formError, setFormError] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    listAnimals(accessToken, farmId)
      .then((r) => setLoad({ status: 'ready', animals: r.animals }))
      .catch(() => setLoad({ status: 'error' }));
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  useEffect(() => {
    if (!accessToken) return;
    listSpecies(accessToken, farmId)
      .then((r) => {
        const indiv = r.species.filter((s) => s.trackingMode === 'INDIVIDUAL');
        setIndivSpecies(indiv);
        setSpeciesId((prev) => prev || indiv[0]?.id || '');
      })
      .catch(() => undefined);
    listUnits(accessToken, farmId)
      .then((r) => setUnits(r.units))
      .catch(() => undefined);
  }, [accessToken, farmId]);

  const act = (p: Promise<unknown>) => void p.then(refresh).catch(() => undefined);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setFormError(null);
    try {
      await createAnimal(accessToken, farmId, { speciesId, tagNumber: tag || undefined, sex });
      setTag('');
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error && err.message === 'ANIMAL_TAG_TAKEN' ? t('animals.duplicate') : t('animals.addError'),
      );
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('animals.title')}</h2>

      {load.status === 'loading' && <p className="text-sm text-slate-500">{t('animals.loading')}</p>}
      {load.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {t('animals.error')}
        </p>
      )}
      {load.status === 'ready' && load.animals.length === 0 && (
        <p className="text-sm text-slate-500">{t('animals.empty')}</p>
      )}
      {load.status === 'ready' && load.animals.length > 0 && (
        <ul className="space-y-2">
          {load.animals.map((a) => (
            <li key={a.id} className="space-y-2 rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center gap-3">
                {a.qrCode && (
                  <QRCodeSVG value={a.qrCode} size={48} className="shrink-0" aria-label={a.qrCode} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">
                    {a.tagNumber ?? a.name ?? a.qrCode}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {a.species.name} · {a.currentStage?.name ?? '—'} · {t(`animals.status.${a.status}`)}
                  </p>
                </div>
              </div>

              {canWrite && a.status === 'ACTIVE' && accessToken && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                  <Button size="sm" variant="danger" onClick={() => act(recordMortality(accessToken, farmId, { animalId: a.id, type: 'CULL' }))}>
                    {t('events.cull')}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => act(recordMortality(accessToken, farmId, { animalId: a.id, type: 'MORTALITY' }))}>
                    {t('events.dead')}
                  </Button>
                  <Select value={moveTo[a.id] ?? ''} onChange={(e) => setMoveTo({ ...moveTo, [a.id]: e.target.value })} className="flex-1">
                    <option value="">{t('events.moveTo')}</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="secondary" disabled={!moveTo[a.id]} onClick={() => act(recordMovement(accessToken, farmId, { animalId: a.id, toUnitId: moveTo[a.id]! }))}>
                    {t('events.move')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && indivSpecies.length > 0 && (
        <form onSubmit={onAdd} className="space-y-2 rounded-lg bg-slate-50 p-3">
          <Select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)}>
            {indivSpecies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t('animals.tag')} required />
          <Select value={sex} onChange={(e) => setSex(e.target.value)}>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {t(`animals.sex.${s}`)}
              </option>
            ))}
          </Select>
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <Button type="submit" full>
            {t('animals.add')}
          </Button>
        </form>
      )}
    </section>
  );
}
