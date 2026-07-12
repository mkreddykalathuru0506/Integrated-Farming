import { useTranslation } from 'react-i18next';
import { CheckCircle2, CloudUpload, Leaf, Snowflake } from 'lucide-react';
import { Badge } from '../ui';
import { ENTRANCE } from './reveal';

/**
 * Stylised product mock for the hero — a simplified dashboard composition built
 * from real kit components and Harvest tokens (no screenshot bitmaps). Decorative:
 * the whole block is aria-hidden; the hero copy carries the meaning. Sample values
 * are illustrative constants; every word goes through i18n.
 */

/** Egg-collection sparkbars (relative heights, %). The last bar is "today". */
const BARS = [34, 52, 42, 68, 56, 88, 74];

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/70 px-2.5 py-2">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-base font-bold tabular">{value}</p>
    </div>
  );
}

function TaskRow({ label, done, dueLabel, doneLabel }: { label: string; done: boolean; dueLabel: string; doneLabel: string }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1.5">
      <span className="flex min-w-0 items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
        ) : (
          <span className="grid h-3.5 w-3.5 shrink-0 place-items-center">
            <span className="h-2 w-2 rounded-full bg-warning" />
          </span>
        )}
        <span className="truncate text-xs text-foreground">{label}</span>
      </span>
      <Badge variant={done ? 'success' : 'warning'} className="px-1.5 text-[10px]">
        {done ? doneLabel : dueLabel}
      </Badge>
    </li>
  );
}

export function HeroMock() {
  const { t } = useTranslation();
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-lg" aria-hidden="true">
      {/* backing deep-pine card for depth */}
      <div className="absolute -right-3 top-8 hidden h-[85%] w-[72%] rotate-2 rounded-lg bg-gradient-to-b from-sidebar to-[hsl(var(--sidebar-2))] shadow-elevated sm:block" />

      {/* main app window */}
      <div
        className={`relative rounded-lg border border-border/80 bg-card shadow-elevated ${ENTRANCE}`}
        style={{ animationDelay: '120ms' }}
      >
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive/50" />
            <span className="h-2 w-2 rounded-full bg-warning/50" />
            <span className="h-2 w-2 rounded-full bg-success/50" />
          </span>
          <span className="ml-2 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="grid h-[18px] w-[18px] place-items-center rounded bg-primary text-primary-foreground">
              <Leaf className="h-2.5 w-2.5" />
            </span>
            <span className="truncate">{t('landing.mock.farm')}</span>
          </span>
          <Badge variant="muted" className="ml-auto px-1.5 text-[10px]">
            {t('landing.mock.role')}
          </Badge>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <p className="text-xs text-muted-foreground">{t('landing.mock.greeting')}</p>

          {/* profit hero */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('landing.mock.profitLabel')}
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <p className="font-display text-3xl font-bold tabular text-foreground">{t('landing.mock.profitValue')}</p>
              <Badge variant="success" className="px-1.5 text-[10px]">
                {t('landing.mock.profitDelta')}
              </Badge>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <Kpi label={t('landing.mock.kpiFcr')} value={t('landing.mock.kpiFcrValue')} />
            <Kpi label={t('landing.mock.kpiBirds')} value={t('landing.mock.kpiBirdsValue')} />
            <Kpi label={t('landing.mock.kpiTasks')} value={t('landing.mock.kpiTasksValue')} />
          </div>

          {/* sparkbars */}
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('landing.mock.chartLabel')}
            </p>
            <div className="flex h-16 items-end gap-1.5">
              {BARS.map((h, i) => (
                <span
                  key={i}
                  className={`w-full rounded-sm ${i === BARS.length - 1 ? 'bg-gradient-to-t from-primary to-accent' : 'bg-primary/35'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* today's tasks */}
          <div className="rounded-md border border-border/70 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('landing.mock.tasksTitle')}
            </p>
            <ul className="mt-1 divide-y divide-border/60">
              <TaskRow label={t('landing.mock.task1')} done doneLabel={t('landing.mock.taskDone')} dueLabel={t('landing.mock.taskDue')} />
              <TaskRow label={t('landing.mock.task2')} done={false} doneLabel={t('landing.mock.taskDone')} dueLabel={t('landing.mock.taskDue')} />
              <TaskRow label={t('landing.mock.task3')} done doneLabel={t('landing.mock.taskDone')} dueLabel={t('landing.mock.taskDue')} />
            </ul>
          </div>
        </div>
      </div>

      {/* floating proof chips */}
      <div
        className={`absolute top-16 -right-2 flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-popover sm:-right-6 ${ENTRANCE}`}
        style={{ animationDelay: '220ms' }}
      >
        <CloudUpload className="h-3.5 w-3.5 text-success" />
        {t('landing.mock.syncChip')}
      </div>
      <div
        className={`absolute -bottom-4 left-2 flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-[11px] font-semibold tabular text-foreground shadow-popover sm:-left-6 ${ENTRANCE}`}
        style={{ animationDelay: '280ms' }}
      >
        <Snowflake className="h-3.5 w-3.5 text-primary" />
        {t('landing.mock.coldChip')}
      </div>
    </div>
  );
}
