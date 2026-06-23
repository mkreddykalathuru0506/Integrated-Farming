import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../ui';
import { downloadReport } from './api';

export function ReportsPanel({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('reports.title')}</h2>
      <p className="text-sm text-slate-500">{t('reports.blurb')}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => accessToken && void downloadReport(accessToken, farmId, 'pdf')}
          className="flex-1"
        >
          {t('reports.pdf')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => accessToken && void downloadReport(accessToken, farmId, 'xlsx')}
          className="flex-1"
        >
          {t('reports.xlsx')}
        </Button>
      </div>
    </section>
  );
}
