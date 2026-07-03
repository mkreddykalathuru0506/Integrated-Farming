import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, DataRow, Input, PanelError, PanelHeading, PanelNote, Select } from '../ui';
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
      <PanelHeading
        action={
          canWrite && accessToken ? (
            <Button size="sm" variant="secondary" onClick={() => run(generateTasks(accessToken, farmId, today()))}>
              {t('tasks.generate')}
            </Button>
          ) : undefined
        }
      >
        {t('tasks.title')}
      </PanelHeading>

      {load.status === 'loading' && <PanelNote>{t('tasks.loading')}</PanelNote>}
      {load.status === 'error' && <PanelError>{t('tasks.error')}</PanelError>}
      {load.status === 'ready' && load.tasks.length === 0 && <PanelNote>{t('tasks.empty')}</PanelNote>}
      {load.status === 'ready' && load.tasks.length > 0 && (
        <ul className="space-y-2">
          {load.tasks.map((task) => (
            <DataRow key={task.id}>
              <div className="min-w-0">
                <p className="truncate text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">{t(`tasks.status.${task.status}`)}</p>
              </div>
              {task.status === 'PENDING' && accessToken && (
                <Button size="sm" onClick={() => run(completeTask(accessToken, farmId, task.id))}>
                  {t('tasks.complete')}
                </Button>
              )}
            </DataRow>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={onAddSchedule} className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <p className="text-xs text-muted-foreground">{t('tasks.addSchedule')}</p>
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
