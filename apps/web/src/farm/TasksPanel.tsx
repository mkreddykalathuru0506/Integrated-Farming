import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import { completeTask, createSchedule, generateTasks, listTasks, type Task } from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; tasks: Task[] };
const TASK_TYPES = ['FEEDING', 'CLEANING', 'EGG_COLLECTION', 'HEALTH_CHECK', 'WEIGHING', 'TEMPERATURE_LOG', 'OTHER'] as const;
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
const today = () => new Date().toISOString().slice(0, 10);

export function TasksPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [name, setName] = useState('');
  const [taskType, setTaskType] = useState<string>('FEEDING');
  const [frequency, setFrequency] = useState<string>('DAILY');

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    listTasks(accessToken, farmId, today())
      .then((r) => setLoad({ status: 'ready', tasks: r.tasks }))
      .catch(() => setLoad({ status: 'error' }));
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  const run = (p: Promise<unknown>) => void p.then(refresh).catch(() => undefined);

  async function onAddSchedule(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await createSchedule(accessToken, farmId, { name, taskType, frequency })
      .then(() => {
        setName('');
        return generateTasks(accessToken, farmId, today());
      })
      .then(refresh)
      .catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('tasks.title')}</h2>
        {canWrite && accessToken && (
          <Button size="sm" variant="secondary" onClick={() => run(generateTasks(accessToken, farmId, today()))}>
            {t('tasks.generate')}
          </Button>
        )}
      </div>

      {load.status === 'loading' && <p className="text-sm text-slate-500">{t('tasks.loading')}</p>}
      {load.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {t('tasks.error')}
        </p>
      )}
      {load.status === 'ready' && load.tasks.length === 0 && (
        <p className="text-sm text-slate-500">{t('tasks.empty')}</p>
      )}
      {load.status === 'ready' && load.tasks.length > 0 && (
        <ul className="space-y-2">
          {load.tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-slate-800">{task.title}</p>
                <p className="text-xs text-slate-500">{t(`tasks.status.${task.status}`)}</p>
              </div>
              {task.status === 'PENDING' && accessToken && (
                <Button size="sm" onClick={() => run(completeTask(accessToken, farmId, task.id))}>
                  {t('tasks.complete')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onAddSchedule} className="space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{t('tasks.addSchedule')}</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('tasks.scheduleName')} required />
          <div className="flex gap-2">
            <Select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="flex-1">
              {TASK_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {t(`tasks.taskType.${tt}`)}
                </option>
              ))}
            </Select>
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="flex-1">
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {t(`tasks.frequency.${f}`)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" full>
            {t('tasks.addSchedule')}
          </Button>
        </form>
      )}
    </section>
  );
}
