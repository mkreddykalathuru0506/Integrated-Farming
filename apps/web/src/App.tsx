import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { myFarmsRequest, type MyFarm } from './auth/api';
import { LoginForm } from './components/LoginForm';
import { FarmsPanel } from './components/FarmsPanel';
import { CreateFarm } from './farm/CreateFarm';
import { UnitsPanel } from './farm/UnitsPanel';
import { SettingsPanel } from './farm/SettingsPanel';

function Dashboard() {
  const { t } = useTranslation();
  const { user, accessToken, logout } = useAuth();
  const [farms, setFarms] = useState<MyFarm[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState(false);

  const loadFarms = useCallback(() => {
    if (!accessToken) return;
    setError(false);
    myFarmsRequest(accessToken)
      .then((r) => {
        setFarms(r.farms);
        setSelectedId((prev) =>
          r.farms.some((f) => f.farmId === prev) ? prev : (r.farms[0]?.farmId ?? ''),
        );
      })
      .catch(() => setError(true));
  }, [accessToken]);

  useEffect(loadFarms, [loadFarms]);

  const selected = farms?.find((f) => f.farmId === selectedId);
  const canWriteUnits = selected?.role === 'OWNER' || selected?.role === 'MANAGER';
  const canWriteSettings = selected?.role === 'OWNER';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-slate-700">{t('auth.welcome', { name: user?.name })}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t('auth.logout')}
        </button>
      </div>

      {error && !farms && (
        <p role="alert" className="text-sm text-red-600">
          {t('farms.error')}
        </p>
      )}
      {!error && farms === null && <p className="text-sm text-slate-500">{t('farms.loading')}</p>}

      {farms && farms.length === 0 && <CreateFarm onCreated={loadFarms} />}

      {farms && farms.length > 0 && selectedId && (
        <>
          <FarmsPanel farms={farms} selectedId={selectedId} onSelect={setSelectedId} />
          <UnitsPanel key={`u-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          <SettingsPanel key={`s-${selectedId}`} farmId={selectedId} canWrite={canWriteSettings} />
        </>
      )}
    </div>
  );
}

function Shell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-50 p-4">
      <div className="mt-6 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{t('app.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('app.tagline')}</p>
        {user ? <div className="mt-6">{<Dashboard />}</div> : <LoginForm />}
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
