import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, PanelHeading, PanelNote, Select } from '../ui';
import { getVaccinations, listBatches, recordVaccination, type Batch, type Vaccinations } from './api';

export function VaccinationPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState('');
  const [vax, setVax] = useState<Vaccinations | null>(null);

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

  const refresh = useCallback(() => {
    if (!accessToken || !batchId) return;
    getVaccinations(accessToken, farmId, batchId)
      .then(setVax)
      .catch(() => setVax(null));
  }, [accessToken, farmId, batchId]);

  useEffect(refresh, [refresh]);

  async function give(vaccineName: string) {
    if (!accessToken || !batchId) return;
    await recordVaccination(accessToken, farmId, { batchId, vaccineName }).then(refresh).catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('vax.title')}</PanelHeading>

      {batches.length === 0 ? (
        <PanelNote>{t('vax.noBatches')}</PanelNote>
      ) : (
        <>
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)} aria-label={t('vax.batch')}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code}
              </option>
            ))}
          </Select>

          {vax && (
            <div className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground">{t('vax.age', { days: vax.ageDays })}</p>

              {vax.due.length > 0 && (
                <div>
                  <p className="font-medium text-destructive">{t('vax.due')}</p>
                  <ul className="space-y-1">
                    {vax.due.map((v) => (
                      <li key={v.id} className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-1.5">
                        <span>
                          {v.vaccineName} <span className="text-xs text-muted-foreground tabular">· d{v.ageDays}</span>
                        </span>
                        {canWrite && (
                          <Button size="sm" onClick={() => void give(v.vaccineName)}>
                            {t('vax.give')}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {vax.upcoming.length > 0 && (
                <p className="text-muted-foreground">
                  {t('vax.upcoming')}: {vax.upcoming.map((v) => v.vaccineName).join(', ')}
                </p>
              )}
              {vax.done.length > 0 && (
                <p className="text-success">
                  {t('vax.done')}: {vax.done.map((v) => v.vaccineName).join(', ')}
                </p>
              )}
              {vax.due.length === 0 && vax.upcoming.length === 0 && vax.done.length === 0 && (
                <p className="text-muted-foreground">{t('vax.none')}</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
