import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { myFarmsRequest, type MyFarm } from '../auth/api';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; farms: MyFarm[] };

export function FarmsPanel() {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    setState({ status: 'loading' });
    myFarmsRequest(accessToken)
      .then((r) => active && setState({ status: 'ready', farms: r.farms }))
      .catch(() => active && setState({ status: 'error' }));
    return () => {
      active = false;
    };
  }, [accessToken]);

  if (state.status === 'loading') {
    return <p className="text-sm text-slate-500">{t('farms.loading')}</p>;
  }
  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm text-red-600">
        {t('farms.error')}
      </p>
    );
  }
  if (state.farms.length === 0) {
    return <p className="text-sm text-slate-500">{t('farms.empty')}</p>;
  }

  return (
    <ul className="space-y-2">
      {state.farms.map((f) => (
        <li
          key={f.farmId}
          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
        >
          <span className="font-medium text-slate-800">{f.farmName}</span>
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
            {t(`roles.${f.role}`)}
          </span>
        </li>
      ))}
    </ul>
  );
}
