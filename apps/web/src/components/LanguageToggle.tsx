import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS } from '../i18n';
import { cn } from '../ui';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      {SUPPORTED_LANGS.map((l) => {
        const active = i18n.resolvedLanguage === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => void i18n.changeLanguage(l.code)}
            aria-pressed={active}
            className={cn(
              'min-h-9 rounded px-2 text-xs font-semibold transition',
              active ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:bg-slate-100',
            )}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
