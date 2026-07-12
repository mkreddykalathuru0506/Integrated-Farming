import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn, Input } from '../ui';

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/**
 * Password field with a show/hide visibility toggle. Ref + props (id, aria-*)
 * flow to the inner <input>, so it slots into <Field> and RHF `register` as-is.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const { t } = useTranslation();
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} {...props} type={show ? 'text' : 'password'} className={cn('pr-12', className)} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? t('auth.password.hide') : t('auth.password.show')}
          aria-pressed={show}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
