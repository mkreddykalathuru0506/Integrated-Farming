import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGS, changeLanguage } from '../i18n';
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
            onClick={() => void changeLanguage(l.code)}
            aria-pressed={active}
            className={cn(
              'min-h-9 rounded px-2 text-xs font-semibold transition',
              active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
