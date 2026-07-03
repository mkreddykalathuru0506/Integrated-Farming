import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, DataRow, Input, PanelError, PanelHeading, PanelNote, Select } from '../ui';
import { createLog, listBatches, listLogs, type Batch, type DailyLog } from './api';
import { enqueueAndFlush, flush, pendingCount, type Poster, type QueuedLog } from '../offline/queue';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; logs: DailyLog[] };
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

export function DailyLogPanel({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [batches, setBatches] = useState<Batch[]>([]);
  const [type, setType] = useState<string>('FEED');
  const [batchId, setBatchId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pending, setPending] = useState(0);

  const poster: Poster = useCallback(
    async (item: QueuedLog) => {
      if (!accessToken) throw new Error('no-auth');
      await createLog(accessToken, farmId, {
        type: item.type,
        batchId: item.batchId,
        quantity: item.quantity,
        unit: item.unit,
        clientLogId: item.clientLogId,
      });
    },
    [accessToken, farmId],
  );

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listLogs(accessToken, farmId)
      .then((r) => setLoad({ status: 'ready', logs: r.logs }))
      .catch(() => setLoad({ status: 'error' }));
    void pendingCount().then(setPending);
  }, [accessToken, farmId]);

  const syncThenRefresh = useCallback(() => {
    void flush(poster).finally(refresh);
  }, [poster, refresh]);

  useEffect(() => {
    syncThenRefresh();
    window.addEventListener('online', syncThenRefresh);
    return () => window.removeEventListener('online', syncThenRefresh);
  }, [syncThenRefresh]);

  useEffect(() => {
    if (!accessToken) return;
    listBatches(accessToken, farmId)
      .then((r) => {
        const active = r.batches.filter((b) => b.status === 'ACTIVE');
        setBatches(active);
        setBatchId((prev) => prev || active[0]?.id || '');
      })
      .catch(() => undefined);
  }, [accessToken, farmId]);

  async function onLog(e: FormEvent) {
    e.preventDefault();
    if (!batchId) return;
    const item: QueuedLog = {
      clientLogId: genId(),
      type,
      batchId,
      quantity: Number(quantity),
      unit: UNIT_FOR[type] ?? 'units',
    };
    await enqueueAndFlush(item, poster);
    setQuantity('');
    refresh();
  }

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

      {batches.length > 0 && (
        <form onSubmit={onLog} className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <div className="flex gap-2">
            <Select value={type} onChange={(e) => setType(e.target.value)} className="flex-1" data-testid="log-type">
              {LOG_TYPES.map((lt) => (
                <option key={lt} value={lt}>
                  {t(`logs.type.${lt}`)}
                </option>
              ))}
            </Select>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="flex-1" data-testid="log-batch">
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`${t('logs.quantity')} (${UNIT_FOR[type]})`}
              required
              className="flex-1"
              data-testid="log-qty"
            />
            <Button type="submit" data-testid="log-submit">
              {t('logs.log')}
            </Button>
          </div>
        </form>
      )}

      {load.status === 'loading' && <PanelNote>{t('logs.loading')}</PanelNote>}
      {load.status === 'error' && <PanelError>{t('logs.error')}</PanelError>}
      {load.status === 'ready' && load.logs.length === 0 && <PanelNote>{t('logs.empty')}</PanelNote>}
      {load.status === 'ready' && load.logs.length > 0 && (
        <ul className="space-y-1 text-sm" data-testid="log-recent">
          {load.logs.slice(0, 8).map((l) => (
            <DataRow key={l.id} className="py-1.5">
              <span className="text-foreground">{t(`logs.type.${l.type}`)}</span>
              <span className="text-muted-foreground tabular">
                {l.quantity} {l.unit}
              </span>
            </DataRow>
          ))}
        </ul>
      )}
    </section>
  );
}
