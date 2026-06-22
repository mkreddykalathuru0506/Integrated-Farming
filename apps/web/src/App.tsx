import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

type HealthState = 'checking' | 'ok' | 'down';

export default function App() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<HealthState>('checking');

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/health`)
      .then((r) => active && setHealth(r.ok ? 'ok' : 'down'))
      .catch(() => active && setHealth('down'));
    return () => {
      active = false;
    };
  }, []);

  const dot =
    health === 'ok' ? 'bg-green-500' : health === 'down' ? 'bg-red-500' : 'bg-amber-400';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{t('app.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('app.tagline')}</p>
        <div className="mt-6 flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
          <span className="text-sm text-slate-700">{t(`app.health.${health}`)}</span>
        </div>
      </div>
    </main>
  );
}
