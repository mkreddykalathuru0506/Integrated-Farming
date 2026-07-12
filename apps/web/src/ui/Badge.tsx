import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

const badge = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        // Text sits on the -ink tokens (AA at 12px); the /12 washes keep the status hue.
        default: 'bg-secondary text-secondary-foreground',
        success: 'bg-success/12 text-success-ink',
        warning: 'bg-warning/15 text-warning-ink',
        destructive: 'bg-destructive/12 text-destructive',
        accent: 'bg-accent/12 text-accent-ink',
        muted: 'bg-muted text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badge({ variant }), className)} {...props} />;
}
