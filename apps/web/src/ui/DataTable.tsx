import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { cn } from './cn';
import { Input } from './Input';
import { PanelNote } from './Panel';
import { TableSkeleton } from './Skeleton';
import { Table, TBody, Td, Th, THead, Tr } from './Table';

export type DataTableColumn<T> = {
  /** Column id — required when `accessor` is not a plain property name. */
  id?: string;
  /** Header label: an i18n key (string, translated) or a ready ReactNode. */
  header: string | ReactNode;
  /** Row value: property name or derive function. Omit for render-only columns (e.g. actions). */
  accessor?: keyof T | ((row: T) => unknown);
  /** Custom cell renderer; defaults to the accessor value. */
  cell?: (row: T) => ReactNode;
  /** 'right' applies right alignment + tabular numerals (money/counts). */
  align?: 'left' | 'right';
  /** Sorting is on by default for accessor columns. */
  enableSorting?: boolean;
  /** Extra classes on body cells. */
  className?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: readonly T[] | undefined;
  isLoading?: boolean;
  /** Rendered when there are no rows at all (use <EmptyState/>). */
  emptyState?: ReactNode;
  /** Show a global search input above the table. */
  searchable?: boolean;
  /** i18n key for the search placeholder (defaults to table.search). */
  searchPlaceholderKey?: string;
  /** Client-side page size (default 10). Pagination hides itself at ≤1 page. */
  pageSize?: number;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T, index: number) => string;
  className?: string;
};

/**
 * The workhorse list component: headless TanStack Table under a Harvest skin.
 * Client-side sorting, optional global search, client-side pagination, sticky
 * header. Below `sm` each row renders as a stacked label/value card so lists
 * stay usable at 360 px.
 */
export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyState,
  searchable,
  searchPlaceholderKey,
  pageSize = 10,
  onRowClick,
  getRowId,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const tableData = useMemo(() => (data ?? []) as T[], [data]);

  const { columnDefs, ids } = useMemo(() => {
    const defs: ColumnDef<T, unknown>[] = [];
    const colIds: string[] = [];
    columns.forEach((c, i) => {
      const id = c.id ?? (typeof c.accessor === 'string' ? c.accessor : `col_${i}`);
      const accessorFn =
        typeof c.accessor === 'function'
          ? c.accessor
          : typeof c.accessor === 'string'
            ? (row: T) => row[c.accessor as keyof T] as unknown
            : undefined;
      colIds.push(id);
      defs.push({
        id,
        ...(accessorFn ? { accessorFn } : {}),
        enableSorting: (c.enableSorting ?? true) && accessorFn !== undefined,
        enableGlobalFilter: accessorFn !== undefined,
      });
    });
    return { columnDefs: defs, ids: colIds };
  }, [columns]);

  const table = useReactTable({
    data: tableData,
    columns: columnDefs,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
    initialState: { pagination: { pageSize } },
    ...(getRowId ? { getRowId } : {}),
  });

  if (isLoading) {
    return <TableSkeleton rows={Math.min(pageSize, 5)} cols={columns.length} className={className} />;
  }

  if (tableData.length === 0) {
    return <div className={className}>{emptyState ?? <PanelNote>{t('table.empty')}</PanelNote>}</div>;
  }

  const label = (c: DataTableColumn<T>): ReactNode =>
    typeof c.header === 'string' ? t(c.header) : c.header;

  const cellContent = (row: T, c: DataTableColumn<T>, id: string, getValue: (id: string) => unknown): ReactNode => {
    if (c.cell) return c.cell(row);
    if (c.accessor === undefined) return null;
    return getValue(id) as ReactNode;
  };

  const rows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: livePageSize } = table.getState().pagination;
  const from = pageIndex * livePageSize + 1;
  const to = Math.min(from + rows.length - 1, filteredCount);
  const headers = table.getHeaderGroups()[0]?.headers ?? [];

  const rowKeyDown = (row: T) => (e: KeyboardEvent) => {
    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {searchable && (
        <div className="relative max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={t(searchPlaceholderKey ?? 'table.search')}
            aria-label={t(searchPlaceholderKey ?? 'table.search')}
            className="pl-9"
          />
        </div>
      )}

      {filteredCount === 0 ? (
        <PanelNote>{t('table.empty')}</PanelNote>
      ) : (
        <>
          {/* Desktop / ≥sm: real table. The wrapper is the scroll container in BOTH
              axes (capped height) so the sticky header actually sticks on long lists
              (audit P2-16 — page scroll never reached it before). */}
          <div className="hidden max-h-[70vh] overflow-auto rounded-md border border-border bg-card sm:block">
            <Table>
              <THead className="sticky top-0 z-10 bg-card">
                <Tr>
                  {headers.map((header, i) => {
                    const def = columns[i]!;
                    const col = header.column;
                    const sorted = col.getIsSorted();
                    return (
                      <Th
                        key={header.id}
                        aria-sort={
                          sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                        }
                        className={cn(def.align === 'right' && 'text-right')}
                      >
                        {col.getCanSort() ? (
                          <button
                            type="button"
                            onClick={col.getToggleSortingHandler()}
                            className={cn(
                              'inline-flex items-center gap-1 rounded uppercase tracking-wider transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                              def.align === 'right' && 'flex-row-reverse',
                            )}
                          >
                            {label(def)}
                            {sorted === 'asc' ? (
                              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                            ) : sorted === 'desc' ? (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
                            )}
                          </button>
                        ) : (
                          label(def)
                        )}
                      </Th>
                    );
                  })}
                </Tr>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <Tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    onKeyDown={onRowClick ? rowKeyDown(row.original) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      'transition-colors duration-150 hover:bg-muted/50',
                      onRowClick &&
                        'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset',
                    )}
                  >
                    {columns.map((def, i) => (
                      <Td
                        key={ids[i]}
                        className={cn(def.align === 'right' && 'tabular text-right', def.className)}
                      >
                        {cellContent(row.original, def, ids[i]!, (id) => row.getValue(id))}
                      </Td>
                    ))}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>

          {/* Mobile / <sm: stacked label/value cards (360 px-friendly) */}
          <ul className="space-y-2 sm:hidden">
            {rows.map((row) => (
              <li
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={onRowClick ? rowKeyDown(row.original) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  'space-y-1.5 rounded-md border border-border bg-card p-3',
                  onRowClick &&
                    'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset',
                )}
              >
                {columns.map((def, i) => {
                  const content = cellContent(row.original, def, ids[i]!, (id) => row.getValue(id));
                  if (content === null || content === undefined || content === '') return null;
                  return (
                    <div key={ids[i]} className="flex items-start justify-between gap-3 text-sm">
                      <span className="shrink-0 pt-px text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {label(def)}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 text-right text-foreground',
                          def.align === 'right' && 'tabular',
                        )}
                      >
                        {content}
                      </span>
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>

          {table.getPageCount() > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="tabular text-xs text-muted-foreground">
                {t('table.range', { from, to, total: filteredCount })}
              </p>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label={t('table.prev')}
                >
                  <ChevronLeft aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label={t('table.next')}
                >
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
