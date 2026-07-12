import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Kbd } from '../ui';
import { SHORTCUTS, type Shortcut } from './commands';

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

function ShortcutList({ items }: { items: Shortcut[] }) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-1.5">
      {items.map((s) => (
        <li key={s.keys.join('+') + s.labelKey} className="flex items-center justify-between gap-3 text-sm text-foreground">
          <span className="truncate">{t(s.labelKey)}</span>
          <span className="flex shrink-0 gap-1">
            {s.keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** `?` cheat-sheet — renders the same SHORTCUTS registry the hotkeys run on. */
export function ShortcutHelp({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('shortcuts.title')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {(['general', 'goto'] as const).map((group) => (
            <section key={group}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t(`shortcuts.groups.${group}`)}
              </h3>
              <ShortcutList items={SHORTCUTS.filter((s) => s.group === group)} />
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
