import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { UNIT_TYPES } from '@ifm/shared';
import { useCreateUnit, useDeleteUnit, useUnits } from '../api/hooks';
import { Button, DataRow, Input, PanelError, PanelHeading, PanelNote, Select } from '../ui';

// First panel on the TanStack Query pattern (reference for the 11.6 sweep):
// queries via useUnits(), mutations via useApiMutation hooks (toasts +
// invalidation handled centrally). farmId now comes from FarmProvider.
export function UnitsPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const units = useUnits();
  const createUnit = useCreateUnit();
  const deleteUnit = useDeleteUnit();
  const [name, setName] = useState('');
  const [type, setType] = useState<string>(UNIT_TYPES[0]);

  function onAdd(e: FormEvent) {
    e.preventDefault();
    createUnit.mutate({ name, type }, { onSuccess: () => setName('') });
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('units.title')}</PanelHeading>

      {units.isPending && <PanelNote>{t('units.loading')}</PanelNote>}
      {units.isError && <PanelError>{t('units.error')}</PanelError>}
      {units.data && units.data.length === 0 && <PanelNote>{t('units.empty')}</PanelNote>}
      {units.data && units.data.length > 0 && (
        <ul className="space-y-2">
          {units.data.map((u) => (
            <DataRow key={u.id}>
              <span className="text-foreground">
                {u.name} <span className="text-xs text-muted-foreground">· {t(`unitTypes.${u.type}`)}</span>
              </span>
              {canWrite && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deleteUnit.isPending}
                  onClick={() => deleteUnit.mutate(u.id)}
                >
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
          <Button type="submit" full disabled={createUnit.isPending}>
            {createUnit.isPending ? t('common.saving') : t('units.add')}
          </Button>
        </form>
      )}
    </section>
  );
}
