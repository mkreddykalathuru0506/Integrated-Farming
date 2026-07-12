import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, ChevronDown, Building2, LogOut, Check, UserRound } from 'lucide-react';
import type { MyFarm } from '../auth/api';
import { AccountDialog } from '../account/AccountDialog';
import {
  cn,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui';
import { LanguageToggle } from './LanguageToggle';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import type { NavTarget } from './commands';
import type { Role } from './nav';

type Props = {
  title: string;
  farms: MyFarm[];
  selectedId: string;
  onSelectFarm: (id: string) => void;
  userName: string;
  userEmail: string;
  onLogout: () => void;
  onOpenNav: () => void;
  role: Role | undefined;
  onNavigate: (target: NavTarget) => void;
};

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Topbar({
  title,
  farms,
  selectedId,
  onSelectFarm,
  userName,
  userEmail,
  onLogout,
  onOpenNav,
  role,
  onNavigate,
}: Props) {
  const { t } = useTranslation();
  const selected = farms.find((f) => f.farmId === selectedId);
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur sm:px-5">
      {/* Mobile: open nav drawer */}
      <button
        type="button"
        onClick={onOpenNav}
        aria-label={t('nav.openMenu')}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-foreground hover:bg-muted lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="hidden shrink-0 text-sm font-semibold text-muted-foreground sm:inline">
          {t('nav.workspace')}
        </span>
        <span className="hidden shrink-0 text-muted-foreground/60 sm:inline">/</span>
        {/* Visual title only — the page's <h1> is the focus target inside <main> (AppLayout). */}
        <p className="truncate font-display text-xl font-semibold text-foreground">{title}</p>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* Farm switcher */}
        {farms.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex min-h-11 max-w-[9rem] items-center gap-2 rounded-lg border border-input bg-card px-2.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:max-w-[14rem]"
              aria-label={t('nav.selectFarm')}
            >
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{selected?.farmName ?? t('nav.selectFarm')}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>{t('nav.selectFarm')}</DropdownMenuLabel>
              {farms.map((f) => (
                <DropdownMenuItem key={f.farmId} onSelect={() => onSelectFarm(f.farmId)}>
                  <span className="flex-1 truncate">{f.farmName}</span>
                  {f.farmId === selectedId && <Check className="h-4 w-4 text-primary" aria-hidden />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <NotificationBell role={role} onNavigate={onNavigate} />

        <ThemeToggle />

        <div className="hidden sm:block">
          <LanguageToggle />
        </div>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex min-h-11 items-center gap-2 rounded-lg px-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            aria-label={t('nav.account')}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials(userName)}
            </span>
            <span className="hidden max-w-[8rem] truncate text-sm font-medium text-foreground md:block">
              {userName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <div className="px-2.5 py-1.5">
              <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <div className="px-1 py-1 sm:hidden">
              <LanguageToggle />
            </div>
            <DropdownMenuSeparator className="sm:hidden" />
            <DropdownMenuItem onSelect={() => setAccountOpen(true)}>
              <UserRound className="h-4 w-4" aria-hidden />
              {t('account.menu')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onLogout}
              className={cn('text-destructive focus:bg-destructive/10 focus:text-destructive', '[&_svg]:text-destructive')}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t('auth.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />
      </div>
    </header>
  );
}
