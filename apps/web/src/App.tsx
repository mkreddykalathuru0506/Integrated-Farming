import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Leaf } from 'lucide-react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { myFarmsRequest, type MyFarm } from './auth/api';
import { LoginForm } from './components/LoginForm';
import { LanguageToggle } from './components/LanguageToggle';
import { AppLayout } from './components/AppLayout';
import { CreateFarm } from './farm/CreateFarm';
import { Card } from './ui';

function BrandHeader() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Leaf className="h-5 w-5" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="font-display text-lg font-extrabold text-foreground">{t('nav.brand')}</p>
        <p className="text-xs text-muted-foreground">{t('app.tagline')}</p>
      </div>
    </div>
  );
}

/** Centered, branded shell for unauthenticated / pre-farm states (login, create-farm, loading). */
function CenterShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-secondary to-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between gap-2">
          <BrandHeader />
          <LanguageToggle />
        </div>
        <Card className="shadow-elevated">{children}</Card>
      </div>
    </div>
  );
}

function Authed() {
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
        setSelectedId((prev) => (r.farms.some((f) => f.farmId === prev) ? prev : (r.farms[0]?.farmId ?? '')));
      })
      .catch(() => setError(true));
  }, [accessToken]);

  useEffect(loadFarms, [loadFarms]);

  if (error && !farms) {
    return (
      <CenterShell>
        <p role="alert" className="text-sm text-destructive">
          {t('farms.error')}
        </p>
      </CenterShell>
    );
  }
  if (farms === null) {
    return (
      <CenterShell>
        <p className="text-sm text-muted-foreground">{t('farms.loading')}</p>
      </CenterShell>
    );
  }
  if (farms.length === 0) {
    return (
      <CenterShell>
        <CreateFarm onCreated={loadFarms} />
      </CenterShell>
    );
  }

  return (
    <AppLayout
      farms={farms}
      selectedId={selectedId}
      onSelectFarm={setSelectedId}
      userName={user?.name ?? ''}
      userEmail={user?.email ?? ''}
      onLogout={() => void logout()}
    />
  );
}

function Root() {
  const { user } = useAuth();
  return user ? (
    <Authed />
  ) : (
    <CenterShell>
      <LoginForm />
    </CenterShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
