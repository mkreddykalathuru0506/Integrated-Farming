import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UNIT_TYPES } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import { createUnit, deleteUnit, listUnits, type Unit } from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; units: Unit[] };

export function UnitsPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [name, setName] = useState('');
  const [type, setType] = useState<string>(UNIT_TYPES[0]);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    listUnits(accessToken, farmId)
      .then((r) => setLoad({ status: 'ready', units: r.units }))
      .catch(() => setLoad({ status: 'error' }));
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setFormError(null);
    try {
      await createUnit(accessToken, farmId, { name, type });
      setName('');
      refresh();
    } catch (err) {
      setFormError(
        err instanceof Error && err.message === 'UNIT_NAME_TAKEN'
          ? t('units.duplicate')
          : t('units.addError'),
      );
    }
  }

  async function onDelete(id: string) {
    if (!accessToken) return;
    await deleteUnit(accessToken, farmId, id)
      .then(refresh)
      .catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        {t('units.title')}
      </h2>

      {load.status === 'loading' && <p className="text-sm text-slate-500">{t('units.loading')}</p>}
      {load.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {t('units.error')}
        </p>
      )}
      {load.status === 'ready' && load.units.length === 0 && (
        <p className="text-sm text-slate-500">{t('units.empty')}</p>
      )}
      {load.status === 'ready' && load.units.length > 0 && (
        <ul className="space-y-2">
          {load.units.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
            >
              <span className="text-slate-800">
                {u.name} <span className="text-xs text-slate-400">· {t(`unitTypes.${u.type}`)}</span>
              </span>
              {canWrite && (
                <Button variant="danger" size="sm" onClick={() => void onDelete(u.id)}>
                  {t('common.delete')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onAdd} className="space-y-2 rounded-lg bg-slate-50 p-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('units.namePlaceholder')}
            required
          />
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {UNIT_TYPES.map((ut) => (
              <option key={ut} value={ut}>
                {t(`unitTypes.${ut}`)}
              </option>
            ))}
          </Select>
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <Button type="submit" full>
            {t('units.add')}
          </Button>
        </form>
      )}
    </section>
  );
}
