import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { isApiError } from '../lib/http';
import { Button, Input } from '../ui';

// Dev-seed credentials (ADR-0002) — the quick-login button below is compiled
// out of production builds (import.meta.env.DEV branch is dead-code-eliminated).
const DEMO_EMAIL = 'owner@demo.farm';
const DEMO_PASSWORD = 'Passw0rd!';

export function LoginForm() {
  const { t } = useTranslation();
  const { login } = useAuth();
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
      if (isApiError(err)) {
        if (err.code === 'NETWORK') setError(t('auth.errors.offline'));
        else if (err.status === 429) setError(t('auth.errors.rateLimited'));
        else if (err.status === 401) setError(t('auth.errors.invalid'));
        else setError(t('errors.generic'));
      } else {
        setError(t('errors.generic'));
      }
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

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <h2 className="font-display text-lg font-bold text-foreground">{t('auth.login.title')}</h2>

      <label className="block space-y-1 text-sm font-medium text-foreground">
        <span>{t('auth.login.email')}</span>
        <Input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label className="block space-y-1 text-sm font-medium text-foreground">
        <span>{t('auth.login.password')}</span>
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" full disabled={loading}>
        {loading ? t('auth.login.submitting') : t('auth.login.submit')}
      </Button>

      {import.meta.env.DEV && (
        <Button type="button" variant="ghost" size="sm" full disabled={loading} onClick={onDemoLogin}>
          {t('auth.login.demo')}
        </Button>
      )}
    </form>
  );
}
