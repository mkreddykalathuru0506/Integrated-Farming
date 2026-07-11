import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';
import { Spinner } from './Spinner';

const button = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        secondary: 'border border-input bg-card text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        danger: 'text-destructive hover:bg-destructive/10',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        accent: 'bg-accent text-accent-foreground shadow-sm hover:bg-accent/90',
      },
      size: {
        sm: 'min-h-9 px-3 text-xs',
        md: 'min-h-11 px-4 text-sm',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    /** Busy state: disables the button and overlays a spinner, preserving the width. */
    loading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, full, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size, full }), loading && 'relative', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="absolute inset-0 grid place-items-center" aria-hidden>
            <Spinner />
          </span>
          <span className="invisible inline-flex items-center gap-2">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  ),
);
Button.displayName = 'Button';
