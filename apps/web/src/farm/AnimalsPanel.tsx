import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Download, PawPrint, Plus, Printer, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useSpecies, useUnits } from '../api/hooks';
import {
  useAnimals,
  useCreateAnimal,
  useMovements,
  useRecordMortality,
  useRecordMovement,
  useSpeciesDetail,
  type MovementRow,
} from '../api/livestock.hooks';
import { fmtDate } from '../lib/format';
import type { Animal } from './api';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PanelHeading,
  PanelNote,
  Select,
  type DataTableColumn,
} from '../ui';
import { MoveDialog } from './BatchesPanel';
import { LoadErrorNote } from './LoadErrorNote';

const SEXES = ['UNKNOWN', 'FEMALE', 'MALE'] as const;
type LossType = 'MORTALITY' | 'CULL';

const createSchema = z.object({
  speciesId: z.string().min(1, 'animals.form.speciesRequired'),
  tagNumber: z.string().max(60, 'animals.form.tagTooLong'),
  name: z.string().max(120, 'animals.form.nameTooLong'),
  sex: z.string(),
  breedId: z.string(),
  unitId: z.string(),
  dob: z.string(),
});
type CreateForm = z.infer<typeof createSchema>;

/** Display label for an animal: tag, else name, else QR code. */
function animalLabel(a: Animal): string {
  return a.tagNumber ?? a.name ?? a.qrCode ?? a.id;
}

/**
 * Animals panel (slice 11.6a rewrite): DataTable list, RHF create dialog with
 * the dormant name/breed/unit/dob fields, QR enlarge dialog with print + PNG
 * download, detail dialog with movement history, and confirmed cull/dead.
 */
export function AnimalsPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const animals = useAnimals();
  const species = useSpecies();
  const units = useUnits();
  const recordMortality = useRecordMortality();
  const recordMovement = useRecordMovement();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [qrAnimal, setQrAnimal] = useState<Animal | null>(null);
  const [lossTarget, setLossTarget] = useState<{ animal: Animal; type: LossType } | null>(null);
  const [moveTarget, setMoveTarget] = useState<Animal | null>(null);

  const detailAnimal = useMemo(
    () => animals.data?.find((a) => a.id === detailId) ?? null,
    [animals.data, detailId],
  );
  const indivSpecies = useMemo(
    () => (species.data ?? []).filter((s) => s.trackingMode === 'INDIVIDUAL'),
    [species.data],
  );

  const columns: DataTableColumn<Animal>[] = [
    {
      header: 'animals.cols.tag',
      accessor: (a) => animalLabel(a),
      cell: (a) => (
        <span className="font-medium text-foreground">
          {animalLabel(a)}
          {a.tagNumber && a.name && (
            <span className="ml-1.5 text-xs text-muted-foreground">{a.name}</span>
          )}
        </span>
      ),
    },
    { header: 'animals.cols.species', accessor: (a) => a.species.name },
    { header: 'animals.cols.stage', accessor: (a) => a.currentStage?.name ?? '—' },
    { header: 'animals.cols.sex', accessor: (a) => t(`animals.sex.${a.sex}`) },
    {
      header: 'animals.cols.status',
      accessor: 'status',
      cell: (a) => (
        <Badge
          variant={
            a.status === 'ACTIVE'
              ? 'success'
              : a.status === 'SOLD'
                ? 'accent'
                : a.status === 'CULLED'
                  ? 'warning'
                  : 'destructive'
          }
        >
          {t(`animals.status.${a.status}`)}
        </Badge>
      ),
    },
    {
      id: 'qr',
      header: 'animals.cols.qr',
      cell: (a) =>
        a.qrCode ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t('animals.showQr', { tag: animalLabel(a) })}
            onClick={(e) => {
              e.stopPropagation();
              setQrAnimal(a);
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <QrCode aria-hidden />
          </Button>
        ) : null,
      enableSorting: false,
    },
  ];

  return (
    <section className="space-y-3">
      <PanelHeading
        action={
          canWrite ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              {t('animals.add')}
            </Button>
          ) : undefined
        }
      >
        {t('animals.title')}
      </PanelHeading>

      {animals.isError && !animals.data ? (
        <LoadErrorNote
          text={t('animals.error')}
          retryLabel={t('animals.retry')}
          onRetry={() => void animals.refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={animals.data}
          isLoading={animals.isPending}
          searchable
          pageSize={10}
          onRowClick={(a) => setDetailId(a.id)}
          getRowId={(a) => a.id}
          emptyState={
            <EmptyState
              icon={PawPrint} illustration="livestock"
              title={t('animals.empty')}
              description={t('animals.emptyHint')}
              action={
                canWrite ? (
                  <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden />
                    {t('animals.add')}
                  </Button>
                ) : undefined
              }
            />
          }
        />
      )}

      {canWrite && (
        <CreateAnimalDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          indivSpecies={indivSpecies}
          units={units.data ?? []}
        />
      )}

      <AnimalDetailDialog
        animal={detailAnimal}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        unitNameOf={(id) => (units.data ?? []).find((u) => u.id === id)?.name ?? '—'}
        canWrite={canWrite}
        onShowQr={setQrAnimal}
        onLoss={(animal, type) => setLossTarget({ animal, type })}
        onMove={setMoveTarget}
      />

      <QrDialog
        animal={qrAnimal}
        onOpenChange={(open) => {
          if (!open) setQrAnimal(null);
        }}
      />

      <ConfirmDialog
        open={lossTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLossTarget(null);
        }}
        title={lossTarget ? t(`events.recordLossTitle.${lossTarget.type}`) : ''}
        description={
          lossTarget
            ? t(`events.confirmAnimalBody.${lossTarget.type}`, {
                target: animalLabel(lossTarget.animal),
              })
            : undefined
        }
        confirmLabel={t('events.confirmLoss')}
        variant="danger"
        loading={recordMortality.isPending}
        onConfirm={() => {
          if (!lossTarget) return;
          recordMortality.mutate(
            { animalId: lossTarget.animal.id, type: lossTarget.type },
            { onSuccess: () => setLossTarget(null) },
          );
        }}
      />

      <MoveDialog
        target={moveTarget ? { label: animalLabel(moveTarget) } : null}
        units={units.data ?? []}
        loading={recordMovement.isPending}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
        onMove={(toUnitId) => {
          if (!moveTarget) return;
          recordMovement.mutate(
            { animalId: moveTarget.id, toUnitId },
            { onSuccess: () => setMoveTarget(null) },
          );
        }}
      />
    </section>
  );
}

// ---------- create dialog ----------

function CreateAnimalDialog({
  open,
  onOpenChange,
  indivSpecies,
  units,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indivSpecies: { id: string; name: string }[];
  units: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const createAnimal = useCreateAnimal();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      speciesId: '',
      tagNumber: '',
      name: '',
      sex: 'UNKNOWN',
      breedId: '',
      unitId: '',
      dob: '',
    },
  });

  const speciesId = watch('speciesId');
  const speciesDetail = useSpeciesDetail(open && speciesId ? speciesId : null);
  const breeds = speciesDetail.data?.breeds ?? [];

  const err = (key: keyof CreateForm) => {
    const message = errors[key]?.message;
    return message ? t(message) : undefined;
  };

  const onSubmit = handleSubmit((v) => {
    createAnimal.mutate(
      {
        speciesId: v.speciesId,
        tagNumber: v.tagNumber.trim() || undefined,
        name: v.name.trim() || undefined,
        sex: v.sex,
        breedId: v.breedId || undefined,
        unitId: v.unitId || undefined,
        dob: v.dob ? new Date(`${v.dob}T00:00:00.000Z`).toISOString() : undefined,
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
          <DialogTitle>{t('animals.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3" noValidate>
          <Field label={t('animals.form.species')} required error={err('speciesId')}>
            <Select {...register('speciesId')}>
              <option value="">{t('animals.form.choose')}</option>
              {indivSpecies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('animals.form.tag')} error={err('tagNumber')} hint={t('animals.form.tagHint')}>
              <Input {...register('tagNumber')} />
            </Field>
            <Field label={t('animals.form.name')} error={err('name')}>
              <Input {...register('name')} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('animals.form.sex')}>
              <Select {...register('sex')}>
                {SEXES.map((s) => (
                  <option key={s} value={s}>
                    {t(`animals.sex.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('animals.form.dob')} hint={t('animals.form.optional')}>
              <Input {...register('dob')} type="date" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('animals.form.breed')} hint={t('animals.form.optional')}>
              <Select {...register('breedId')} disabled={!speciesId || breeds.length === 0}>
                <option value="">
                  {speciesId && breeds.length === 0
                    ? t('animals.form.noBreeds')
                    : t('animals.form.none')}
                </option>
                {breeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('animals.form.unit')} hint={t('animals.form.optional')}>
              <Select {...register('unitId')}>
                <option value="">{t('animals.form.none')}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createAnimal.isPending}>
              {t('animals.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- QR enlarge dialog (print + PNG download) ----------

function QrDialog({
  animal,
  onOpenChange,
}: {
  animal: Animal | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const qrRef = useRef<HTMLDivElement>(null);

  function svgMarkup(): string | null {
    const svg = qrRef.current?.querySelector('svg');
    return svg ? new XMLSerializer().serializeToString(svg) : null;
  }

  // Print a small label (QR + tag + code) in a same-origin blank window.
  // SECURITY: tag/name are user-supplied free text — they must only ever be
  // assigned via textContent (never document.write / innerHTML), or a crafted
  // tag like `<img onerror=…>` would execute in the app origin (token theft).
  // Mirrors the safe pattern in ProcessingPanel's lot-label print.
  function onPrint() {
    const markup = svgMarkup();
    if (!markup || !animal) return;
    const label = animalLabel(animal);
    const win = window.open('', '_blank', 'width=420,height=520');
    if (!win) return;
    const doc = win.document;
    doc.title = label;
    const wrap = doc.createElement('div');
    wrap.setAttribute(
      'style',
      'display:grid;place-items:center;gap:12px;font-family:sans-serif;text-align:center;padding:24px',
    );
    wrap.innerHTML = markup; // qrcode.react SVG output — trusted markup
    const tag = doc.createElement('p');
    tag.textContent = label; // user text → textContent, never parsed as HTML
    tag.setAttribute('style', 'font-size:14px;margin:0');
    const code = doc.createElement('p');
    code.textContent = animal.qrCode ?? '';
    code.setAttribute('style', 'font-size:12px;color:#555;margin:0');
    wrap.append(tag, code);
    doc.body.appendChild(wrap);
    win.focus();
    win.print();
  }

  function onDownload() {
    const markup = svgMarkup();
    if (!markup || !animal) return;
    const label = animalLabel(animal);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 16, 16, 480, 480);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${label}-qr.png`;
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${window.btoa(markup)}`;
  }

  return (
    <Dialog open={animal !== null} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {animal && (
          <>
            <DialogHeader>
              <DialogTitle>{animalLabel(animal)}</DialogTitle>
              <DialogDescription className="font-mono">{animal.qrCode}</DialogDescription>
            </DialogHeader>
            <div ref={qrRef} className="grid place-items-center rounded-lg bg-card p-4">
              {animal.qrCode && <QRCodeSVG value={animal.qrCode} size={208} aria-label={animal.qrCode} />}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onDownload}>
                <Download aria-hidden />
                {t('animals.qrDownload')}
              </Button>
              <Button type="button" onClick={onPrint}>
                <Printer aria-hidden />
                {t('animals.qrPrint')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- detail dialog ----------

function AnimalDetailDialog({
  animal,
  onOpenChange,
  unitNameOf,
  canWrite,
  onShowQr,
  onLoss,
  onMove,
}: {
  animal: Animal | null;
  onOpenChange: (open: boolean) => void;
  unitNameOf: (id: string | null) => string;
  canWrite: boolean;
  onShowQr: (animal: Animal) => void;
  onLoss: (animal: Animal, type: LossType) => void;
  onMove: (animal: Animal) => void;
}) {
  const { t } = useTranslation();
  const movements = useMovements({ animalId: animal?.id ?? '' }, animal !== null);

  const movementCols: DataTableColumn<MovementRow>[] = [
    { header: 'animals.detail.date', accessor: (m) => fmtDate(m.movedAt) },
    { header: 'animals.detail.from', accessor: (m) => unitNameOf(m.fromUnitId) },
    { header: 'animals.detail.to', accessor: (m) => unitNameOf(m.toUnitId) },
    { header: 'animals.detail.reason', accessor: (m) => m.reason ?? '—' },
  ];

  return (
    <Dialog open={animal !== null} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {animal && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {animalLabel(animal)}
                <Badge
                  variant={
                    animal.status === 'ACTIVE'
                      ? 'success'
                      : animal.status === 'SOLD'
                        ? 'accent'
                        : animal.status === 'CULLED'
                          ? 'warning'
                          : 'destructive'
                  }
                >
                  {t(`animals.status.${animal.status}`)}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {animal.species.name}
                {animal.breed ? ` · ${animal.breed.name}` : ''} ·{' '}
                {animal.currentStage?.name ?? '—'} · {t(`animals.sex.${animal.sex}`)}
                {animal.dob ? ` · ${t('animals.detail.born', { date: fmtDate(animal.dob) })}` : ''}
                {animal.unit ? ` · ${animal.unit.name}` : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="mb-4 flex flex-wrap gap-2">
              {animal.qrCode && (
                <Button type="button" size="sm" variant="secondary" onClick={() => onShowQr(animal)}>
                  <QrCode aria-hidden />
                  {t('animals.qrShow')}
                </Button>
              )}
              {canWrite && animal.status === 'ACTIVE' && (
                <>
                  <Button type="button" size="sm" variant="secondary" onClick={() => onMove(animal)}>
                    {t('events.move')}
                  </Button>
                  <Button type="button" size="sm" variant="danger" onClick={() => onLoss(animal, 'CULL')}>
                    {t('events.cull')}
                  </Button>
                  <Button type="button" size="sm" variant="danger" onClick={() => onLoss(animal, 'MORTALITY')}>
                    {t('events.dead')}
                  </Button>
                </>
              )}
            </div>

            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('animals.detail.movementHistory')}
              </h3>
              <DataTable
                columns={movementCols}
                data={movements.data}
                isLoading={movements.isPending}
                pageSize={5}
                getRowId={(m) => m.id}
                emptyState={<PanelNote>{t('animals.detail.noMovements')}</PanelNote>}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
