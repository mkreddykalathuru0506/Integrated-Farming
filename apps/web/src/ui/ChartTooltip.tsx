import type { ReactNode } from 'react';
import { cn } from './cn';

/**
 * The one chart tooltip (slice 11.10, chart-spec §6) — every Recharts chart wraps
 * this via <Tooltip content={<ChartTooltip … />} />. Floating layers wear POPOVER
 * tokens (matches DropdownMenu/Tooltip surfaces), never card.
 *
 * Money is always exact (`fmtInr`) in tooltips even when the axis compacts —
 * pass the right `format`. Text never wears the series color; identity comes
 * from the swatch.
 */

export type ChartTooltipPayloadItem = {
  name?: string | number;
  value?: number | string;
  color?: string;
  /** Raw datum for specialized rows. */
  payload?: unknown;
};

export type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: ReactNode;
  /** Value formatter (e.g. fmtInr for money, `${v.toFixed(1)}°C` for temps). */
  format?: (v: number) => string;
};

/** Styled floating container — reuse for bespoke tooltip bodies (e.g. temp logs). */
export function ChartTooltipFrame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-popover',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ChartTooltip({ active, payload, label, format }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltipFrame>
      {label != null && label !== '' && <p className="mb-0.5 font-semibold text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 text-muted-foreground">
          {p.color && <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: p.color }} />}
          {p.name != null && p.name !== '' && <span>{p.name}</span>}
          <span className="tabular ml-auto pl-2 font-semibold text-foreground">
            {format ? format(Number(p.value ?? 0)) : String(p.value ?? '')}
          </span>
        </p>
      ))}
    </ChartTooltipFrame>
  );
}
