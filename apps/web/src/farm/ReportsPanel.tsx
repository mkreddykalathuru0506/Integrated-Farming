import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, FileDown, FileSpreadsheet, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  useCreateReportSchedule,
  useDeleteReportSchedule,
  useDownloadReport,
  useReportSchedules,
  useRunReportSchedule,
  useUpdateReportSchedule,
} from '../api/ops.hooks';
import { fmtDate } from '../lib/format';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PanelError,
  PanelHeading,
  PanelNote,
  Select,
  type DataTableColumn,
} from '../ui';
import type { ReportSchedule } from './api';

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'WEBHOOK', 'PUSH'] as const;
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;

/* ---------- create-schedule dialog ---------- */

const scheduleSchema = z.object({
  name: z.string().trim().min(1, 'reports.nameRequired'),
  frequency: z.string(),
  format: z.string(),
  channel: z.string(),
  recipient: z.string().trim().min(1, 'reports.recipientRequired'),
});
type ScheduleValues = z.infer<typeof scheduleSchema>;

function CreateScheduleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const createSchedule = useCreateReportSchedule();
  const form = useForm<ScheduleValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { name: '', frequency: 'WEEKLY', format: 'pdf', channel: 'EMAIL', recipient: '' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = form.handleSubmit((v) => {
    createSchedule.mutate(
      {
        name: v.name.trim(),
        frequency: v.frequency,
        format: v.format,
        // dormant API field now exposed: delivery channel (was silently EMAIL)
        channel: v.channel,
        recipient: v.recipient.trim(),
      },
      {
        onSuccess: () => {
          form.reset();
          onOpenChange(false);
        },
      },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('reports.schedule')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <Field label={t('reports.scheduleName')} required error={err(form.formState.errors.name?.message)}>
            <Input placeholder={t('reports.scheduleNamePlaceholder')} {...form.register('name')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('reports.colFreq')}>
              <Select {...form.register('frequency')}>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {t(`reports.freq.${f}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('reports.formatLabel')}>
              <Select {...form.register('format')}>
                <option value="pdf">{t('reports.formatPdf')}</option>
                <option value="xlsx">{t('reports.formatXlsx')}</option>
              </Select>
            </Field>
            <Field label={t('reports.channelLabel')}>
              <Select {...form.register('channel')}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {t(`reports.channel.${c}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={t('reports.recipient')} required error={err(form.formState.errors.recipient?.message)}>
            <Input {...form.register('recipient')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createSchedule.isPending}>
              {t('reports.addSchedule')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- panel ---------- */

export function ReportsPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const schedules = useReportSchedules();
  const download = useDownloadReport();
  const runNow = useRunReportSchedule();
  const updateSchedule = useUpdateReportSchedule();
  const deleteSchedule = useDeleteReportSchedule();
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ReportSchedule | null>(null);

  const columns: DataTableColumn<ReportSchedule>[] = [
    {
      header: 'reports.colName',
      accessor: 'name',
      cell: (s) => <span className="font-medium text-foreground">{s.name}</span>,
    },
    { header: 'reports.colFreq', accessor: (s) => t(`reports.freq.${s.frequency}`) },
    {
      header: 'reports.colFormat',
      accessor: (s) => s.format,
      cell: (s) => <Badge variant="muted">{s.format.toUpperCase()}</Badge>,
    },
    { header: 'reports.colChannel', accessor: (s) => t(`reports.channel.${s.channel}`) },
    { header: 'reports.colRecipient', accessor: 'recipient' },
    {
      header: 'reports.colActive',
      accessor: (s) => (s.isActive ? t('reports.active') : t('reports.paused')),
      cell: (s) => (
        <Badge variant={s.isActive ? 'success' : 'muted'}>
          {s.isActive ? t('reports.active') : t('reports.paused')}
        </Badge>
      ),
    },
    {
      header: 'reports.colLastRun',
      accessor: (s) => s.lastRunAt ?? '',
      cell: (s) => (s.lastRunAt ? fmtDate(s.lastRunAt) : '—'),
    },
    {
      header: 'reports.colNextRun',
      accessor: 'nextRunAt',
      cell: (s) => fmtDate(s.nextRunAt),
    },
    ...(canWrite
      ? [
          {
            id: 'actions',
            header: 'reports.colActions',
            cell: (s: ReportSchedule) => (
              <span className="inline-flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={runNow.isPending && runNow.variables === s.id}
                  onClick={() => runNow.mutate(s.id)}
                >
                  <Play aria-hidden />
                  {t('reports.runNow')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={updateSchedule.isPending && updateSchedule.variables?.id === s.id}
                  onClick={() => updateSchedule.mutate({ id: s.id, data: { isActive: !s.isActive } })}
                >
                  {s.isActive ? <Pause aria-hidden /> : <Play aria-hidden />}
                  {s.isActive ? t('reports.pause') : t('reports.resume')}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  aria-label={t('reports.deleteSchedule', { name: s.name })}
                  disabled={deleteSchedule.isPending}
                  onClick={() => setPendingDelete(s)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </span>
            ),
          } satisfies DataTableColumn<ReportSchedule>,
        ]
      : []),
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite && (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {t('reports.addSchedule')}
            </Button>
          )
        }
      >
        {t('reports.title')}
      </PanelHeading>

      {/* On-demand download card */}
      <div className="space-y-2 rounded-xl border border-border bg-card p-3">
        <PanelNote>{t('reports.blurb')}</PanelNote>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            loading={download.isPending && download.variables === 'pdf'}
            disabled={download.isPending}
            onClick={() => download.mutate('pdf')}
          >
            <FileDown aria-hidden />
            {t('reports.pdf')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            loading={download.isPending && download.variables === 'xlsx'}
            disabled={download.isPending}
            onClick={() => download.mutate('xlsx')}
          >
            <FileSpreadsheet aria-hidden />
            {t('reports.xlsx')}
          </Button>
        </div>
      </div>

      {/* Scheduled delivery */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('reports.schedules')}
        </p>
        {schedules.isError ? (
          <div className="space-y-2">
            <PanelError>{t('reports.error')}</PanelError>
            <Button type="button" variant="secondary" size="sm" onClick={() => void schedules.refetch()}>
              {t('reports.retry')}
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={schedules.data}
            isLoading={schedules.isPending}
            pageSize={10}
            getRowId={(s) => s.id}
            emptyState={
              <EmptyState
                icon={CalendarClock}
                title={t('reports.noSchedules')}
                description={t('reports.noSchedulesDesc')}
                size="compact"
                action={
                  canWrite && (
                    <Button type="button" onClick={() => setCreateOpen(true)}>
                      <Plus aria-hidden />
                      {t('reports.addSchedule')}
                    </Button>
                  )
                }
              />
            }
          />
        )}
      </div>

      <CreateScheduleDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t('reports.confirmDeleteTitle')}
        description={t('reports.confirmDeleteBody', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        variant="danger"
        loading={deleteSchedule.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteSchedule.mutate(pendingDelete.id, { onSettled: () => setPendingDelete(null) });
        }}
      />
    </section>
  );
}
