import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/** Keyboard-key chip, e.g. shortcut hints in tooltips and menus. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
