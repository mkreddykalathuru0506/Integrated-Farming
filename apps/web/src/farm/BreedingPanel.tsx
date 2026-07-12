import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Heart, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useSpecies } from '../api/hooks';
import {
  todayISO,
  useAnimals,
  useBreeding,
  useCreateBreeding,
  useUpdateBreeding,
  type BreedingRecord,
  type BreedingStatus,
} from '../api/health.hooks';
import { fmtDate } from '../lib/format';
import type { Animal, SpeciesSummary } from './api';
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
  Select,
  Textarea,
  type DataTableColumn,
} from '../ui';

const STATUS_VARIANT: Record<BreedingStatus, 'muted' | 'accent' | 'success' | 'destructive'> = {
  PLANNED: 'muted',
  CONFIRMED: 'accent',
  COMPLETED: 'success',
  FAILED: 'destructive',
};

const animalLabel = (a: Animal) => a.tagNumber ?? a.name ?? a.qrCode ?? a.id.slice(0, 6);

export function BreedingPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const breeding = useBreeding();
  const species = useSpecies();
  const animals = useAnimals();
  const updateBreeding = useUpdateBreeding();

  const [createOpen, setCreateOpen] = useState(false);
  const [completing, setCompleting] = useState<BreedingRecord | null>(null);
  const [failing, setFailing] = useState<BreedingRecord | null>(null);

  const speciesName = useMemo(
    () => new Map((species.data ?? []).map((s) => [s.id, s.name])),
    [species.data],
  );

  const methodLabel = (m: string | null) =>
    m === 'NATURAL' || m === 'AI' ? t(`breeding.methods.${m}`) : (m ?? '—');

  const columns: DataTableColumn<BreedingRecord>[] = [
    {
      id: 'species',
      header: 'breeding.species',
      accessor: (r) => (r.speciesId ? (speciesName.get(r.speciesId) ?? '—') : '—'),
    },
    { id: 'method', header: 'breeding.method', accessor: (r) => methodLabel(r.method) },
    {
      id: 'breedingDate',
      header: 'breeding.breedingDate',
      accessor: (r) => r.breedingDate,
      cell: (r) => fmtDate(r.breedingDate),
    },
    {
      id: 'expectedDue',
      header: 'breeding.expectedDue',
      accessor: (r) => r.expectedDueDate ?? '',
      cell: (r) => (r.expectedDueDate ? fmtDate(r.expectedDueDate) : '—'),
    },
    {
      id: 'status',
      header: 'breeding.statusLabel',
      accessor: (r) => t(`breeding.status.${r.status}`),
      cell: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{t(`breeding.status.${r.status}`)}</Badge>,
    },
    {
      id: 'offspring',
      header: 'breeding.offspring',
      accessor: (r) => r.offspringCount ?? '',
      align: 'right',
      cell: (r) => (r.offspringCount === null ? '—' : r.offspringCount),
    },
    ...(canWrite
      ? [
          {
            id: 'actions',
            header: 'breeding.actions',
            cell: (r: BreedingRecord) =>
              r.status === 'PLANNED' || r.status === 'CONFIRMED' ? (
                <span className="flex flex-wrap justify-end gap-1.5 sm:justify-start">
                  {r.status === 'PLANNED' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={updateBreeding.isPending}
                      onClick={() => updateBreeding.mutate({ id: r.id, data: { status: 'CONFIRMED' } })}
                    >
                      {t('breeding.confirm')}
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setCompleting(r)}>
                    {t('breeding.complete')}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setFailing(r)}>
                    {t('breeding.fail')}
                  </Button>
                </span>
              ) : null,
          } satisfies DataTableColumn<BreedingRecord>,
        ]
      : []),
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden /> {t('breeding.add')}
            </Button>
          ) : undefined
        }
      >
        {t('breeding.title')}
      </PanelHeading>

      {breeding.isError ? (
        <div className="space-y-2">
          <PanelError>{t('breeding.loadError')}</PanelError>
          <Button size="sm" variant="secondary" onClick={() => void breeding.refetch()}>
            {t('breeding.retry')}
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={breeding.data}
          isLoading={breeding.isPending}
          getRowId={(r) => r.id}
          searchable={(breeding.data?.length ?? 0) > 10}
          emptyState={
            <EmptyState
              icon={Heart} illustration="health"
              title={t('breeding.empty')}
              description={t('breeding.emptyDesc')}
              action={
                canWrite ? (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    {t('breeding.add')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      <ConfirmDialog
        open={failing !== null}
        onOpenChange={(open) => {
          if (!open) setFailing(null);
        }}
        title={t('breeding.failTitle')}
        description={t('breeding.failBody', {
          species: failing?.speciesId ? (speciesName.get(failing.speciesId) ?? '') : '',
          date: failing ? fmtDate(failing.breedingDate) : '',
        })}
        confirmLabel={t('breeding.fail')}
        variant="danger"
        loading={updateBreeding.isPending}
        onConfirm={() => {
          if (!failing) return;
          updateBreeding.mutate(
            { id: failing.id, data: { status: 'FAILED' } },
            { onSettled: () => setFailing(null) },
          );
        }}
      />

      {completing && <CompleteDialog record={completing} onOpenChange={() => setCompleting(null)} />}
      {createOpen && (
        <CreateBreedingDialog
          species={species.data ?? []}
          animals={animals.data ?? []}
          onOpenChange={setCreateOpen}
        />
      )}
    </section>
  );
}

// ------------------------------------------------------------- dialogs

const completeSchema = z.object({
  offspringCount: z.string().regex(/^\d+$/, 'breeding.form.offspringInvalid'),
});
type CompleteForm = z.infer<typeof completeSchema>;

function CompleteDialog({
  record,
  onOpenChange,
}: {
  record: BreedingRecord;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const updateBreeding = useUpdateBreeding();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompleteForm>({
    resolver: zodResolver(completeSchema),
    defaultValues: { offspringCount: '' },
  });

  const onSubmit = handleSubmit((values) => {
    updateBreeding.mutate(
      {
        id: record.id,
        data: { status: 'COMPLETED', offspringCount: Number(values.offspringCount) },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('breeding.completeTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <Field
            label={t('breeding.offspringCount')}
            required
            error={errors.offspringCount && t(errors.offspringCount.message ?? '')}
          >
            <Input type="number" min={0} inputMode="numeric" {...register('offspringCount')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={updateBreeding.isPending}>
              {t('breeding.complete')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const createSchema = z.object({
  speciesId: z.string().min(1, 'breeding.form.speciesRequired'),
  method: z.string(),
  damId: z.string(),
  sireId: z.string(),
  breedingDate: z.string().min(1, 'breeding.form.dateRequired'),
  expectedDueDate: z.string(),
  notes: z.string().trim().max(500, 'breeding.form.tooLong'),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateBreedingDialog({
  species,
  animals,
  onOpenChange,
}: {
  species: SpeciesSummary[];
  animals: Animal[];
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const createBreeding = useCreateBreeding();
  const defaultSpecies =
    species.find((s) => s.trackingMode === 'INDIVIDUAL')?.id ?? species[0]?.id ?? '';
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      speciesId: defaultSpecies,
      method: '',
      damId: '',
      sireId: '',
      breedingDate: todayISO(),
      expectedDueDate: '',
      notes: '',
    },
  });
  const speciesId = watch('speciesId');

  const candidates = animals.filter((a) => a.status === 'ACTIVE' && a.species.id === speciesId);
  const dams = candidates.filter((a) => a.sex === 'FEMALE');
  const sires = candidates.filter((a) => a.sex === 'MALE');

  const onSubmit = handleSubmit((values) => {
    createBreeding.mutate(
      {
        speciesId: values.speciesId,
        method: values.method || undefined,
        damId: values.damId || undefined,
        sireId: values.sireId || undefined,
        breedingDate: `${values.breedingDate}T00:00:00.000Z`,
        expectedDueDate: values.expectedDueDate
          ? `${values.expectedDueDate}T00:00:00.000Z`
          : undefined,
        notes: values.notes || undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('breeding.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('breeding.species')}
              required
              error={errors.speciesId && t(errors.speciesId.message ?? '')}
            >
              <Select {...register('speciesId')}>
                {species.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('breeding.method')}>
              <Select {...register('method')}>
                <option value="">{t('breeding.methods.NONE')}</option>
                <option value="NATURAL">{t('breeding.methods.NATURAL')}</option>
                <option value="AI">{t('breeding.methods.AI')}</option>
              </Select>
            </Field>
          </div>
          {(dams.length > 0 || sires.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('breeding.dam')}>
                <Select {...register('damId')}>
                  <option value="">{t('breeding.none')}</option>
                  {dams.map((a) => (
                    <option key={a.id} value={a.id}>
                      {animalLabel(a)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('breeding.sire')}>
                <Select {...register('sireId')}>
                  <option value="">{t('breeding.none')}</option>
                  {sires.map((a) => (
                    <option key={a.id} value={a.id}>
                      {animalLabel(a)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t('breeding.breedingDate')}
              required
              error={errors.breedingDate && t(errors.breedingDate.message ?? '')}
            >
              <Input type="date" {...register('breedingDate')} />
            </Field>
            <Field label={t('breeding.expectedDue')} hint={t('breeding.dueHint')}>
              <Input type="date" {...register('expectedDueDate')} />
            </Field>
          </div>
          <Field label={t('breeding.notes')} error={errors.notes && t(errors.notes.message ?? '')}>
            <Textarea rows={2} {...register('notes')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createBreeding.isPending}>
              {t('breeding.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
