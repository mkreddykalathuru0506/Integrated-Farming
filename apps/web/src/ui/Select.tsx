import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from './cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 disabled:bg-slate-100',
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = 'Select';
