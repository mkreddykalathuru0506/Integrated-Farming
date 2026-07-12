import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { authErrorKey } from '../auth/errors';
import { OtpLogin } from '../auth/OtpLogin';
import { PasswordInput } from '../auth/PasswordInput';
import { Button, Field, Input, PanelError } from '../ui';

// Dev-seed credentials (ADR-0002) — the quick-login button below is compiled
// out of production builds (import.meta.env.DEV branch is dead-code-eliminated).
const DEMO_EMAIL = 'owner@demo.farm';
const DEMO_PASSWORD = 'Passw0rd!';

type Props = {
  /** Open the create-account view. */
  onRegister: () => void;
  /** Open the forgot-password view. */
  onForgot: () => void;
};

export function LoginForm({ onRegister, onForgot }: Props) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function doLogin(emailValue: string, passwordValue: string) {
    setError(null);
    setLoading(true);
    try {
      await login(emailValue, passwordValue);
    } catch (err) {
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void doLogin(email, password);
  }

  function onDemoLogin() {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    void doLogin(DEMO_EMAIL, DEMO_PASSWORD);
  }

  if (mode === 'otp') {
    return <OtpLogin onUsePassword={() => setMode('password')} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h2 className="font-display text-lg font-bold text-foreground">{t('auth.login.title')}</h2>

      <Field label={t('auth.login.email')} required>
        <Input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </Field>

      <Field label={t('auth.login.password')} required>
        <PasswordInput
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>

      <div className="text-right">
        <button
          type="button"
          onClick={onForgot}
          className="rounded text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {t('auth.login.forgot')}
        </button>
      </div>

      {error && <PanelError>{error}</PanelError>}

      <Button type="submit" full loading={loading}>
        {loading ? t('auth.login.submitting') : t('auth.login.submit')}
      </Button>

      <Button type="button" variant="ghost" size="sm" full disabled={loading} onClick={() => setMode('otp')}>
        {t('auth.login.otpToggle')}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t('auth.login.registerPrompt')}{' '}
        <button
          type="button"
          onClick={onRegister}
          className="rounded font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {t('auth.login.register')}
        </button>
      </p>

      {import.meta.env.DEV && (
        <Button type="button" variant="ghost" size="sm" full disabled={loading} onClick={onDemoLogin}>
          {t('auth.login.demo')}
        </Button>
      )}
    </form>
  );
}
