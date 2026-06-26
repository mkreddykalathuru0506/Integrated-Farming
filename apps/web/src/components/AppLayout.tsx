import { Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MyFarm } from '../auth/api';
import { Card, cn, Sheet, SheetContent, SheetTitle } from '../ui';
import { SidebarContent } from './Sidebar';
import { Topbar } from './Topbar';
import { SECTIONS, permsFor } from './nav';

type Props = {
  farms: MyFarm[];
  selectedId: string;
  onSelectFarm: (id: string) => void;
  userName: string;
  userEmail: string;
  onLogout: () => void;
};

const COLLAPSE_KEY = 'ifm.sidebar.collapsed';

export function AppLayout({ farms, selectedId, onSelectFarm, userName, userEmail, onLogout }: Props) {
  const { t } = useTranslation();
  const [activeKey, setActiveKey] = useState('overview');
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

  const section = SECTIONS.find((s) => s.key === activeKey) ?? SECTIONS[0]!;
  const selected = farms.find((f) => f.farmId === selectedId);
  const perms = permsFor(selected);
  const isOverview = section.key === 'overview';

  function selectFromDrawer(key: string) {
    setActiveKey(key);
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
          onSelect={setActiveKey}
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
          <Suspense fallback={<p className="text-sm text-muted-foreground">{t('farms.loading')}</p>}>
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
        </main>
      </div>
    </div>
  );
}
