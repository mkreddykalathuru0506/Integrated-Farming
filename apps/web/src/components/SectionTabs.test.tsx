import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n';
import { SECTIONS } from './nav';
import { SectionTabs } from './SectionTabs';

const finance = SECTIONS.find((s) => s.key === 'finance')!;
const reports = SECTIONS.find((s) => s.key === 'reports')!;

describe('SectionTabs', () => {
  it('renders one link-tab per panel with the first panel at the bare section path', () => {
    render(<SectionTabs section={finance} activePanelKey="feed" navigate={vi.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Feed',
      'Expenses',
      'Loans & insurance',
      'Invoices',
    ]);
    expect(tabs[0]).toHaveAttribute('href', '/finance');
    expect(tabs[3]).toHaveAttribute('href', '/finance/invoices');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('marks the active panel selected from the URL state', () => {
    render(<SectionTabs section={finance} activePanelKey="invoices" navigate={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Invoices' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Feed' })).toHaveAttribute('aria-selected', 'false');
  });

  it('plain click navigates in-app (first panel → no panel arg)', async () => {
    const navigate = vi.fn();
    render(<SectionTabs section={finance} activePanelKey="feed" navigate={navigate} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Expenses' }));
    expect(navigate).toHaveBeenCalledWith('finance', { panel: 'expenses' });
    await user.click(screen.getByRole('tab', { name: 'Feed' }));
    expect(navigate).toHaveBeenCalledWith('finance', undefined);
  });

  it('renders nothing for a single-panel section', () => {
    const { container } = render(
      <SectionTabs section={reports} activePanelKey="reports" navigate={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
