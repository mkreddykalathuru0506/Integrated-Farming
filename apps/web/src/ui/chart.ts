import { prefersReducedMotion } from '../lib/motion';

/**
 * Harvest data-viz constants (slice 11.10, chart-spec.md).
 *
 * Two kinds of chart color — never mixed in one chart:
 *  - series IDENTITY → CHART_SERIES, fixed order, assigned in sequence
 *    (revenue/income = chart-1, cost/expense = chart-2, temperature = chart-3);
 *  - STATUS/severity → severityColor() (risk donut, out-of-range dots).
 */

export const CHART_SERIES = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
] as const;

/** 6+ categories: top 5 slots + "Other" in this. */
export const CHART_OTHER = 'hsl(var(--muted-foreground) / 0.45)';

/** Severity → status token (auto-themes in dark mode, unlike the old hex map). */
export function severityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return 'hsl(var(--destructive))';
    case 'WARNING':
      return 'hsl(var(--warning))';
    case 'INFO':
      return 'hsl(var(--primary))';
    default:
      return 'hsl(var(--muted-foreground))';
  }
}

/** Severity → text utility (ink-safe small text beside the mark). */
export function severityTextClass(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return 'text-destructive';
    case 'WARNING':
      return 'text-warning-ink';
    case 'INFO':
      return 'text-primary';
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Shared Recharts entrance (chart-spec §7): 600ms ease-out — the single sanctioned
 * exception to the 300ms UI cap (draw-in reads as data arriving, not chrome moving).
 * The global CSS reduced-motion kill does NOT reach Recharts (JS-driven), so the
 * prefersReducedMotion() gate here is mandatory. Evaluated per render (not module
 * scope) so the preference is read live. Spread onto <Bar>/<Pie>/<Line>/<Area>.
 */
export function chartAnim(): {
  isAnimationActive: boolean;
  animationDuration: number;
  animationEasing: 'ease-out';
  animationBegin: number;
} {
  return {
    isAnimationActive: !prefersReducedMotion(),
    animationDuration: 600,
    animationEasing: 'ease-out',
    animationBegin: 0,
  };
}

/** Axis tick standard (§4): text-only ticks, 11px, muted-foreground. */
export const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as const;

/** Grid standard (§4): horizontal only, solid, 1px, muted-foreground/0.4. */
export const GRID_PROPS = {
  vertical: false,
  stroke: 'hsl(var(--chart-grid) / 0.4)',
  strokeWidth: 1,
} as const;

/** Tooltip cursor for bar charts (§6). */
export const BAR_CURSOR = { fill: 'hsl(var(--muted))', fillOpacity: 0.4 } as const;

/** Tooltip cursor for line/area charts (§6). */
export const LINE_CURSOR = { stroke: 'hsl(var(--border))' } as const;
