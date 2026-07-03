import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, PanelHeading, PanelNote, Select } from '../ui';
import {
  createAsset,
  createMaintenanceSchedule,
  listAssets,
  maintenanceReminders,
  recordMaintenance,
  type Asset,
  type MaintReminder,
} from './api';

const ASSET_TYPES = ['EQUIPMENT', 'VEHICLE', 'MACHINERY', 'BUILDING', 'TOOL', 'OTHER'] as const;

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export function AssetsPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [due, setDue] = useState<MaintReminder[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('EQUIPMENT');
  // per-asset service-schedule inputs
  const [schedName, setSchedName] = useState<Record<string, string>>({});
  const [schedDays, setSchedDays] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listAssets(accessToken, farmId).then((r) => setAssets(r.assets)).catch(() => undefined);
    maintenanceReminders(accessToken, farmId).then((r) => setDue(r.due)).catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await createAsset(accessToken, farmId, { name, type })
      .then(() => {
        setName('');
        refresh();
      })
      .catch(() => undefined);
  }

  async function onSchedule(assetId: string) {
    if (!accessToken) return;
    const nm = schedName[assetId];
    const days = Number(schedDays[assetId]);
    if (!nm || !days) return;
    await createMaintenanceSchedule(accessToken, farmId, assetId, {
      name: nm,
      intervalDays: days,
      nextDueDate: new Date(Date.now() + days * 86_400_000).toISOString(),
    })
      .then(() => {
        setSchedName((p) => ({ ...p, [assetId]: '' }));
        setSchedDays((p) => ({ ...p, [assetId]: '' }));
        refresh();
      })
      .catch(() => undefined);
  }

  async function onService(assetId: string, scheduleId: string) {
    if (!accessToken) return;
    await recordMaintenance(accessToken, farmId, assetId, { scheduleId, type: 'SERVICE' }).then(refresh).catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('assets.title')}</PanelHeading>

      {due.length > 0 && (
        <div className="rounded-xl bg-warning/12 p-3 text-sm text-warning">
          {t('assets.dueReminder', { count: due.length })}
        </div>
      )}

      {assets.length === 0 ? (
        <PanelNote>{t('assets.empty')}</PanelNote>
      ) : (
        <ul className="space-y-2 text-sm">
          {assets.slice(0, 8).map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{a.name}</span>
                <span className="text-xs text-muted-foreground">{t(`assets.type.${a.type}`)}</span>
              </div>
              {a.schedules.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {a.schedules.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-xs text-muted-foreground tabular">
                      <span>
                        {s.name} · {t('assets.due')} {fmtDate(s.nextDueDate)}
                      </span>
                      {canWrite && (
                        <button type="button" onClick={() => void onService(a.id, s.id)} className="font-semibold text-success hover:underline">
                          {t('assets.markServiced')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canWrite && (
                <div className="mt-2 flex gap-2">
                  <Input
                    value={schedName[a.id] ?? ''}
                    onChange={(e) => setSchedName((p) => ({ ...p, [a.id]: e.target.value }))}
                    placeholder={t('assets.schedName')}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={schedDays[a.id] ?? ''}
                    onChange={(e) => setSchedDays((p) => ({ ...p, [a.id]: e.target.value }))}
                    placeholder={t('assets.everyDays')}
                    className="w-24"
                  />
                  <Button type="button" variant="secondary" onClick={() => void onSchedule(a.id)}>
                    {t('assets.schedule')}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onCreate} className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <p className="text-xs text-muted-foreground">{t('assets.add')}</p>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('assets.name')} required className="flex-1" />
            <Select value={type} onChange={(e) => setType(e.target.value)} className="w-36">
              {ASSET_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`assets.type.${tp}`)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" full variant="secondary">
            {t('assets.addBtn')}
          </Button>
        </form>
      )}
    </section>
  );
}
