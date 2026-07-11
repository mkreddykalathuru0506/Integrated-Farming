import { CloudSun, MapPin, RefreshCw, ThermometerSun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAckRisk, useOpenRiskFlags, useRefreshWeather, useWeather } from '../api/ops.hooks';
import { fmtDate, fmtDateTime } from '../lib/format';
import { isApiError } from '../lib/http';
import {
  Badge,
  Button,
  CardSkeleton,
  DataTable,
  EmptyState,
  PanelError,
  PanelHeading,
  type BadgeProps,
  type DataTableColumn,
} from '../ui';
import { SpaLink } from './SpaLink';
import type { RiskFlag } from './api';

const SEVERITY_VARIANT: Record<string, BadgeProps['variant']> = {
  CRITICAL: 'destructive',
  WARNING: 'warning',
  INFO: 'muted',
};

export function WeatherPanel({ canWrite }: { farmId: string; canWrite: boolean }) {
  const { t } = useTranslation();
  const weather = useWeather();
  const refresh = useRefreshWeather();
  const risks = useOpenRiskFlags();
  const ackRisk = useAckRisk();

  const locationRequired = isApiError(weather.error) && weather.error.code === 'LOCATION_REQUIRED';
  const current = weather.data?.weather;
  const heatRisk = weather.data?.risk;

  const riskColumns: DataTableColumn<RiskFlag>[] = [
    {
      header: 'weather.colSeverity',
      accessor: (r) => r.severity,
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Badge variant={SEVERITY_VARIANT[r.severity] ?? 'default'}>{r.severity}</Badge>
          <span className="text-xs text-muted-foreground">{t(`risk.type.${r.type}`)}</span>
        </span>
      ),
    },
    { header: 'weather.colReason', accessor: 'reason' },
    {
      header: 'weather.colRaised',
      accessor: 'createdAt',
      cell: (r) => fmtDate(r.createdAt),
    },
    ...(canWrite
      ? [
          {
            header: 'weather.ack',
            cell: (r: RiskFlag) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={ackRisk.isPending && ackRisk.variables === r.id}
                onClick={() => ackRisk.mutate(r.id)}
              >
                {t('weather.ack')}
              </Button>
            ),
          } satisfies DataTableColumn<RiskFlag>,
        ]
      : []),
  ];

  return (
    <section className="space-y-3">
      <PanelHeading>{t('weather.title')}</PanelHeading>

      {/* Current conditions: loading → skeleton; LOCATION_REQUIRED → settings deep-link;
          other errors → real error + Retry (no more permanent-loading trap). */}
      {weather.isPending && <CardSkeleton />}

      {weather.isError && locationRequired && (
        <EmptyState
          icon={MapPin}
          title={t('weather.needLocationTitle')}
          description={t('weather.needLocation')}
          size="compact"
          // Farm settings is OWNER/MANAGER-only (canWrite): for VET/ACCOUNTANT the
          // link would resolve to Overview, so drop the dead-end CTA for them.
          action={
            canWrite ? (
              <SpaLink href="/settings/settings" className="text-sm">
                {t('weather.goSettings')} →
              </SpaLink>
            ) : undefined
          }
        />
      )}

      {weather.isError && !locationRequired && (
        <div className="space-y-2">
          <PanelError>{t('weather.error')}</PanelError>
          <Button type="button" variant="secondary" size="sm" onClick={() => void weather.refetch()}>
            {t('weather.retry')}
          </Button>
        </div>
      )}

      {current && (
        <div className="rounded-xl bg-accent/10 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-2xl font-semibold text-accent tabular">
              {current.tempC}°C
              {current.humidityPct !== null && (
                <span className="ml-2 text-sm font-medium">
                  {t('weather.humidity', { pct: current.humidityPct })}
                </span>
              )}
              {current.condition && (
                <span className="ml-2 text-sm font-medium capitalize">{current.condition}</span>
              )}
            </p>
            {current.source === 'mock' && <Badge variant="warning">{t('weather.mockBadge')}</Badge>}
          </div>
          <p className="mt-1 text-xs text-accent tabular">
            {t('weather.asOf', { ts: fmtDateTime(current.fetchedAt), source: current.source })}
          </p>
          {canWrite && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              loading={refresh.isPending}
              onClick={() => refresh.mutate()}
            >
              <RefreshCw aria-hidden />
              {t('weather.refresh')}
            </Button>
          )}
        </div>
      )}

      {heatRisk?.atRisk && (
        <div className="flex items-start gap-2 rounded-xl bg-warning/12 p-3 text-sm text-warning" role="alert">
          <ThermometerSun className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">{t('weather.heatRisk')}</span>
            <span className="block text-xs">{heatRisk.reason}</span>
          </span>
        </div>
      )}

      {/* Open risk alerts */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('weather.alerts')}
        </p>
        {risks.isError ? (
          <div className="space-y-2">
            <PanelError>{t('weather.alertsError')}</PanelError>
            <Button type="button" variant="secondary" size="sm" onClick={() => void risks.refetch()}>
              {t('weather.retry')}
            </Button>
          </div>
        ) : (
          <DataTable
            columns={riskColumns}
            data={risks.data}
            isLoading={risks.isPending}
            pageSize={10}
            getRowId={(r) => r.id}
            emptyState={<EmptyState icon={CloudSun} title={t('weather.noAlerts')} size="compact" />}
          />
        )}
      </div>
    </section>
  );
}
