import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';

/** Responsive app shell: sticky header (brand + language) + centered content. Works at 360px. */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2 truncate">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-green-600 text-sm font-bold text-white">
              SK
            </span>
            <span className="truncate text-base font-semibold text-slate-900">
              {t('app.title')}
            </span>
          </div>
          <LanguageToggle />
        </div>
      </header>
      <main className="mx-auto max-w-screen-sm px-4 py-6">{children}</main>
    </div>
  );
}
