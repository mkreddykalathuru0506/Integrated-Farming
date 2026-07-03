import { useTranslation } from 'react-i18next';
import { PanelLeftClose, PanelLeftOpen, Leaf } from 'lucide-react';
import { cn } from '../ui';
import { SECTIONS } from './nav';
import { pathForSection } from './router';

type Props = {
  activeKey: string;
  onSelect: (key: string) => void;
  collapsed: boolean;
  onToggleCollapse?: () => void;
};

/**
 * Sidebar contents (brand + grouped section nav). Rendered twice: as the fixed desktop rail
 * and inside the mobile drawer (Sheet). Deep-green gradient surface with a gold active accent.
 */
export function SidebarContent({ activeKey, onSelect, collapsed, onToggleCollapse }: Props) {
  const { t } = useTranslation();
  return (
    <div
      className="relative flex h-full flex-col text-sidebar-foreground"
      style={{
        backgroundImage:
          'radial-gradient(420px 220px at 120% 0%, hsl(var(--success) / 0.18), transparent 60%), linear-gradient(180deg, hsl(var(--sidebar)), hsl(var(--sidebar-2)))',
      }}
    >
      {/* Brand */}
      <div className={cn('flex h-[68px] items-center gap-3 px-5', collapsed && 'justify-center px-0')}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-success to-primary text-white shadow-[0_6px_16px_-4px_hsl(var(--primary)/0.6),inset_0_1px_0_rgb(255_255_255/0.25)]">
          <Leaf className="h-5 w-5" aria-hidden />
        </span>
        {!collapsed && (
          <span className="leading-none">
            <span className="block font-display text-[17px] font-semibold tracking-tight text-white">
              {t('nav.brand')}
            </span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-muted">
              {t('nav.os')}
            </span>
          </span>
        )}
      </div>

      {/* Section nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label={t('nav.sections')}>
        {!collapsed && (
          <p className="px-3 pb-1.5 pt-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-sidebar-muted">
            {t('nav.sections')}
          </p>
        )}
        <ul className="space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = s.key === activeKey;
            const label = t(`nav.${s.key}`);
            return (
              <li key={s.key} className="relative">
                {active && (
                  <span
                    aria-hidden
                    className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.7)]"
                  />
                )}
                <a
                  href={pathForSection(s.key)}
                  onClick={(e) => {
                    // Let modified / non-primary clicks fall through to the browser
                    // (open-in-new-tab, etc.); handle plain clicks as in-app navigation.
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    onSelect(s.key);
                  }}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium no-underline transition-colors',
                    collapsed && 'justify-center px-0',
                    active
                      ? 'bg-gradient-to-r from-success/20 to-success/[0.04] text-white'
                      : 'text-sidebar-muted hover:bg-white/[0.06] hover:text-sidebar-foreground',
                  )}
                >
                  <Icon
                    className={cn('h-[19px] w-[19px] shrink-0', active ? 'text-success' : '')}
                    strokeWidth={1.9}
                    aria-hidden
                  />
                  {!collapsed && <span className="truncate">{label}</span>}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle (desktop only) */}
      {onToggleCollapse && (
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            className={cn(
              'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-muted transition-colors hover:bg-white/[0.06] hover:text-sidebar-foreground',
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
