import { Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MyFarm } from '../auth/api';
import { Card, CardSkeleton, cn, Sheet, SheetContent, SheetTitle, StatSkeleton, TableSkeleton } from '../ui';
import { ErrorBoundary } from './ErrorBoundary';
import { SidebarContent } from './Sidebar';
import { Topbar } from './Topbar';
import { SECTIONS, permsFor } from './nav';
import { useRoute } from './router';

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
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <Card>
        <TableSkeleton rows={4} cols={3} />
      </Card>
      <CardSkeleton />
    </div>
  );
}

export function AppLayout({ farms, selectedId, onSelectFarm, userName, userEmail, onLogout }: Props) {
  const { t, i18n } = useTranslation();
  const { key: routeKey, navigate } = useRoute();
  const [mobileOpen, setMobileOpen] = useState(false);
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

  const section = SECTIONS.find((s) => s.key === routeKey) ?? SECTIONS[0]!;
  const activeKey = section.key;
  const selected = farms.find((f) => f.farmId === selectedId);
  const perms = permsFor(selected);
  const isOverview = section.key === 'overview';

  // Canonicalise an unknown/typo'd URL (e.g. /nope) to the section it fell back to.
  useEffect(() => {
    if (routeKey !== section.key) navigate(section.key, { replace: true });
  }, [routeKey, section.key, navigate]);

  // Per-section document title, re-derived on language switch.
  useEffect(() => {
    document.title = `${t(`nav.${section.key}`)} · ${t('app.title')}`;
  }, [section.key, t, i18n.resolvedLanguage]);

  // A11y: on section change, scroll to top and move focus to the main heading
  // so keyboard/screen-reader users land on the new content (not on first mount).
  const mainHeadingRef = useRef<HTMLHeadingElement>(null);
  const prevSectionKey = useRef(section.key);
  useEffect(() => {
    if (prevSectionKey.current === section.key) return;
    prevSectionKey.current = section.key;
    window.scrollTo({ top: 0 });
    mainHeadingRef.current?.focus();
  }, [section.key]);

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
          activeKey={activeKey}
          onSelect={navigate}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="border-r border-sidebar-border">
          <SheetTitle className="sr-only">{t('nav.sections')}</SheetTitle>
          <SidebarContent activeKey={activeKey} onSelect={selectFromDrawer} collapsed={false} />
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
        />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Focus target on section change; the visible title lives in the Topbar. */}
          <h1 ref={mainHeadingRef} tabIndex={-1} className="sr-only">
            {t(`nav.${section.key}`)}
          </h1>
          <ErrorBoundary resetKey={section.key + selectedId}>
            <Suspense fallback={<SectionFallback full={isOverview} />}>
              {isOverview ? (
                <div className="mx-auto w-full max-w-7xl">
                  {section.panels.map((p) => (
                    <div key={p.key + selectedId}>{p.render(selectedId, perms)}</div>
                  ))}
                </div>
              ) : (
                <div className="mx-auto w-full max-w-5xl space-y-5">
                  {section.panels.map((p) => (
                    <Card key={p.key + selectedId}>{p.render(selectedId, perms)}</Card>
                  ))}
                </div>
              )}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
