import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Plus, Users } from 'lucide-react';
import { useAttendance, useCreateWorker, useMarkAttendance, useWorkers } from '../api/daily.hooks';
import { fmtInr, rupeesToPaise, todayIST } from '../lib/format';
import { rupeeField } from '../lib/moneyField';
import type { Worker } from './api';
import {
  Badge,
  Button,
  DataRow,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  InrInput,
  PanelHeading,
  PanelNote,
  Select,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataTableColumn,
} from '../ui';
import { LoadErrorNote } from './LoadErrorNote';

const WAGE_TYPES = ['DAILY', 'PIECE_RATE', 'MONTHLY'] as const;
const ATT_STATUSES = ['PRESENT', 'HALF_DAY', 'ABSENT'] as const;

const today = () => todayIST();

const createSchema = z.object({
  name: z.string().min(1, 'workers.form.nameRequired').max(120, 'workers.form.nameTooLong'),
  phone: z.string().max(20, 'workers.form.phoneTooLong'),
  designation: z.string().max(80, 'workers.form.designationTooLong'),
  wageType: z.string(),
  wage: rupeeField('workers.form.wageInvalid', true),
});
type CreateForm = z.infer<typeof createSchema>;

/**
 * Workers & attendance panel (slice 11.6a rewrite): a workers DataTable with an
 * RHF create dialog (dormant phone field, wage via InrInput → integer paise),
 * and an attendance tab — date picker, present/half-day/absent summary chips,
 * per-worker quick toggles with an optimistic update (no full-list flash).
 */
export function WorkersPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const workers = useWorkers();
  const [createOpen, setCreateOpen] = useState(false);
  const [date, setDate] = useState(today());

  const columns: DataTableColumn<Worker>[] = [
    {
      header: 'workers.cols.name',
      accessor: 'name',
      cell: (w) => <span className="font-medium text-foreground">{w.name}</span>,
    },
    { header: 'workers.cols.phone', accessor: (w) => w.phone ?? '—' },
    { header: 'workers.cols.designation', accessor: (w) => w.designation ?? '—' },
    {
      header: 'workers.cols.wage',
      accessor: (w) => (w.dailyWageRatePaise ? Number(w.dailyWageRatePaise) : 0),
      align: 'right',
      cell: (w) =>
        w.dailyWageRatePaise ? (
          <span>
            {fmtInr(w.dailyWageRatePaise)}
            <span className="text-xs text-muted-foreground">
              {' '}
              · {t(`workers.wageType.${w.wageType}`)}
            </span>
          </span>
        ) : (
          '—'
        ),
    },
    {
      header: 'workers.cols.status',
      accessor: 'isActive',
      cell: (w) => (
        <Badge variant={w.isActive ? 'success' : 'muted'}>
          {t(w.isActive ? 'workers.active' : 'workers.inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {t('workers.add')}
            </Button>
          ) : undefined
        }
      >
        {t('workers.title')}
      </PanelHeading>

      <Tabs defaultValue="workers">
        <TabsList>
          <TabsTrigger value="workers">{t('workers.tabWorkers')}</TabsTrigger>
          <TabsTrigger value="attendance">{t('workers.tabAttendance')}</TabsTrigger>
        </TabsList>

        <TabsContent value="workers">
          {workers.isError && !workers.data ? (
            <LoadErrorNote
              text={t('workers.error')}
              retryLabel={t('workers.retry')}
              onRetry={() => void workers.refetch()}
            />
          ) : (
            <DataTable
              columns={columns}
              data={workers.data}
              isLoading={workers.isPending}
              searchable
              pageSize={10}
              getRowId={(w) => w.id}
              emptyState={
                <EmptyState
                  icon={Users}
                  title={t('workers.empty')}
                  description={t('workers.emptyHint')}
                  action={
                    canWrite ? (
                      <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                        <Plus aria-hidden />
                        {t('workers.add')}
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          )}
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceView
            workers={workers.data ?? []}
            workersReady={!workers.isPending}
            canWrite={canWrite}
            date={date}
            onDateChange={setDate}
          />
        </TabsContent>
      </Tabs>

      {canWrite && <CreateWorkerDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </section>
  );
}

// ---------- attendance ----------

function AttendanceView({
  workers,
  workersReady,
  canWrite,
  date,
  onDateChange,
}: {
  workers: Worker[];
  workersReady: boolean;
  canWrite: boolean;
  date: string;
  onDateChange: (date: string) => void;
}) {
  const { t } = useTranslation();
  const attendance = useAttendance(date);
  const mark = useMarkAttendance(date);
  const activeWorkers = useMemo(() => workers.filter((w) => w.isActive), [workers]);

  const statusByWorker = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of attendance.data ?? []) map[row.workerId] = row.status;
    return map;
  }, [attendance.data]);

  const counts = useMemo(() => {
    // LEAVE is an API-valid status (written by integrations) — count it in its own
    // bucket, not as 'unmarked' (finding 11.8a).
    const c = { PRESENT: 0, HALF_DAY: 0, ABSENT: 0, LEAVE: 0, unmarked: 0 };
    for (const w of activeWorkers) {
      const s = statusByWorker[w.id];
      if (s === 'PRESENT') c.PRESENT += 1;
      else if (s === 'HALF_DAY') c.HALF_DAY += 1;
      else if (s === 'ABSENT') c.ABSENT += 1;
      else if (s === 'LEAVE') c.LEAVE += 1;
      else c.unmarked += 1;
    }
    return c;
  }, [activeWorkers, statusByWorker]);

  const variantFor = (status: (typeof ATT_STATUSES)[number], active: boolean) => {
    if (!active) return 'secondary' as const;
    if (status === 'PRESENT') return 'primary' as const;
    if (status === 'ABSENT') return 'destructive' as const;
    return 'accent' as const;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Field label={t('workers.attDate')} className="w-40">
          <Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
        </Field>
        {date !== today() && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-6"
            onClick={() => onDateChange(today())}
          >
            {t('workers.attToday')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="success">{t('workers.chipPresent', { count: counts.PRESENT })}</Badge>
        <Badge variant="accent">{t('workers.chipHalfDay', { count: counts.HALF_DAY })}</Badge>
        <Badge variant="destructive">{t('workers.chipAbsent', { count: counts.ABSENT })}</Badge>
        {counts.LEAVE > 0 && (
          <Badge variant="secondary">{t('workers.chipLeave', { count: counts.LEAVE })}</Badge>
        )}
        <Badge variant="muted">{t('workers.chipUnmarked', { count: counts.unmarked })}</Badge>
      </div>

      {attendance.isError && !attendance.data && (
        <LoadErrorNote
          text={t('workers.attError')}
          retryLabel={t('workers.retry')}
          onRetry={() => void attendance.refetch()}
        />
      )}

      {(!workersReady || (attendance.isPending && !attendance.data)) && (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}

      {workersReady && !attendance.isPending && activeWorkers.length === 0 && (
        <EmptyState icon={Users} title={t('workers.empty')} description={t('workers.emptyHint')} size="compact" />
      )}

      {workersReady && attendance.data && activeWorkers.length > 0 && (
        <ul className="space-y-2">
          {activeWorkers.map((w) => {
            const current = statusByWorker[w.id];
            return (
              <DataRow key={w.id} className="flex-wrap">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{w.name}</p>
                  {w.designation && (
                    <p className="truncate text-xs text-muted-foreground">{w.designation}</p>
                  )}
                </div>
                {canWrite ? (
                  <div className="flex shrink-0 items-center gap-1">
                    {ATT_STATUSES.map((s) => (
                      <Button
                        key={s}
                        type="button"
                        size="sm"
                        variant={variantFor(s, current === s)}
                        aria-pressed={current === s}
                        onClick={() => mark.mutate({ workerId: w.id, status: s })}
                      >
                        {t(`workers.att.${s}`)}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <Badge
                    variant={
                      current === 'PRESENT'
                        ? 'success'
                        : current === 'ABSENT'
                          ? 'destructive'
                          : current === 'HALF_DAY'
                            ? 'accent'
                            : 'muted'
                    }
                  >
                    {current ? t(`workers.att.${current}`) : t('workers.attUnmarked')}
                  </Badge>
                )}
              </DataRow>
            );
          })}
        </ul>
      )}

      {workersReady && attendance.data && activeWorkers.length > 0 && (
        <PanelNote>{t('workers.attHint')}</PanelNote>
      )}
    </div>
  );
}

// ---------- create dialog ----------

function CreateWorkerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const createWorker = useCreateWorker();
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', phone: '', designation: '', wageType: 'DAILY', wage: '' },
  });

  const err = (key: keyof CreateForm) => {
    const message = errors[key]?.message;
    return message ? t(message) : undefined;
  };

  const onSubmit = handleSubmit((v) => {
    const wagePaise = v.wage.trim() ? rupeesToPaise(v.wage) : null;
    createWorker.mutate(
      {
        name: v.name.trim(),
        phone: v.phone.trim() || undefined,
        designation: v.designation.trim() || undefined,
        wageType: v.wageType,
        dailyWageRatePaise: wagePaise ?? undefined,
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
          <DialogTitle>{t('workers.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <Field label={t('workers.form.name')} required error={err('name')}>
            <Input {...register('name')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('workers.form.phone')} error={err('phone')} hint={t('workers.form.optional')}>
              <Input {...register('phone')} type="tel" inputMode="tel" />
            </Field>
            <Field
              label={t('workers.form.designation')}
              error={err('designation')}
              hint={t('workers.form.optional')}
            >
              <Input {...register('designation')} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('workers.form.wageType')}>
              <Select {...register('wageType')}>
                {WAGE_TYPES.map((wt) => (
                  <option key={wt} value={wt}>
                    {t(`workers.wageType.${wt}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Controller
              name="wage"
              control={control}
              render={({ field }) => (
                <Field
                  label={t('workers.form.wage')}
                  error={err('wage')}
                  hint={t('workers.form.optional')}
                >
                  <InrInput
                    value={field.value}
                    onChangePaise={(_paise, rupees) => field.onChange(rupees)}
                    onBlur={field.onBlur}
                  />
                </Field>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createWorker.isPending}>
              {t('workers.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
