import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'block min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
