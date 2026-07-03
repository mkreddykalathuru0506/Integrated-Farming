import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UNIT_TYPES } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, DataRow, Input, PanelError, PanelHeading, PanelNote, Select } from '../ui';
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
      <PanelHeading>{t('units.title')}</PanelHeading>

      {load.status === 'loading' && <PanelNote>{t('units.loading')}</PanelNote>}
      {load.status === 'error' && <PanelError>{t('units.error')}</PanelError>}
      {load.status === 'ready' && load.units.length === 0 && <PanelNote>{t('units.empty')}</PanelNote>}
      {load.status === 'ready' && load.units.length > 0 && (
        <ul className="space-y-2">
          {load.units.map((u) => (
            <DataRow key={u.id}>
              <span className="text-foreground">
                {u.name} <span className="text-xs text-muted-foreground">· {t(`unitTypes.${u.type}`)}</span>
              </span>
              {canWrite && (
                <Button variant="danger" size="sm" onClick={() => void onDelete(u.id)}>
                  {t('common.delete')}
                </Button>
              )}
            </DataRow>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onAdd} className="space-y-2 rounded-xl bg-secondary/60 p-3">
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
          {formError && <PanelError>{formError}</PanelError>}
          <Button type="submit" full>
            {t('units.add')}
          </Button>
        </form>
      )}
    </section>
  );
}
