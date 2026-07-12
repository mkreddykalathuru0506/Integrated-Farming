import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Syringe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBatches } from '../api/hooks';
import { useRecordVaccination, useVaccinations, type VaxItem } from '../api/health.hooks';
import { pathForSection } from '../components/router';
import type { Batch } from './api';
import {
  Badge,
  Button,
  CardSkeleton,
  EmptyState,
  Field,
  PanelError,
  PanelHeading,
  Select,
} from '../ui';

const batchLabel = (b: Batch) => `${b.name ? `${b.name} (${b.code})` : b.code} · ${b.currentCount}`;

type TimelineItem = VaxItem & { state: 'due' | 'upcoming' | 'done' };

export function VaccinationPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const batches = useBatches();
  const activeBatches = useMemo(
    () => (batches.data ?? []).filter((b) => b.status === 'ACTIVE'),
    [batches.data],
  );

  const [batchId, setBatchId] = useState('');
  useEffect(() => {
    if (!batchId && activeBatches.length > 0) setBatchId(activeBatches[0]!.id);
  }, [batchId, activeBatches]);

  const vax = useVaccinations(batchId || undefined);
  const record = useRecordVaccination();
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const items: TimelineItem[] = useMemo(() => {
    if (!vax.data) return [];
    return [
      ...vax.data.due.map((v) => ({ ...v, state: 'due' as const })),
      ...vax.data.upcoming.map((v) => ({ ...v, state: 'upcoming' as const })),
      ...vax.data.done.map((v) => ({ ...v, state: 'done' as const })),
    ].sort((a, b) => a.ageDays - b.ageDays);
  }, [vax.data]);

  function give(item: TimelineItem) {
    setPendingItemId(item.id);
    record.mutate(
      { batchId, vaccineName: item.vaccineName, scheduleItemId: item.id },
      { onSettled: () => setPendingItemId(null) },
    );
  }

  if (batches.isError) {
    return (
      <section className="space-y-3">
        <PanelHeading>{t('vax.title')}</PanelHeading>
        <PanelError>{t('vax.loadError')}</PanelError>
        <Button size="sm" variant="secondary" onClick={() => void batches.refetch()}>
          {t('vax.retry')}
        </Button>
      </section>
    );
  }

  if (!batches.isPending && activeBatches.length === 0) {
    return (
      <section className="space-y-3">
        <PanelHeading>{t('vax.title')}</PanelHeading>
        <EmptyState
          icon={Syringe} illustration="health"
          title={t('vax.noBatches')}
          description={t('vax.noBatchesDesc')}
          action={
            <a
              href={pathForSection('livestock', 'batches')}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('vax.goBatches')}
            </a>
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PanelHeading>{t('vax.title')}</PanelHeading>

      <Field label={t('vax.batch')}>
        <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
          {activeBatches.map((b) => (
            <option key={b.id} value={b.id}>
              {batchLabel(b)}
            </option>
          ))}
        </Select>
      </Field>

      {(batches.isPending || vax.isPending) && <CardSkeleton />}

      {vax.isError && (
        <div className="space-y-2">
          <PanelError>{t('vax.loadError')}</PanelError>
          <Button size="sm" variant="secondary" onClick={() => void vax.refetch()}>
            {t('vax.retry')}
          </Button>
        </div>
      )}

      {vax.data && (
        <>
          <p className="text-xs text-muted-foreground tabular">{t('vax.age', { days: vax.data.ageDays })}</p>

          {items.length === 0 ? (
            <EmptyState
              icon={Syringe} illustration="health"
              title={t('vax.none')}
              description={t('vax.noneDesc')}
              size="compact"
            />
          ) : (
            <ol className="relative ms-2.5 space-y-5 border-s border-border ps-6">
              {items.map((item) => (
                <li key={item.id} className="relative">
                  <span
                    className="absolute -start-[35px] top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-background"
                    aria-hidden
                  >
                    {item.state === 'done' ? (
                      <CheckCircle2 className="h-[18px] w-[18px] text-success" />
                    ) : item.state === 'due' ? (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/60" />
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{item.vaccineName}</span>
                    {item.state === 'due' && (
                      <Badge variant="warning">{t('vax.dueBadge', { days: item.ageDays })}</Badge>
                    )}
                    {item.state === 'done' && <Badge variant="success">{t('vax.done')}</Badge>}
                    {item.state === 'upcoming' && (
                      <Badge variant="muted">
                        {t('vax.inDays', { count: Math.max(0, item.ageDays - vax.data.ageDays) })}
                      </Badge>
                    )}
                    {canWrite && item.state === 'due' && (
                      <Button
                        size="sm"
                        loading={record.isPending && pendingItemId === item.id}
                        disabled={record.isPending && pendingItemId !== item.id}
                        onClick={() => give(item)}
                      >
                        {t('vax.give')}
                      </Button>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular">
                    {t('vax.day', { days: item.ageDays })} · {item.type}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
