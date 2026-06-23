import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginForm } from './components/LoginForm';
import { FarmsPanel } from './components/FarmsPanel';

function Dashboard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  return (
    <div className="mt-6 space-y-4">
      <p className="text-slate-700">{t('auth.welcome', { name: user?.name })}</p>
      <p className="text-sm text-slate-500">{user?.email}</p>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          {t('farms.title')}
        </h2>
        <FarmsPanel />
      </div>

      <button
        type="button"
        onClick={() => void logout()}
        className="min-h-11 w-full rounded-lg border border-slate-300 font-medium text-slate-700 hover:bg-slate-50"
      >
        {t('auth.logout')}
      </button>
    </div>
  );
}

function Shell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{t('app.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('app.tagline')}</p>
        {user ? <Dashboard /> : <LoginForm />}
      </div>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
