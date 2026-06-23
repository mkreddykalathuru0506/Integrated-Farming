import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPaise, rupeesToPaise } from '@ifm/shared';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('workers.title')}</h2>

      {load.status === 'loading' && <p className="text-sm text-slate-500">{t('workers.loading')}</p>}
      {load.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {t('workers.error')}
        </p>
      )}
      {load.status === 'ready' && load.workers.length === 0 && (
        <p className="text-sm text-slate-500">{t('workers.empty')}</p>
      )}
      {load.status === 'ready' && load.workers.length > 0 && (
        <ul className="space-y-2">
          {load.workers.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{w.name}</p>
                <p className="truncate text-xs text-slate-500">
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
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onAdd} className="space-y-2 rounded-lg bg-slate-50 p-3">
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
          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}
          <Button type="submit" full>
            {t('workers.add')}
          </Button>
        </form>
      )}
    </section>
  );
}
