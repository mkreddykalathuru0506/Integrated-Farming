import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { registerRequest } from './api';
import { authErrorKey } from './errors';
import { passwordStrength } from './passwordStrength';
import { PasswordInput } from './PasswordInput';
import { Button, Field, Input, PanelError } from '../ui';

type Props = {
  /** Back to the sign-in view. */
  onLogin: () => void;
};

const PHONE_RE = /^\+?[0-9]{8,15}$/;

type RegisterValues = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

/** Create-account form. Success auto-signs-in via the normal login endpoint. */
export function RegisterForm({ onLogin }: Props) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t('auth.register.errors.name')),
        email: z.string().trim().email(t('auth.register.errors.email')),
        phone: z
          .string()
          .trim()
          .refine((v) => v === '' || PHONE_RE.test(v), t('auth.register.errors.phone')),
        password: z.string().min(8, t('auth.register.errors.passwordMin')),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  });

  const password = watch('password');
  const strengthHint =
    password && password.length > 0
      ? t(`auth.register.strength.${passwordStrength(password)}`)
      : t('auth.register.passwordHint');

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerRequest({
        email: values.email.trim(),
        name: values.name.trim(),
        password: values.password,
        ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
      });
      // Land straight in the app: the register endpoint returns no tokens.
      await login(values.email.trim(), values.password);
    } catch (err) {
      setFormError(t(authErrorKey(err)));
    }
  });

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
      <h2 className="font-display text-lg font-bold text-foreground">{t('auth.register.title')}</h2>

      <Field label={t('auth.register.name')} required error={errors.name?.message}>
        <Input autoComplete="name" {...register('name')} />
      </Field>

      <Field label={t('auth.register.email')} required error={errors.email?.message}>
        <Input type="email" autoComplete="username" {...register('email')} />
      </Field>

      <Field label={t('auth.register.phone')} error={errors.phone?.message}>
        <Input type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} />
      </Field>

      <Field
        label={t('auth.register.password')}
        required
        error={errors.password?.message}
        hint={strengthHint}
      >
        <PasswordInput autoComplete="new-password" {...register('password')} />
      </Field>

      {formError && <PanelError>{formError}</PanelError>}

      <Button type="submit" full loading={isSubmitting}>
        {isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('auth.register.loginPrompt')}{' '}
        <button
          type="button"
          onClick={onLogin}
          className="rounded font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {t('auth.register.login')}
        </button>
      </p>
    </form>
  );
}
