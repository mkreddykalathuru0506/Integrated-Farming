import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800',
        className,
      )}
      {...props}
    />
  );
}
