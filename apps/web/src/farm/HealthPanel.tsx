import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, Input, Select } from '../ui';
import {
  getWithdrawal,
  listBatches,
  markSaleReady,
  recordMedication,
  type Batch,
  type WithdrawalStatus,
} from './api';

export function HealthPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState<WithdrawalStatus | null>(null);
  const [drug, setDrug] = useState('');
  const [days, setDays] = useState('7');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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

  const refreshStatus = useCallback(() => {
    if (!accessToken || !batchId) return;
    getWithdrawal(accessToken, farmId, batchId)
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [accessToken, farmId, batchId]);

  useEffect(refreshStatus, [refreshStatus]);

  async function onMed(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !batchId) return;
    setMsg(null);
    try {
      await recordMedication(accessToken, farmId, { batchId, drugName: drug, withdrawalDays: Number(days) });
      setDrug('');
      refreshStatus();
    } catch {
      setMsg({ kind: 'err', text: t('health.medError') });
    }
  }

  async function onSaleReady() {
    if (!accessToken || !batchId) return;
    setMsg(null);
    try {
      await markSaleReady(accessToken, farmId, { batchId });
      setMsg({ kind: 'ok', text: t('health.saleReadyOk') });
      refreshStatus();
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error && err.message === 'WITHDRAWAL_ACTIVE' ? t('health.blocked') : t('health.saleReadyErr'),
      });
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('health.title')}</h2>

      {batches.length === 0 ? (
        <p className="text-sm text-slate-500">{t('health.noBatches')}</p>
      ) : (
        <>
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)} aria-label={t('health.batch')}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code}
              </option>
            ))}
          </Select>

          {status && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${status.underWithdrawal ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
            >
              {status.underWithdrawal
                ? t('health.under', { date: status.until ? new Date(status.until).toLocaleDateString() : '' })
                : t('health.clear')}
            </p>
          )}

          {msg && (
            <p role="alert" className={`text-sm ${msg.kind === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
              {msg.text}
            </p>
          )}

          {canWrite && (
            <>
              <form onSubmit={onMed} className="space-y-2 rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t('health.recordMed')}</p>
                <Input value={drug} onChange={(e) => setDrug(e.target.value)} placeholder={t('health.drug')} required />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    placeholder={t('health.withdrawalDays')}
                    className="flex-1"
                  />
                  <Button type="submit">{t('health.record')}</Button>
                </div>
              </form>
              <Button variant="secondary" full onClick={() => void onSaleReady()}>
                {t('health.markSaleReady')}
              </Button>
            </>
          )}
        </>
      )}
    </section>
  );
}
