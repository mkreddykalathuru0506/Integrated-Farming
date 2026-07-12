import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn, Input } from '../ui';

export type OtpCodeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  value: string;
  onChange: (code: string) => void;
};

/**
 * Single 6-digit one-time-code input: numeric keypad on mobile
 * (`inputMode="numeric"`), OS/browser code autofill (`autoComplete="one-time-code"`),
 * and a digits-only 6-char mask.
 */
export const OtpCodeInput = forwardRef<HTMLInputElement, OtpCodeInputProps>(
  ({ value, onChange, className, ...props }, ref) => (
    <Input
      ref={ref}
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      className={cn('text-center font-mono text-lg tracking-[0.5em]', className)}
    />
  ),
);
OtpCodeInput.displayName = 'OtpCodeInput';
