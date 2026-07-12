import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Harvest signature: a faint gold hairline across the top edge (slice 11.10 —
   *  promoted from the Dashboard-local Panel so every surface can share it). */
  lined?: boolean;
};

export function Card({ className, lined, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 text-card-foreground shadow-card',
        lined &&
          "relative before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-accent/40 before:to-transparent before:content-['']",
        className,
      )}
      {...props}
    />
  );
}
