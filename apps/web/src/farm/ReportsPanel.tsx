import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button, DataRow, Input, PanelHeading, PanelNote, Select } from '../ui';
import {
  createReportSchedule,
  downloadReport,
  listReportSchedules,
  runReportSchedule,
  type ReportSchedule,
} from './api';

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

export function ReportsPanel({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('WEEKLY');
  const [format, setFormat] = useState('pdf');
  const [recipient, setRecipient] = useState('');

  const refresh = useCallback(() => {
    if (!accessToken) return;
    listReportSchedules(accessToken, farmId).then((r) => setSchedules(r.schedules)).catch(() => undefined);
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    await createReportSchedule(accessToken, farmId, { name, frequency, format, recipient })
      .then(() => {
        setName('');
        setRecipient('');
        refresh();
      })
      .catch(() => undefined);
  }

  async function onRun(id: string) {
    if (!accessToken) return;
    await runReportSchedule(accessToken, farmId, id).then(refresh).catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <PanelHeading>{t('reports.title')}</PanelHeading>
      <PanelNote>{t('reports.blurb')}</PanelNote>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => accessToken && void downloadReport(accessToken, farmId, 'pdf')} className="flex-1">
          {t('reports.pdf')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => accessToken && void downloadReport(accessToken, farmId, 'xlsx')} className="flex-1">
          {t('reports.xlsx')}
        </Button>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('reports.schedules')}</p>
        {schedules.length === 0 ? (
          <PanelNote>{t('reports.noSchedules')}</PanelNote>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {schedules.map((s) => (
              <DataRow key={s.id} className="py-1.5">
                <span className="truncate text-foreground">
                  {s.name} · {t(`reports.freq.${s.frequency}`)} · {s.format.toUpperCase()}
                  <span className="block text-xs text-muted-foreground tabular">{t('reports.next', { date: fmtDate(s.nextRunAt) })}</span>
                </span>
                {canWrite && (
                  <button type="button" onClick={() => void onRun(s.id)} className="shrink-0 text-xs font-semibold text-success hover:underline">
                    {t('reports.runNow')}
                  </button>
                )}
              </DataRow>
            ))}
          </ul>
        )}
      </div>

      {canWrite && (
        <form onSubmit={onCreate} className="space-y-2 rounded-xl bg-secondary/60 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('reports.schedule')}</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('reports.scheduleName')} required />
          <div className="flex gap-2">
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="flex-1">
              <option value="DAILY">{t('reports.freq.DAILY')}</option>
              <option value="WEEKLY">{t('reports.freq.WEEKLY')}</option>
              <option value="MONTHLY">{t('reports.freq.MONTHLY')}</option>
            </Select>
            <Select value={format} onChange={(e) => setFormat(e.target.value)} className="w-28">
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel</option>
            </Select>
          </div>
          <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={t('reports.recipient')} required />
          <Button type="submit" full variant="secondary">
            {t('reports.addSchedule')}
          </Button>
        </form>
      )}
    </section>
  );
}
