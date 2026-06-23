import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../ui';
import { getSpecies, listSpecies, type SpeciesDetail, type SpeciesSummary } from './api';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; species: SpeciesSummary[] };

export function SpeciesPanel({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const { accessToken } = useAuth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SpeciesDetail | null>(null);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoad({ status: 'loading' });
    listSpecies(accessToken, farmId)
      .then((r) => setLoad({ status: 'ready', species: r.species }))
      .catch(() => setLoad({ status: 'error' }));
  }, [accessToken, farmId]);

  useEffect(refresh, [refresh]);

  function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    if (accessToken) getSpecies(accessToken, farmId, id).then((r) => setDetail(r.species)).catch(() => undefined);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('species.title')}</h2>

      {load.status === 'loading' && <p className="text-sm text-slate-500">{t('species.loading')}</p>}
      {load.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {t('species.error')}
        </p>
      )}
      {load.status === 'ready' && load.species.length === 0 && (
        <p className="text-sm text-slate-500">{t('species.empty')}</p>
      )}
      {load.status === 'ready' && load.species.length > 0 && (
        <ul className="space-y-2">
          {load.species.map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => toggle(s.id)}
                aria-expanded={openId === s.id}
                className="flex min-h-11 w-full items-center justify-between px-3 text-left"
              >
                <span className="font-medium text-slate-800">{s.name}</span>
                <Badge className={s.trackingMode === 'INDIVIDUAL' ? 'bg-sky-100 text-sky-800' : ''}>
                  {t(`species.tracking.${s.trackingMode}`)}
                </Badge>
              </button>
              {openId === s.id && (
                <div className="border-t border-slate-100 px-3 py-2 text-sm">
                  {!detail ? (
                    <span className="text-slate-400">{t('species.loading')}</span>
                  ) : (
                    <>
                      <p className="text-slate-500">{t('species.stages')}</p>
                      <ol className="mb-2 ml-4 list-decimal text-slate-700">
                        {detail.stages.map((st) => (
                          <li key={st.id}>
                            {st.name}
                            {st.isTerminal ? ` · ${t('species.terminal')}` : ''}
                          </li>
                        ))}
                      </ol>
                      <p className="text-slate-500">{t('species.breeds')}</p>
                      <p className="text-slate-700">{detail.breeds.map((b) => b.name).join(', ') || '—'}</p>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
