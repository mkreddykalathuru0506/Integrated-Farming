import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/**
 * Shared building blocks for the inner feature panels (Phase 10 M3).
 * They encode the Harvest theme so panels stay on-token — no raw slate/red greys.
 */

/** Section heading at the top of a feature panel, with an optional right-aligned action slot. */
export function PanelHeading({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

/** Muted helper line — loading / empty / hint text. */
export function PanelNote({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

/** Inline error line (announced to screen readers). */
export function PanelError({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p role="alert" className={cn('text-sm text-destructive', className)} {...props} />;
}

/** Warm sub-surface used to group a form or secondary block inside a Card. */
export function SubPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md bg-secondary/60 p-3', className)} {...props} />;
}

/** A bordered list row — the default shape for data lists inside a panel. */
export function DataRow({ className, ...props }: HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2',
        className,
      )}
      {...props}
    />
  );
}
