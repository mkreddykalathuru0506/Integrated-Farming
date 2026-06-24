import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen, Leaf } from 'lucide-react';
import { cn } from '../ui';
import { SECTIONS } from './nav';

type Props = {
  activeKey: string;
  onSelect: (key: string) => void;
  collapsed: boolean;
  onToggleCollapse?: () => void;
};

/**
 * Sidebar contents (brand + grouped section nav). Rendered twice: as the fixed desktop rail
 * and inside the mobile drawer (Sheet). Deep-green surface for a distinctive admin frame.
 */
export function SidebarContent({ activeKey, onSelect, collapsed, onToggleCollapse }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className={cn('flex h-16 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Leaf className="h-5 w-5" aria-hidden />
        </span>
        {!collapsed && (
          <span className="font-display text-base font-extrabold tracking-tight">{t('nav.brand')}</span>
        )}
      </div>

      {/* Section nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label={t('nav.sections')}>
        {!collapsed && (
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
            {t('nav.sections')}
          </p>
        )}
        <ul className="space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.key === activeKey;
            const label = t(`nav.${s.key}`);
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => onSelect(s.key)}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
                      : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground',
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary-foreground' : '')} aria-hidden />
                  {!collapsed && <span className="truncate">{label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle (desktop only — passed in) */}
      {onToggleCollapse && (
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            className={cn(
              'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/5 hover:text-sidebar-foreground',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5 shrink-0" aria-hidden />
                <span>{t('nav.collapse')}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
