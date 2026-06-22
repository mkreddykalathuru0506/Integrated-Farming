import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

export function LoginForm() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('owner@demo.farm');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError(t('auth.errors.invalid'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <h2 className="text-lg font-semibold text-slate-900">{t('auth.login.title')}</h2>

      <label className="block text-sm font-medium text-slate-700">
        {t('auth.login.email')}
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        {t('auth.login.password')}
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3 text-slate-900 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="min-h-11 w-full rounded-lg bg-green-600 font-semibold text-white hover:bg-green-700 disabled:opacity-60"
      >
        {loading ? t('auth.login.submitting') : t('auth.login.submit')}
      </button>
    </form>
  );
}
