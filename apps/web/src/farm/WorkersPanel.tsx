import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, DataRow, Input, PanelError, PanelHeading, PanelNote, Select } from '../ui';
import {
  createWorker,
  listAttendance,
  listWorkers,
  markAttendance,
  type AttendanceRow,
  type Worker,
} from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; workers: Worker[] };
const WAGE_TYPES = ['DAILY', 'PIECE_RATE', 'MONTHLY'] as const;
const today = () => new Date().toISOString().slice(0, 10);

export function WorkersPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [att, setAtt] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState('');
  const [wageType, setWageType] = useState<string>('DAILY');
  const [wage, setWage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    Promise.all([listWorkers(accessToken, farmId), listAttendance(accessToken, farmId, today())])
      .then(([w, a]) => {
        setLoad({ status: 'ready', workers: w.workers });
        setAtt(Object.fromEntries(a.attendance.map((r: AttendanceRow) => [r.workerId, r.status])));
      })
      .catch(() => setLoad({ status: 'error' }));
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function mark(workerId: string, status: string) {
    if (!accessToken) return;
    await markAttendance(accessToken, farmId, { workerId, date: today(), status })
      .then(refresh)
      .catch(() => undefined);
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setFormError(null);
    try {
      await createWorker(accessToken, farmId, {
        name,
        designation: designation || undefined,
        wageType,
        dailyWageRatePaise: wage ? String(rupeesToPaise(Number(wage))) : undefined,
      });
      setName('');
      setDesignation('');
      setWage('');
      refresh();
    } catch {
      setFormError(t('workers.addError'));
    }
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('workers.title')}</PanelHeading>

      {load.status === 'loading' && <PanelNote>{t('workers.loading')}</PanelNote>}
      {load.status === 'error' && <PanelError>{t('workers.error')}</PanelError>}
      {load.status === 'ready' && load.workers.length === 0 && <PanelNote>{t('workers.empty')}</PanelNote>}
      {load.status === 'ready' && load.workers.length > 0 && (
        <ul className="space-y-2">
          {load.workers.map((w) => (
            <DataRow key={w.id}>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{w.name}</p>
                <p className="truncate text-xs text-muted-foreground tabular">
                  {w.designation ?? '—'}
                  {w.dailyWageRatePaise ? ` · ${formatPaise(Number(w.dailyWageRatePaise))}/day` : ''}
                </p>
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant={att[w.id] === 'PRESENT' ? 'primary' : 'secondary'} onClick={() => void mark(w.id, 'PRESENT')}>
                    {t('workers.present')}
                  </Button>
                  <Button size="sm" variant={att[w.id] === 'ABSENT' ? 'danger' : 'secondary'} onClick={() => void mark(w.id, 'ABSENT')}>
                    {t('workers.absent')}
                  </Button>
                </div>
              )}
            </DataRow>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onAdd} className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('workers.name')} required />
          <Input value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder={t('workers.designation')} />
          <div className="flex gap-2">
            <Select value={wageType} onChange={(e) => setWageType(e.target.value)} className="flex-1">
              {WAGE_TYPES.map((wt) => (
                <option key={wt} value={wt}>
                  {t(`workers.wageType.${wt}`)}
                </option>
              ))}
            </Select>
            <Input value={wage} onChange={(e) => setWage(e.target.value)} type="number" min={0} placeholder={t('workers.wage')} className="flex-1" />
          </div>
          {formError && <PanelError>{formError}</PanelError>}
          <Button type="submit" full>
            {t('workers.add')}
          </Button>
        </form>
      )}
    </section>
  );
}
