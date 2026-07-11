import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from './cn';

export type FieldProps = {
  label: ReactNode;
  /** Marks the field required visually + aria-required on the input. */
  required?: boolean;
  /** Already-translated error message; sets aria-invalid + aria-describedby. */
  error?: string;
  /** Muted helper line under the input (hidden while an error shows). */
  hint?: string;
  /** A single input-like element (Input/Select/Textarea/InrInput…). Works with RHF `register` or manual props. */
  children: ReactElement;
  className?: string;
};

/**
 * Form-field wrapper: renders a real `<label htmlFor>` (no placeholder-as-label),
 * and wires aria-invalid/aria-describedby onto the child input for a11y.
 */
export function Field({ label, required, error, hint, children, className }: FieldProps) {
  const autoId = useId();
  const child = children as ReactElement<Record<string, unknown>>;
  const id = (child.props.id as string | undefined) ?? autoId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      {cloneElement(child, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
