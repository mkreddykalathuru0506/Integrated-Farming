import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const button = cva(
  'inline-flex items-center justify-center rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-600',
        secondary:
          'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400',
        ghost: 'text-slate-700 hover:bg-slate-100 focus:ring-slate-300',
        danger: 'text-red-600 hover:bg-red-50 focus:ring-red-400',
      },
      size: {
        sm: 'min-h-9 px-2 text-xs',
        md: 'min-h-11 px-4 text-sm',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size, full }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
