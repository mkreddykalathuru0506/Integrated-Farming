import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MyFarm } from '../auth/api';
import { Card, CardSkeleton, cn, Sheet, SheetContent, SheetTitle, StatSkeleton, TableSkeleton } from '../ui';
import { CommandPalette } from './CommandPalette';
import { ErrorBoundary } from './ErrorBoundary';
import { MobileTabBar } from './MobileTabBar';
import { SectionTabs } from './SectionTabs';
import { ShortcutHelp } from './ShortcutHelp';
import { SidebarContent } from './Sidebar';
import { Topbar } from './Topbar';
import { useOpenRisks } from './bellData';
import type { NavTarget } from './commands';
import { permsFor, visibleSections, type Role } from './nav';
import { panelFromPath, resolveRoute, useRoute } from './router';
import { useHotkeys } from './useHotkeys';

type Props = {
  farms: MyFarm[];
  selectedId: string;
  onSelectFarm: (id: string) => void;
  userName: string;
  userEmail: string;
  onLogout: () => void;
};

const COLLAPSE_KEY = 'ifm.sidebar.collapsed';

/** Skeleton composition shown while a lazy section chunk loads. */
function SectionFallback({ full }: { full: boolean }) {
  return full ? (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
        <StatSkeleton />
      </div>
      <CardSkeleton />
    </div>
  ) : (
    <div className="space-y-5">
      <Card>
        <TableSkeleton rows={4} cols={3} />
      </Card>
      <CardSkeleton />
    </div>
  );
}

export function AppLayout({ farms, selectedId, onSelectFarm, userName, userEmail, onLogout }: Props) {
  const { t, i18n } = useTranslation();
  const { pathname, navigate } = useRoute();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore storage failures (private mode) */
    }
  }, [collapsed]);

  const selected = farms.find((f) => f.farmId === selectedId);
  const role = selected?.role as Role | undefined;
  const perms = permsFor(selected);
  const sections = useMemo(() => visibleSections(role), [role]);

  const { sectionKey, panelKey, canonicalPath } = resolveRoute(pathname, sections);
  const section = sections.find((s) => s.key === sectionKey) ?? sections[0]!;
  const activePanel = section.panels.find((p) => p.key === panelKey) ?? section.panels[0]!;
  const multiPanel = section.panels.length > 1;

  // Canonicalise unknown/hidden/first-panel-spelled-out URLs (replace, no history spam).
  useEffect(() => {
    if (canonicalPath !== window.location.pathname) {
      navigate(sectionKey, { panel: panelFromPath(canonicalPath), replace: true });
    }
  }, [canonicalPath, sectionKey, navigate]);

  // Per-route document title, re-derived on language switch.
  useEffect(() => {
    document.title = multiPanel
      ? `${t(`nav.panels.${panelKey}`)} · ${t(`nav.${sectionKey}`)} · ${t('nav.brand')}`
      : `${t(`nav.${sectionKey}`)} · ${t('nav.brand')}`;
  }, [sectionKey, panelKey, multiPanel, t, i18n.resolvedLanguage]);

  // A11y: on route change (section OR panel), scroll to top and move focus to the
  // main heading so keyboard/screen-reader users land on the new content.
  const mainHeadingRef = useRef<HTMLHeadingElement>(null);
  const prevPath = useRef(canonicalPath);
  useEffect(() => {
    if (prevPath.current === canonicalPath) return;
    prevPath.current = canonicalPath;
    window.scrollTo({ top: 0 });
    mainHeadingRef.current?.focus();
  }, [canonicalPath]);

  // Global shortcuts: Ctrl/Cmd+K toggle, `/` open, `?` help, g+letter section jumps.
  useHotkeys({
    onTogglePalette: () => setPaletteOpen((o) => !o),
    onOpenPalette: () => setPaletteOpen(true),
    onOpenHelp: () => setHelpOpen(true),
    onGoto: (key) => {
      if (sections.some((s) => s.key === key)) navigate(key); // hidden section = no-op
    },
  });

  const navigateTarget = useCallback(
    (target: NavTarget) =>
      navigate(target.key, target.panel === undefined ? undefined : { panel: target.panel }),
    [navigate],
  );

  // Sidebar attention dot: reuses the bell's risk query (deduped by key).
  const risksQ = useOpenRisks();
  const dotKeys = useMemo(
    () => ((risksQ.data?.length ?? 0) > 0 ? (['intelligence'] as const) : []),
    [risksQ.data],
  );

  function selectFromDrawer(key: string) {
    navigate(key);
    setMobileOpen(false);
  }

  return (
    <div className="flex min-h-dvh">
      {/* Desktop rail */}
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 border-r border-sidebar-border transition-[width] duration-200 lg:block',
          collapsed ? 'w-[4.75rem]' : 'w-64',
        )}
      >
        <SidebarContent
          sections={sections}
          activeKey={sectionKey}
          onSelect={navigate}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          dotKeys={dotKeys}
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="border-r border-sidebar-border">
          <SheetTitle className="sr-only">{t('nav.sections')}</SheetTitle>
          <SidebarContent
            sections={sections}
            activeKey={sectionKey}
            onSelect={selectFromDrawer}
            collapsed={false}
            dotKeys={dotKeys}
          />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={t(`nav.${section.key}`)}
          farms={farms}
          selectedId={selectedId}
          onSelectFarm={onSelectFarm}
          userName={userName}
          userEmail={userEmail}
          onLogout={onLogout}
          onOpenNav={() => setMobileOpen(true)}
          role={role}
          onNavigate={navigateTarget}
        />

        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-6">
          {/* Focus target on route change; the visible title lives in the Topbar. */}
          <h1 ref={mainHeadingRef} tabIndex={-1} className="sr-only">
            {multiPanel
              ? `${t(`nav.panels.${panelKey}`)} · ${t(`nav.${section.key}`)}`
              : t(`nav.${section.key}`)}
          </h1>
          <div className={cn('mx-auto w-full', activePanel.full ? 'max-w-7xl' : 'max-w-5xl')}>
            <SectionTabs section={section} activePanelKey={panelKey} navigate={navigate} />
            <ErrorBoundary resetKey={canonicalPath + selectedId}>
              <Suspense fallback={<SectionFallback full={activePanel.full ?? false} />}>
                {activePanel.full ? (
                  <div key={activePanel.key + selectedId}>{activePanel.render(selectedId, perms)}</div>
                ) : (
                  <Card key={activePanel.key + selectedId}>{activePanel.render(selectedId, perms)}</Card>
                )}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar role={role} activeKey={sectionKey} navigate={navigate} onMore={() => setMobileOpen(true)} />

      {/* Command palette + shortcut cheat-sheet */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        role={role}
        onNavigate={navigateTarget}
      />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
