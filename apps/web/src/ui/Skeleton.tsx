import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** Base pulse block. Purely decorative — always hidden from the accessibility tree. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-md bg-muted motion-safe:animate-pulse', className)}
      {...props}
    />
  );
}

/** Placeholder for a data table: a header line + `rows` body lines of `cols` cells. */
export function TableSkeleton({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  const grid = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` };
  return (
    <div data-testid="table-skeleton" aria-hidden="true" className={cn('space-y-3', className)}>
      <div className="grid gap-3" style={grid}>
        {Array.from({ length: cols }, (_, c) => (
          <Skeleton key={c} className="h-3 w-2/3 bg-secondary" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid gap-3" style={grid}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a content card: title line + a few text lines. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-testid="card-skeleton"
      aria-hidden="true"
      className={cn('rounded-lg border border-border bg-card p-5 shadow-card', className)}
    >
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}

/** Placeholder for a KPI/stat tile: small label + large number. */
export function StatSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-testid="stat-skeleton"
      aria-hidden="true"
      className={cn('rounded-lg border border-border bg-card p-4 shadow-card', className)}
    >
      <Skeleton className="h-3 w-1/2 bg-secondary" />
      <Skeleton className="mt-3 h-7 w-2/3" />
    </div>
  );
}
