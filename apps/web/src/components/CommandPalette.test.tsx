import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import '../i18n';
import { FarmProvider } from '../api/FarmContext';
import { jsonResponse, mockFetchRoutes } from '../test/mockFetch';
import { CommandPalette } from './CommandPalette';
import { useHotkeys } from './useHotkeys';
import type { NavTarget } from './commands';
import type { Role } from './nav';

// Dialog-heavy userEvent flows can exceed the 5s default under parallel CI load
// — allow more headroom for this file (same pattern as the sales sweep files).
vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => {
  // cmdk scrolls the selected item into view; jsdom has no scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** AppLayout-like harness: hotkeys toggle the palette. */
function Harness({ role, onNavigate }: { role: Role | undefined; onNavigate: (t: NavTarget) => void }) {
  const [open, setOpen] = useState(false);
  useHotkeys({
    onTogglePalette: () => setOpen((o) => !o),
    onOpenPalette: () => setOpen(true),
    onOpenHelp: () => {},
    onGoto: () => {},
  });
  return <CommandPalette open={open} onOpenChange={setOpen} role={role} onNavigate={onNavigate} />;
}

function renderPalette(role: Role | undefined = 'OWNER', onNavigate = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <FarmProvider farmId="f1">
        <Harness role={role} onNavigate={onNavigate} />
      </FarmProvider>
    </QueryClientProvider>,
  );
  return onNavigate;
}

describe('CommandPalette', () => {
  it('opens on Ctrl+K and closes on a second Ctrl+K', async () => {
    mockFetchRoutes({});
    renderPalette();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(await screen.findByPlaceholderText('Type a command or search…')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens on / but not while typing in an input', async () => {
    mockFetchRoutes({});
    render(<input aria-label="outside" />);
    renderPalette();

    // typing `/` inside an input must not open the palette
    fireEvent.keyDown(screen.getByLabelText('outside'), { key: '/' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: '/' });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('filters to matching commands and navigates on select', async () => {
    mockFetchRoutes({});
    const onNavigate = renderPalette('OWNER');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText('Type a command or search…'), 'invo');

    // both the panel row and the action row match
    expect(await screen.findByText('Invoices')).toBeInTheDocument();
    expect(screen.getByText('New invoice')).toBeInTheDocument();
    expect(screen.queryByText('Batches')).not.toBeInTheDocument();

    await user.click(screen.getByText('Invoices'));
    expect(onNavigate).toHaveBeenCalledWith({ key: 'finance', panel: 'invoices' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('hides role-gated commands (LABOUR sees no invoice entries)', async () => {
    mockFetchRoutes({ '/api/farm/search': () => jsonResponse(200, { q: 'invo', total: 0, groups: [] }) });
    renderPalette('LABOUR');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText('Type a command or search…'), 'invo');
    await waitFor(() => expect(screen.getByText('No results')).toBeInTheDocument());
    expect(screen.queryByText('New invoice')).not.toBeInTheDocument();
    expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
  });

  it('renders debounced search results and navigates to the record panel', async () => {
    const searches: string[] = [];
    mockFetchRoutes({
      '/api/farm/search': (_init, url) => {
        const q = new URL(url).searchParams.get('q') ?? '';
        searches.push(q);
        return jsonResponse(200, {
          q,
          total: 1,
          groups: [
            {
              type: 'batch',
              route: { section: 'livestock', panel: 'batches' },
              items: [{ id: 'b1', code: 'BR-2026-01', name: 'Broilers', status: 'ACTIVE' }],
            },
          ],
        });
      },
    });
    const onNavigate = renderPalette('OWNER');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText('Type a command or search…'), 'BR-2026');

    const hit = await screen.findByText('BR-2026-01 · Broilers');
    expect(screen.getByText('Results')).toBeInTheDocument();
    // debounce collapsed the keystrokes into (at most) a couple of requests
    expect(searches.length).toBeLessThanOrEqual(2);

    await user.click(hit);
    expect(onNavigate).toHaveBeenCalledWith({ key: 'livestock', panel: 'batches' });
  });

  it('role-gates search hits: a LABOUR user never sees an invoice hit routing to Finance', async () => {
    mockFetchRoutes({
      '/api/farm/search': (_init, url) => {
        const q = new URL(url).searchParams.get('q') ?? '';
        return jsonResponse(200, {
          q,
          total: 1,
          groups: [
            {
              type: 'invoice',
              route: { section: 'finance', panel: 'invoices' },
              items: [{ id: 'i1', invoiceNumber: 'INV-2026-0042' }],
            },
          ],
        });
      },
    });
    // Finance is hidden from LABOUR — the hit must be dropped (would deep-link to Overview).
    renderPalette('LABOUR');
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const user = userEvent.setup();
    await user.type(await screen.findByPlaceholderText('Type a command or search…'), 'INV-2026');
    await waitFor(() => expect(screen.getByText('No results')).toBeInTheDocument());
    expect(screen.queryByText('INV-2026-0042')).not.toBeInTheDocument();
  });
});
