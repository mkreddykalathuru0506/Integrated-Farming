import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { NotebookPen } from 'lucide-react';
import { useBatches } from '../api/hooks';
import { useLogs } from '../api/daily.hooks';
import { useFarmApi } from '../api/FarmContext';
import { farmKeys } from '../api/keys';
import { fmtDateTime } from '../lib/format';
import type { DailyLog } from './api';
import { enqueueAndFlush, flush, pendingCount, type Poster, type QueuedLog } from '../offline/queue';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  Input,
  PanelError,
  PanelHeading,
  Select,
  SubPanel,
  cn,
  type DataTableColumn,
} from '../ui';
import { LoadErrorNote } from './LoadErrorNote';

const LOG_TYPES = ['FEED', 'EGGS', 'WEIGHT'] as const;
const UNIT_FOR: Record<string, string> = { FEED: 'kg', EGGS: 'units', WEIGHT: 'kg' };

function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Daily log (slice 11.6a rewrite). The offline IndexedDB queue is untouched
 * functionally — enqueue-then-flush with clientLogId idempotency, flush on the
 * 'online' event, pending chip. The shell is modernized: big-button type
 * selector + numeric-friendly inline form (LABOUR phone flow, 360px-first),
 * a server-side type filter and a DataTable of recent logs.
 */
export function DailyLogPanel(_props: { farmId: string }) {
  const { t } = useTranslation();
  const { farmId, fetchJson } = useFarmApi();
  const queryClient = useQueryClient();

  const [type, setType] = useState<string>('FEED');
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [filter, setFilter] = useState<string>('');

  const batches = useBatches();
  const logs = useLogs(filter || undefined);

  const activeBatches = useMemo(
    () => (batches.data ?? []).filter((b) => b.status === 'ACTIVE'),
    [batches.data],
  );
  const batchCodeById = useMemo(
    () => new Map((batches.data ?? []).map((b) => [b.id, b.code] as const)),
    [batches.data],
  );

  // Poster used by the offline queue: must reject on failure so items are kept.
  const poster: Poster = useCallback(
    async (item: QueuedLog) => {
      await fetchJson('/api/farm/logs', {
        method: 'POST',
        body: JSON.stringify({
          type: item.type,
          batchId: item.batchId,
          quantity: item.quantity,
          unit: item.unit,
          clientLogId: item.clientLogId,
        }),
      });
    },
    [fetchJson],
  );

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: farmKeys.list(farmId, 'logs') });
    void pendingCount().then(setPending);
  }, [queryClient, farmId]);

  const syncThenRefresh = useCallback(() => {
    void flush(poster).finally(refresh);
  }, [poster, refresh]);

  useEffect(() => {
    syncThenRefresh();
    window.addEventListener('online', syncThenRefresh);
    return () => window.removeEventListener('online', syncThenRefresh);
  }, [syncThenRefresh]);

  useEffect(() => {
    if (!batchId && activeBatches.length > 0) setBatchId(activeBatches[0]!.id);
  }, [batchId, activeBatches]);

  async function onLog(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const qty = Number(quantity);
    if (!batchId || !Number.isFinite(qty) || qty <= 0) {
      setFormError(t('logs.qtyInvalid'));
      return;
    }
    const item: QueuedLog = {
      clientLogId: genId(),
      type,
      batchId,
      quantity: qty,
      unit: UNIT_FOR[type] ?? 'units',
    };
    await enqueueAndFlush(item, poster);
    setQuantity('');
    refresh();
  }

  const columns: DataTableColumn<DailyLog>[] = [
    {
      header: 'logs.cols.batch',
      accessor: (l) => (l.batchId ? (batchCodeById.get(l.batchId) ?? l.batchId) : '—'),
    },
    { header: 'logs.cols.type', accessor: (l) => t(`logs.type.${l.type}`) },
    {
      header: 'logs.cols.qty',
      accessor: 'quantity',
      align: 'right',
      cell: (l) => (
        <span>
          {l.quantity} <span className="text-xs text-muted-foreground">{l.unit}</span>
        </span>
      ),
    },
    { header: 'logs.cols.loggedAt', accessor: (l) => fmtDateTime(l.loggedAt) },
  ];

  return (
    <section className="space-y-3" data-testid="daily-log">
      <PanelHeading
        action={
          pending > 0 ? (
            <Badge variant="warning" data-testid="log-pending">
              {t('logs.pending', { count: pending })}
            </Badge>
          ) : undefined
        }
      >
        {t('logs.title')}
      </PanelHeading>

      {activeBatches.length > 0 && (
        <SubPanel>
          <form onSubmit={(e) => void onLog(e)} className="space-y-3" noValidate>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('logs.typeLabel')} data-testid="log-type">
              {LOG_TYPES.map((lt) => (
                <button
                  key={lt}
                  type="button"
                  aria-pressed={type === lt}
                  onClick={() => setType(lt)}
                  className={cn(
                    'min-h-12 rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
                    type === lt
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-input bg-card text-foreground hover:bg-muted',
                  )}
                >
                  {t(`logs.type.${lt}`)}
                </button>
              ))}
            </div>
            <Field label={t('logs.batch')}>
              <Select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                data-testid="log-batch"
              >
                {activeBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={`${t('logs.quantity')} (${UNIT_FOR[type]})`}
              error={formError ?? undefined}
            >
              <Input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setFormError(null);
                }}
                required
                className="min-h-14 text-lg"
                data-testid="log-qty"
              />
            </Field>
            <Button type="submit" full className="min-h-14 text-base" data-testid="log-submit">
              {t('logs.log')}
            </Button>
          </form>
        </SubPanel>
      )}

      {batches.data && activeBatches.length === 0 && (
        <PanelError>{t('logs.noBatches')}</PanelError>
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('logs.recent')}
        </h3>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label={t('logs.filterLabel')}
          className="w-36"
        >
          <option value="">{t('logs.filterAll')}</option>
          {LOG_TYPES.map((lt) => (
            <option key={lt} value={lt}>
              {t(`logs.type.${lt}`)}
            </option>
          ))}
        </Select>
      </div>

      <div data-testid="log-recent">
        {logs.isError && !logs.data ? (
          <LoadErrorNote
            text={t('logs.error')}
            retryLabel={t('logs.retry')}
            onRetry={() => void logs.refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            data={logs.data}
            isLoading={logs.isPending}
            pageSize={10}
            getRowId={(l) => l.id}
            emptyState={
              <EmptyState
                icon={NotebookPen}
                title={t('logs.empty')}
                description={t('logs.emptyHint')}
                size="compact"
              />
            }
          />
        )}
      </div>
    </section>
  );
}
