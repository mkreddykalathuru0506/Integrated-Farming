import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { Badge, PanelError, PanelHeading, PanelNote } from '../ui';
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
      <PanelHeading>{t('species.title')}</PanelHeading>

      {load.status === 'loading' && <PanelNote>{t('species.loading')}</PanelNote>}
      {load.status === 'error' && <PanelError>{t('species.error')}</PanelError>}
      {load.status === 'ready' && load.species.length === 0 && <PanelNote>{t('species.empty')}</PanelNote>}
      {load.status === 'ready' && load.species.length > 0 && (
        <ul className="space-y-2">
          {load.species.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-card">
              <button
                type="button"
                onClick={() => toggle(s.id)}
                aria-expanded={openId === s.id}
                className="flex min-h-11 w-full items-center justify-between px-3 text-left"
              >
                <span className="font-medium text-foreground">{s.name}</span>
                <Badge variant={s.trackingMode === 'INDIVIDUAL' ? 'accent' : 'default'}>
                  {t(`species.tracking.${s.trackingMode}`)}
                </Badge>
              </button>
              {openId === s.id && (
                <div className="border-t border-border px-3 py-2 text-sm">
                  {!detail ? (
                    <span className="text-muted-foreground">{t('species.loading')}</span>
                  ) : (
                    <>
                      <p className="text-muted-foreground">{t('species.stages')}</p>
                      <ol className="mb-2 ml-4 list-decimal text-foreground">
                        {detail.stages.map((st) => (
                          <li key={st.id}>
                            {st.name}
                            {st.isTerminal ? ` · ${t('species.terminal')}` : ''}
                          </li>
                        ))}
                      </ol>
                      <p className="text-muted-foreground">{t('species.breeds')}</p>
                      <p className="text-foreground">{detail.breeds.map((b) => b.name).join(', ') || '—'}</p>
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
