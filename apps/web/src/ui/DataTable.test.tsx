import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import '../i18n';
import { DataTable, type DataTableColumn } from './DataTable';
import { EmptyState } from './EmptyState';

type Row = { name: string; qty: number };

const columns: DataTableColumn<Row>[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Qty', accessor: 'qty', align: 'right' },
];

const rows: Row[] = [
  { name: 'Broiler Starter', qty: 40 },
  { name: 'Layer Mash', qty: 10 },
  { name: 'Cattle Feed', qty: 25 },
];

/** First-column texts of the desktop table body, in order. */
function tableFirstColumn(): string[] {
  const table = screen.getByRole('table');
  return within(table)
    .getAllByRole('row')
    .slice(1) // skip header row
    .map((tr) => within(tr).getAllByRole('cell')[0]!.textContent ?? '');
}

describe('DataTable', () => {
  it('renders rows in both desktop table and mobile card layouts', () => {
    render(<DataTable columns={columns} data={rows} />);
    const table = screen.getByRole('table');
    expect(within(table).getByText('Broiler Starter')).toBeInTheDocument();
    expect(within(table).getByText('Layer Mash')).toBeInTheDocument();
    // mobile stacked cards render the same rows (hidden via CSS ≥sm)
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(3);
  });

  it('applies right alignment + tabular numerals on align:"right" cells', () => {
    render(<DataTable columns={columns} data={rows} />);
    const table = screen.getByRole('table');
    const qtyCell = within(table).getByText('40').closest('td');
    expect(qtyCell?.className).toContain('text-right');
    expect(qtyCell?.className).toContain('tabular');
  });

  it('sorts on header click: asc, then desc', () => {
    render(<DataTable columns={columns} data={rows} />);
    const table = screen.getByRole('table');
    const nameHeader = within(table).getByRole('button', { name: /Name/ });

    fireEvent.click(nameHeader);
    expect(tableFirstColumn()).toEqual(['Broiler Starter', 'Cattle Feed', 'Layer Mash']);
    expect(within(table).getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'ascending');

    fireEvent.click(nameHeader);
    expect(tableFirstColumn()).toEqual(['Layer Mash', 'Cattle Feed', 'Broiler Starter']);
    expect(within(table).getAllByRole('columnheader')[0]).toHaveAttribute('aria-sort', 'descending');
  });

  it('filters rows via the global search input', () => {
    render(<DataTable columns={columns} data={rows} searchable />);
    fireEvent.change(screen.getByLabelText('Search…'), { target: { value: 'layer' } });
    expect(tableFirstColumn()).toEqual(['Layer Mash']);

    fireEvent.change(screen.getByLabelText('Search…'), { target: { value: 'zzz' } });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByText('Nothing here yet').length).toBeGreaterThan(0);
  });

  it('paginates: slices rows, shows the range, and navigates with prev/next', () => {
    const many: Row[] = Array.from({ length: 25 }, (_, i) => ({
      name: `Item ${String(i + 1).padStart(2, '0')}`,
      qty: i,
    }));
    render(<DataTable columns={columns} data={many} pageSize={10} />);

    expect(tableFirstColumn()).toHaveLength(10);
    expect(screen.getByText('1–10 of 25')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('11–20 of 25')).toBeInTheDocument();
    expect(tableFirstColumn()[0]).toBe('Item 11');

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('21–25 of 25')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('hides pagination when everything fits on one page', () => {
    render(<DataTable columns={columns} data={rows} pageSize={10} />);
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
    expect(screen.queryByText(/of 3/)).not.toBeInTheDocument();
  });

  it('renders the provided emptyState when there is no data', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyState={<EmptyState icon={Inbox} title="No feed items" description="Add your first item" />}
      />,
    );
    expect(screen.getByText('No feed items')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the table skeleton while loading', () => {
    render(<DataTable columns={columns} data={undefined} isLoading />);
    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('fires onRowClick with the row data', () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={rows} onRowClick={onRowClick} />);
    const table = screen.getByRole('table');
    fireEvent.click(within(table).getByText('Layer Mash'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });
});
