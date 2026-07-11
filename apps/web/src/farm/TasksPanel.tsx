import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, ListTodo, Plus, RefreshCw } from 'lucide-react';
import { useUnits } from '../api/hooks';
import {
  useCompleteTask,
  useCreateSchedule,
  useGenerateTasks,
  useSchedules,
  useTasks,
  useWorkers,
  type ScheduleRow,
  type TaskRow,
} from '../api/daily.hooks';
import { fmtDate } from '../lib/format';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PanelHeading,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
  type DataTableColumn,
} from '../ui';
import { LoadErrorNote } from './LoadErrorNote';

const TASK_TYPES = [
  'FEEDING',
  'CLEANING',
  'EGG_COLLECTION',
  'HEALTH_CHECK',
  'WEIGHING',
  'TEMPERATURE_LOG',
  'OTHER',
] as const;
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

const todayStr = () => new Date().toISOString().slice(0, 10);

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const scheduleSchema = z.object({
  name: z.string().min(1, 'tasks.form.nameRequired').max(120, 'tasks.form.nameTooLong'),
  taskType: z.string(),
  frequency: z.string(),
  timeOfDay: z.string().refine((v) => v === '' || /^\d{2}:\d{2}$/.test(v), 'tasks.form.timeInvalid'),
  unitId: z.string(),
  assignedWorkerId: z.string(),
});
type ScheduleForm = z.infer<typeof scheduleSchema>;

/**
 * Tasks panel (slice 11.6a rewrite): date navigation (prev/today/next + date
 * input), overdue emphasis, optimistic checkbox-style complete, generate with
 * a result toast, and a schedules tab (list + RHF create dialog exposing the
 * dormant timeOfDay/unit/worker fields).
 */
export function TasksPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const [date, setDate] = useState(todayStr());

  return (
    <section className="space-y-3">
      <PanelHeading>{t('tasks.title')}</PanelHeading>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">{t('tasks.tabTasks')}</TabsTrigger>
          <TabsTrigger value="schedules">{t('tasks.tabSchedules')}</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <TasksView canWrite={canWrite} date={date} onDateChange={setDate} />
        </TabsContent>

        <TabsContent value="schedules">
          <SchedulesView canWrite={canWrite} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

// ---------- tasks-for-a-day view ----------

function TasksView({
  canWrite,
  date,
  onDateChange,
}: {
  canWrite: boolean;
  date: string;
  onDateChange: (date: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const tasks = useTasks(date);
  const completeTask = useCompleteTask(date);
  const generateTasks = useGenerateTasks();

  const isPastDate = date < todayStr();
  const isOverdue = (task: TaskRow) =>
    task.status === 'MISSED' || (task.status === 'PENDING' && isPastDate);

  const columns: DataTableColumn<TaskRow>[] = [
    {
      id: 'done',
      header: 'tasks.cols.done',
      cell: (task) =>
        task.status === 'DONE' ? (
          <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('tasks.markDone', { title: task.title })}
            disabled={task.status === 'SKIPPED'}
            onClick={() => completeTask.mutate(task.id)}
          >
            <Circle aria-hidden />
          </Button>
        ),
      enableSorting: false,
    },
    {
      header: 'tasks.cols.title',
      accessor: 'title',
      cell: (task) => (
        <span className={task.status === 'DONE' ? 'text-muted-foreground line-through' : 'font-medium text-foreground'}>
          {task.title}
        </span>
      ),
    },
    { header: 'tasks.cols.type', accessor: (task) => t(`tasks.taskType.${task.taskType}`) },
    {
      header: 'tasks.cols.status',
      accessor: 'status',
      cell: (task) =>
        isOverdue(task) ? (
          <Badge variant="destructive">{t('tasks.overdue')}</Badge>
        ) : (
          <Badge
            variant={
              task.status === 'DONE' ? 'success' : task.status === 'PENDING' ? 'warning' : 'muted'
            }
          >
            {t(`tasks.status.${task.status}`)}
          </Badge>
        ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('tasks.prevDay')}
          onClick={() => onDateChange(shiftDate(date, -1))}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
          aria-label={t('tasks.date')}
          className="w-40"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('tasks.nextDay')}
          onClick={() => onDateChange(shiftDate(date, 1))}
        >
          <ChevronRight aria-hidden />
        </Button>
        {date !== todayStr() && (
          <Button type="button" variant="secondary" size="sm" onClick={() => onDateChange(todayStr())}>
            <CalendarDays aria-hidden />
            {t('tasks.today')}
          </Button>
        )}
        <span className="flex-1" />
        {canWrite && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={generateTasks.isPending}
            onClick={() =>
              generateTasks.mutate(date, {
                onSuccess: (r) =>
                  toast.success(t('tasks.generated', { generated: r.generated, missed: r.missed })),
              })
            }
          >
            <RefreshCw aria-hidden />
            {t('tasks.generate')}
          </Button>
        )}
      </div>

      {tasks.isError && !tasks.data ? (
        <LoadErrorNote
          text={t('tasks.error')}
          retryLabel={t('tasks.retry')}
          onRetry={() => void tasks.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={tasks.data}
          isLoading={tasks.isPending}
          pageSize={10}
          getRowId={(task) => task.id}
          emptyState={
            <EmptyState
              icon={ListTodo}
              title={t('tasks.empty', { date: fmtDate(`${date}T00:00:00.000Z`) })}
              description={t('tasks.emptyHint')}
              action={
                canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    loading={generateTasks.isPending}
                    onClick={() =>
                      generateTasks.mutate(date, {
                        onSuccess: (r) =>
                          toast.success(
                            t('tasks.generated', { generated: r.generated, missed: r.missed }),
                          ),
                      })
                    }
                  >
                    <RefreshCw aria-hidden />
                    {t('tasks.generate')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}
    </div>
  );
}

// ---------- schedules view ----------

function SchedulesView({ canWrite }: { canWrite: boolean }) {
  const { t } = useTranslation();
  const schedules = useSchedules();
  const [createOpen, setCreateOpen] = useState(false);

  const columns: DataTableColumn<ScheduleRow>[] = [
    {
      header: 'tasks.cols.schedule',
      accessor: 'name',
      cell: (s) => <span className="font-medium text-foreground">{s.name}</span>,
    },
    { header: 'tasks.cols.type', accessor: (s) => t(`tasks.taskType.${s.taskType}`) },
    { header: 'tasks.cols.frequency', accessor: (s) => t(`tasks.frequency.${s.frequency}`) },
    {
      header: 'tasks.cols.status',
      accessor: 'isActive',
      cell: (s) => (
        <Badge variant={s.isActive ? 'success' : 'muted'}>
          {t(s.isActive ? 'tasks.scheduleActive' : 'tasks.schedulePaused')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {canWrite && (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden />
            {t('tasks.addSchedule')}
          </Button>
        </div>
      )}

      {schedules.isError && !schedules.data ? (
        <LoadErrorNote
          text={t('tasks.schedulesError')}
          retryLabel={t('tasks.retry')}
          onRetry={() => void schedules.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={schedules.data}
          isLoading={schedules.isPending}
          pageSize={10}
          getRowId={(s) => s.id}
          emptyState={
            <EmptyState
              icon={CalendarDays}
              title={t('tasks.schedulesEmpty')}
              description={t('tasks.schedulesEmptyHint')}
              action={
                canWrite ? (
                  <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden />
                    {t('tasks.addSchedule')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      {canWrite && <CreateScheduleDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </div>
  );
}

function CreateScheduleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const createSchedule = useCreateSchedule();
  const units = useUnits();
  const workers = useWorkers();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      name: '',
      taskType: 'FEEDING',
      frequency: 'DAILY',
      timeOfDay: '',
      unitId: '',
      assignedWorkerId: '',
    },
  });

  const err = (key: keyof ScheduleForm) => {
    const message = errors[key]?.message;
    return message ? t(message) : undefined;
  };

  const onSubmit = handleSubmit((v) => {
    createSchedule.mutate(
      {
        name: v.name.trim(),
        taskType: v.taskType,
        frequency: v.frequency,
        timeOfDay: v.timeOfDay || undefined,
        unitId: v.unitId || undefined,
        assignedWorkerId: v.assignedWorkerId || undefined,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('tasks.addSchedule')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <Field label={t('tasks.form.name')} required error={err('name')}>
            <Input {...register('name')} placeholder={t('tasks.form.namePlaceholder')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('tasks.form.type')}>
              <Select {...register('taskType')}>
                {TASK_TYPES.map((tt) => (
                  <option key={tt} value={tt}>
                    {t(`tasks.taskType.${tt}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('tasks.form.frequency')}>
              <Select {...register('frequency')}>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {t(`tasks.frequency.${f}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('tasks.form.timeOfDay')} error={err('timeOfDay')} hint={t('tasks.form.optional')}>
              <Input {...register('timeOfDay')} type="time" />
            </Field>
            <Field label={t('tasks.form.unit')} hint={t('tasks.form.optional')}>
              <Select {...register('unitId')}>
                <option value="">{t('tasks.form.none')}</option>
                {(units.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t('tasks.form.worker')} hint={t('tasks.form.optional')}>
            <Select {...register('assignedWorkerId')}>
              <option value="">{t('tasks.form.none')}</option>
              {(workers.data ?? [])
                .filter((w) => w.isActive)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createSchedule.isPending}>
              {t('tasks.addSchedule')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
