import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { cn } from '../ui';
import { visibleSections, type Role } from './nav';
import { pathForSection } from './router';

/** Primary destinations per role (first 4 that survive the visibility filter). */
const PRIMARY: Record<Role, string[]> = {
  OWNER: ['overview', 'livestock', 'daily', 'finance'],
  MANAGER: ['overview', 'livestock', 'daily', 'finance'],
  ACCOUNTANT: ['overview', 'finance', 'sales', 'reports'],
  VETERINARIAN: ['overview', 'livestock', 'health', 'daily'],
  LABOUR: ['overview', 'daily', 'livestock', 'sales'],
  BUYER: ['overview'],
};

// Tailwind needs static class names — lookup by cell count (tabs + More).
const COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

type Props = {
  role: Role | undefined;
  activeKey: string;
  navigate: (key: string) => void;
  /** Opens the existing mobile drawer (Sheet). */
  onMore: () => void;
};

/** Fixed bottom tab bar (<lg): role-aware primary sections + More → drawer. */
export function MobileTabBar({ role, activeKey, navigate, onMore }: Props) {
  const { t } = useTranslation();
  const sections = visibleSections(role);
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const keys = (role ? PRIMARY[role] : PRIMARY.OWNER).filter((k) => byKey.has(k)).slice(0, 4);

  const cellClass =
    'flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium';

  return (
    <nav
      aria-label={t('nav.sections')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-card/95 backdrop-blur lg:hidden',
        'pb-[env(safe-area-inset-bottom)]',
        COLS[keys.length + 1] ?? 'grid-cols-5',
      )}
    >
      {keys.map((key) => {
        const section = byKey.get(key)!;
        const Icon = section.icon;
        const active = key === activeKey;
        const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          navigate(key);
        };
        return (
          <a
            key={key}
            href={pathForSection(key)}
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className={cn(cellClass, 'no-underline', active ? 'text-primary' : 'text-muted-foreground')}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.9} aria-hidden />
            <span className="max-w-full truncate px-1">{t(`nav.${key}`)}</span>
          </a>
        );
      })}
      <button type="button" onClick={onMore} className={cn(cellClass, 'text-muted-foreground')}>
        <Menu className="h-5 w-5" strokeWidth={1.9} aria-hidden />
        <span className="max-w-full truncate px-1">{t('nav.more')}</span>
      </button>
    </nav>
  );
}
