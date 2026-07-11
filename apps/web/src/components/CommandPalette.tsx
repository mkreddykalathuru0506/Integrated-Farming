import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { useFarmApi } from '../api/FarmContext';
import { Dialog, DialogContent, DialogTitle, Kbd, Spinner, cn } from '../ui';
import { buildCommands, targetFor, type CommandItem, type NavTarget } from './commands';
import type { Role } from './nav';

/** GET /api/farm/search response (apps/api/src/search/service.ts). */
type SearchGroup = {
  type: string;
  route: { section: string; panel: string };
  items: Record<string, unknown>[];
};
type SearchResult = { q: string; total: number; groups: SearchGroup[] };

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_MIN_CHARS = 2;

/** Primary display line for a search hit, per entity type. */
function hitLabel(type: string, item: Record<string, unknown>): string {
  const s = (k: string) => (typeof item[k] === 'string' ? (item[k] as string) : undefined);
  switch (type) {
    case 'batch':
      return [s('code'), s('name')].filter(Boolean).join(' · ');
    case 'animal':
      return [s('tagNumber'), s('name')].filter(Boolean).join(' · ');
    case 'invoice':
      return s('invoiceNumber') ?? '';
    case 'lot':
      return [s('lotCode'), s('productName')].filter(Boolean).join(' · ');
    case 'order':
      return s('orderNumber') ?? '';
    default:
      // customer / vendor / worker
      return s('name') ?? '';
  }
}

/** Case-insensitive substring match on any of the given labels. */
function matches(query: string, labels: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return labels.some((l) => l?.toLowerCase().includes(q));
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | undefined;
  onNavigate: (target: NavTarget) => void;
};

/**
 * Ctrl/Cmd+K command palette (cmdk inside the app Dialog): role-filtered
 * navigation + quick actions, plus debounced global record search via
 * GET /api/farm/search rendered as a Results group.
 */
export function CommandPalette({ open, onOpenChange, role, onNavigate }: Props) {
  const { t, i18n } = useTranslation();
  const { farmId, fetchJson } = useFarmApi();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  // Reset the query whenever the palette closes so it reopens clean.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setDebounced('');
    }
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const q = debounced.trim();
  const searchEnabled = open && q.length >= SEARCH_MIN_CHARS;
  const search = useQuery({
    queryKey: ['farm', farmId, 'search', q] as const,
    queryFn: () => fetchJson<SearchResult>(`/api/farm/search?q=${encodeURIComponent(q)}`),
    enabled: searchEnabled,
    staleTime: 30_000,
  });

  const commands = useMemo(() => buildCommands(role), [role]);
  // Match on the active-language label AND the English label so Hindi users
  // can still type latin section names.
  const tEn = useMemo(() => i18n.getFixedT('en'), [i18n]);
  const filtered = commands.filter((c) => matches(query, [t(c.labelKey), tEn(c.labelKey)]));
  const navItems = filtered.filter((c) => c.group === 'navigate');
  const actionItems = filtered.filter((c) => c.group === 'actions');

  function run(target: NavTarget) {
    onNavigate(target);
    onOpenChange(false);
  }

  const hitCount = searchEnabled ? (search.data?.total ?? 0) : 0;
  const showEmpty =
    navItems.length + actionItems.length + hitCount === 0 &&
    !(searchEnabled && (search.isFetching || search.isError));

  const groupClass =
    '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground';
  const itemClass = cn(
    'flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-foreground outline-none',
    'data-[selected=true]:bg-muted',
  );

  function renderItem(c: CommandItem) {
    const Icon = c.icon;
    return (
      <Command.Item key={c.id} value={c.id} onSelect={() => run(c.target)} className={itemClass}>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="flex-1 truncate">{t(c.labelKey)}</span>
        {c.shortcut && (
          <span className="flex gap-1" aria-hidden>
            {c.shortcut.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        )}
      </Command.Item>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        aria-describedby={undefined}
        className="top-24 -translate-y-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">{t('palette.title')}</DialogTitle>
        <Command shouldFilter={false} label={t('palette.title')}>
          <div className="flex items-center gap-2.5 border-b border-border px-4 pr-12">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={t('palette.placeholder')}
              className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            {showEmpty && (
              <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                {t('palette.empty')}
              </p>
            )}
            {navItems.length > 0 && (
              <Command.Group heading={t('palette.groups.navigate')} className={groupClass}>
                {navItems.map(renderItem)}
              </Command.Group>
            )}
            {actionItems.length > 0 && (
              <Command.Group heading={t('palette.groups.actions')} className={groupClass}>
                {actionItems.map(renderItem)}
              </Command.Group>
            )}
            {searchEnabled && search.isFetching && (
              <p className="flex items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground">
                <Spinner /> {t('palette.searching')}
              </p>
            )}
            {searchEnabled && search.isError && (
              <p role="alert" className="px-2.5 py-2 text-sm text-destructive">
                {t('errors.generic')}
              </p>
            )}
            {searchEnabled && search.data && search.data.total > 0 && (
              <Command.Group heading={t('palette.groups.results')} className={groupClass}>
                {search.data.groups.flatMap((g) =>
                  g.items.map((item) => {
                    const id = String(item.id);
                    return (
                      <Command.Item
                        key={`${g.type}:${id}`}
                        value={`hit:${g.type}:${id}`}
                        onSelect={() => run(targetFor(g.route.section, g.route.panel))}
                        className={itemClass}
                      >
                        <span className="flex-1 truncate">{hitLabel(g.type, item)}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t(`palette.types.${g.type}`)}
                        </span>
                      </Command.Item>
                    );
                  }),
                )}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
