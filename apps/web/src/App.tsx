import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { myFarmsRequest, type MyFarm } from './auth/api';
import { AppShell } from './components/AppShell';
import { LoginForm } from './components/LoginForm';
import { FarmsPanel } from './components/FarmsPanel';
import { CreateFarm } from './farm/CreateFarm';
import { UnitsPanel } from './farm/UnitsPanel';
import { SettingsPanel } from './farm/SettingsPanel';
import { Button, Card } from './ui';

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
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="truncate">
            <p className="font-medium text-slate-800">{t('auth.welcome', { name: user?.name })}</p>
            <p className="truncate text-sm text-slate-500">{user?.email}</p>
          </div>
          <Button variant="secondary" onClick={() => void logout()}>
            {t('auth.logout')}
          </Button>
        </div>
        {farms && farms.length > 0 && selectedId && (
          <div className="mt-4">
            <FarmsPanel farms={farms} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        )}
      </Card>

      {error && !farms && (
        <p role="alert" className="text-sm text-red-600">
          {t('farms.error')}
        </p>
      )}
      {!error && farms === null && <p className="text-sm text-slate-500">{t('farms.loading')}</p>}

      {farms && farms.length === 0 && (
        <Card>
          <CreateFarm onCreated={loadFarms} />
        </Card>
      )}

      {farms && farms.length > 0 && selectedId && (
        <>
          <Card>
            <UnitsPanel key={`u-${selectedId}`} farmId={selectedId} canWrite={canWriteUnits} />
          </Card>
          <Card>
            <SettingsPanel key={`s-${selectedId}`} farmId={selectedId} canWrite={canWriteSettings} />
          </Card>
        </>
      )}
    </div>
  );
}

function Root() {
  const { user } = useAuth();
  return (
    <AppShell>
      {user ? (
        <Dashboard />
      ) : (
        <Card className="mx-auto max-w-sm">
          <LoginForm />
        </Card>
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
