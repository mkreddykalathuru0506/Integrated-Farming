import { forwardRef, type InputHTMLAttributes } from 'react';
import { rupeesToPaise } from '../lib/format';
import { cn } from './cn';
import { Input } from './Input';

export type InrInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  /** Rupee string held by the caller (what the user typed, e.g. "1250.50"). */
  value: string;
  /** Fired on every edit: integer-paise string (null while invalid) + the raw rupee text. */
  onChangePaise: (valuePaise: string | null, rupees: string) => void;
};

/**
 * Money input: ₹ prefix, decimal keypad, integer-paise output via rupeesToPaise
 * (max 2 decimals, never floats — §0 money rule). Invalid text keeps the field
 * editable but flags aria-invalid + destructive border.
 */
export const InrInput = forwardRef<HTMLInputElement, InrInputProps>(
  ({ value, onChangePaise, className, 'aria-invalid': ariaInvalid, ...props }, ref) => {
    const own = value.trim() !== '' && rupeesToPaise(value) === null;
    const invalid = ariaInvalid === true || ariaInvalid === 'true' || (ariaInvalid === undefined && own);
    return (
      <div className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
        >
          ₹
        </span>
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChangePaise(rupeesToPaise(e.target.value), e.target.value)}
          className={cn(
            'tabular pl-8',
            invalid &&
              'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
InrInput.displayName = 'InrInput';
