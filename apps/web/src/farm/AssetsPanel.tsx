import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Package, Pencil, Plus, Wrench } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  useAssets,
  useCreateAsset,
  useCreateMaintSchedule,
  useMaintenanceReminders,
  useRecordMaintenance,
  useUpdateAsset,
} from '../api/ops.hooks';
import { fmtDate, fmtInr, rupeesToPaise } from '../lib/format';
import { rupeeField } from '../lib/moneyField';
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  InrInput,
  Input,
  PanelError,
  PanelHeading,
  PanelNote,
  Select,
  SubPanel,
  type BadgeProps,
  type DataTableColumn,
} from '../ui';
import type { Asset, MaintSchedule } from './api';

const ASSET_TYPES = ['EQUIPMENT', 'VEHICLE', 'MACHINERY', 'BUILDING', 'TOOL', 'OTHER'] as const;
const MAINT_TYPES = ['SERVICE', 'REPAIR', 'INSPECTION', 'CALIBRATION', 'OTHER'] as const;

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  ACTIVE: 'success',
  UNDER_REPAIR: 'warning',
  RETIRED: 'muted',
};

/* ---------- create-asset dialog ---------- */

const createSchema = z.object({
  name: z.string().trim().min(1, 'assets.nameRequired'),
  type: z.string(),
  purchaseDate: z.string(),
  purchaseCost: rupeeField('assets.invalidCost', true),
});
type CreateValues = z.infer<typeof createSchema>;

function CreateAssetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const createAsset = useCreateAsset();
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', type: 'EQUIPMENT', purchaseDate: '', purchaseCost: '' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = form.handleSubmit((v) => {
    createAsset.mutate(
      {
        name: v.name.trim(),
        type: v.type,
        purchaseDate: v.purchaseDate ? new Date(v.purchaseDate).toISOString() : undefined,
        purchaseCostPaise: v.purchaseCost.trim() ? rupeesToPaise(v.purchaseCost)! : undefined,
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
          <DialogTitle>{t('assets.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <Field label={t('assets.name')} required error={err(form.formState.errors.name?.message)}>
            <Input placeholder={t('assets.namePlaceholder')} {...form.register('name')} />
          </Field>
          <Field label={t('assets.typeLabel')}>
            <Select {...form.register('type')}>
              {ASSET_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`assets.type.${tp}`)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('assets.purchaseDate')}>
              <Input type="date" {...form.register('purchaseDate')} />
            </Field>
            <Controller
              control={form.control}
              name="purchaseCost"
              render={({ field }) => (
                <Field label={t('assets.purchaseCost')} error={err(form.formState.errors.purchaseCost?.message)}>
                  <InrInput value={field.value} onChangePaise={(_p, rupees) => field.onChange(rupees)} />
                </Field>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createAsset.isPending}>
              {t('assets.addBtn')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- record-service dialog (captures cost + vendor — advances the schedule) ---------- */

const serviceSchema = z.object({
  type: z.string(),
  cost: rupeeField('assets.invalidCost', true),
  vendor: z.string(),
});
type ServiceValues = z.infer<typeof serviceSchema>;

function RecordServiceDialog({
  target,
  onClose,
}: {
  target: { assetId: string; schedule: MaintSchedule } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const record = useRecordMaintenance();
  const form = useForm<ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { type: 'SERVICE', cost: '', vendor: '' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = form.handleSubmit((v) => {
    if (!target) return;
    record.mutate(
      {
        assetId: target.assetId,
        data: {
          scheduleId: target.schedule.id,
          type: v.type,
          costPaise: v.cost.trim() ? rupeesToPaise(v.cost)! : undefined,
          vendor: v.vendor.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          form.reset();
          onClose();
        },
      },
    );
  });

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('assets.serviceFor', { name: target?.schedule.name ?? '' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <Field label={t('assets.serviceType')}>
            <Select {...form.register('type')}>
              {MAINT_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {t(`assets.maint.${mt}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Controller
            control={form.control}
            name="cost"
            render={({ field }) => (
              <Field label={t('assets.cost')} error={err(form.formState.errors.cost?.message)}>
                <InrInput value={field.value} onChangePaise={(_p, rupees) => field.onChange(rupees)} />
              </Field>
            )}
          />
          <Field label={t('assets.vendor')}>
            <Input placeholder={t('assets.vendorPlaceholder')} {...form.register('vendor')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={record.isPending}>
              {t('assets.recordService')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- asset detail dialog: schedules + add-schedule ---------- */

const schedSchema = z.object({
  name: z.string().trim().min(1, 'assets.schedNameRequired'),
  intervalDays: z
    .string()
    .refine((v) => /^\d+$/.test(v.trim()) && Number(v.trim()) >= 1, 'assets.daysRequired'),
});
type SchedValues = z.infer<typeof schedSchema>;

function AssetDetailDialog({
  asset,
  canWrite,
  onClose,
  onRecordService,
}: {
  asset: Asset | null;
  canWrite: boolean;
  onClose: () => void;
  onRecordService: (assetId: string, schedule: MaintSchedule) => void;
}) {
  const { t } = useTranslation();
  const createSchedule = useCreateMaintSchedule();
  const form = useForm<SchedValues>({
    resolver: zodResolver(schedSchema),
    defaultValues: { name: '', intervalDays: '' },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = form.handleSubmit((v) => {
    if (!asset) return;
    const days = Number(v.intervalDays.trim());
    createSchedule.mutate(
      {
        assetId: asset.id,
        data: {
          name: v.name.trim(),
          intervalDays: days,
          nextDueDate: new Date(Date.now() + days * 86_400_000).toISOString(),
        },
      },
      { onSuccess: () => form.reset() },
    );
  });

  return (
    <Dialog open={asset !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asset?.name}</DialogTitle>
          <DialogDescription>
            {asset ? `${t(`assets.type.${asset.type}`)} · ${t(`assets.status.${asset.status}`)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <PanelHeading>{t('assets.schedules')}</PanelHeading>
          {asset && asset.schedules.length === 0 && <PanelNote>{t('assets.noSchedules')}</PanelNote>}
          {asset && asset.schedules.length > 0 && (
            <ul className="space-y-2">
              {asset.schedules.map((s) => {
                const overdue = new Date(s.nextDueDate).getTime() < Date.now();
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="block text-xs text-muted-foreground tabular">
                        {t('assets.everyDaysShort', { count: s.intervalDays })} ·{' '}
                        {t('assets.nextDue', { date: fmtDate(s.nextDueDate) })}{' '}
                        {overdue && <Badge variant="destructive">{t('assets.overdue')}</Badge>}
                      </span>
                    </span>
                    {canWrite && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onRecordService(asset.id, s)}
                      >
                        <Wrench aria-hidden />
                        {t('assets.recordService')}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {canWrite && (
            <SubPanel>
              <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('assets.schedName')} required error={err(form.formState.errors.name?.message)}>
                    <Input placeholder={t('assets.schedNamePlaceholder')} {...form.register('name')} />
                  </Field>
                  <Field
                    label={t('assets.everyDays')}
                    required
                    error={err(form.formState.errors.intervalDays?.message)}
                  >
                    <Input type="number" min={1} inputMode="numeric" {...form.register('intervalDays')} />
                  </Field>
                </div>
                <Button type="submit" variant="secondary" loading={createSchedule.isPending}>
                  <Plus aria-hidden />
                  {t('assets.schedule')}
                </Button>
              </form>
            </SubPanel>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- edit-asset dialog (PATCH name/type/status, slice 11.9) ---------- */

const editAssetSchema = z.object({
  name: z.string().trim().min(1, 'assets.nameRequired'),
  type: z.string(),
  status: z.string(),
});
type EditAssetValues = z.infer<typeof editAssetSchema>;

const ASSET_STATUSES = ['ACTIVE', 'UNDER_REPAIR', 'RETIRED'] as const;

function EditAssetDialog({ asset, onClose }: { asset: Asset | null; onClose: () => void }) {
  const { t } = useTranslation();
  const updateAsset = useUpdateAsset();
  const form = useForm<EditAssetValues>({
    resolver: zodResolver(editAssetSchema),
    values: {
      name: asset?.name ?? '',
      type: asset?.type ?? 'EQUIPMENT',
      status: asset?.status ?? 'ACTIVE',
    },
  });
  const err = (m?: string) => (m ? t(m) : undefined);

  const onSubmit = form.handleSubmit((v) => {
    if (!asset) return;
    updateAsset.mutate(
      { id: asset.id, data: { name: v.name.trim(), type: v.type, status: v.status } },
      { onSuccess: onClose },
    );
  });

  return (
    <Dialog open={asset !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('assets.editTitle', { name: asset?.name ?? '' })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <Field label={t('assets.name')} required error={err(form.formState.errors.name?.message)}>
            <Input {...form.register('name')} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('assets.typeLabel')}>
              <Select {...form.register('type')}>
                {ASSET_TYPES.map((tp) => (
                  <option key={tp} value={tp}>
                    {t(`assets.type.${tp}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('assets.statusLabel')}>
              <Select {...form.register('status')}>
                {ASSET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`assets.status.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={updateAsset.isPending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- panel ---------- */

export function AssetsPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const assets = useAssets();
  const reminders = useMaintenanceReminders();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [serviceTarget, setServiceTarget] = useState<{ assetId: string; schedule: MaintSchedule } | null>(null);

  // Derive the detail record from the live query so mutations refresh it in place.
  const detailAsset = assets.data?.find((a) => a.id === detailId) ?? null;
  const editAsset = assets.data?.find((a) => a.id === editId) ?? null;
  const due = reminders.data ?? [];

  const columns: DataTableColumn<Asset>[] = [
    {
      header: 'assets.colName',
      accessor: 'name',
      cell: (a) => <span className="font-medium text-foreground">{a.name}</span>,
    },
    {
      header: 'assets.colType',
      accessor: (a) => t(`assets.type.${a.type}`),
      cell: (a) => <Badge>{t(`assets.type.${a.type}`)}</Badge>,
    },
    {
      header: 'assets.colStatus',
      accessor: (a) => t(`assets.status.${a.status}`),
      cell: (a) => (
        <Badge variant={STATUS_VARIANT[a.status] ?? 'default'}>{t(`assets.status.${a.status}`)}</Badge>
      ),
    },
    {
      header: 'assets.colPurchased',
      accessor: (a) => a.purchaseDate ?? '',
      cell: (a) => (a.purchaseDate ? fmtDate(a.purchaseDate) : '—'),
    },
    {
      header: 'assets.colCost',
      align: 'right',
      accessor: (a) => (a.purchaseCostPaise ? Number(a.purchaseCostPaise) : 0),
      cell: (a) => (a.purchaseCostPaise ? fmtInr(a.purchaseCostPaise) : '—'),
    },
    ...(canWrite
      ? [
          {
            id: 'actions',
            header: 'assets.colActions',
            cell: (a: Asset) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t('assets.editAria', { name: a.name })}
                onClick={(e) => {
                  // Rows open the detail dialog — don't let the pencil trigger both.
                  e.stopPropagation();
                  setEditId(a.id);
                }}
              >
                <Pencil aria-hidden />
              </Button>
            ),
          } satisfies DataTableColumn<Asset>,
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
              {t('assets.addBtn')}
            </Button>
          )
        }
      >
        {t('assets.title')}
      </PanelHeading>

      {due.length > 0 && (
        <div className="rounded-md bg-warning/12 p-3 text-sm text-warning">
          <p className="font-semibold">{t('assets.dueReminder', { count: due.length })}</p>
          <ul className="mt-1 space-y-0.5 text-xs tabular">
            {due.slice(0, 4).map((d) => (
              <li key={d.id}>
                {d.asset.name} · {d.name} · {fmtDate(d.nextDueDate)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {assets.isError ? (
        <div className="space-y-2">
          <PanelError>{t('assets.error')}</PanelError>
          <Button type="button" variant="secondary" size="sm" onClick={() => void assets.refetch()}>
            {t('assets.retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={assets.data}
          isLoading={assets.isPending}
          searchable
          pageSize={10}
          onRowClick={(a) => setDetailId(a.id)}
          getRowId={(a) => a.id}
          emptyState={
            <EmptyState
              icon={Package} illustration="generic"
              title={t('assets.empty')}
              description={t('assets.emptyDesc')}
              action={
                canWrite && (
                  <Button type="button" onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden />
                    {t('assets.addBtn')}
                  </Button>
                )
              }
            />
          }
        />
      )}

      <CreateAssetDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditAssetDialog asset={editAsset} onClose={() => setEditId(null)} />
      <AssetDetailDialog
        asset={detailAsset}
        canWrite={canWrite}
        onClose={() => setDetailId(null)}
        onRecordService={(assetId, schedule) => setServiceTarget({ assetId, schedule })}
      />
      <RecordServiceDialog target={serviceTarget} onClose={() => setServiceTarget(null)} />
    </section>
  );
}
