import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../i18n';
import { MobileTabBar } from './MobileTabBar';

describe('MobileTabBar', () => {
  it('renders role-appropriate primary tabs + More (OWNER)', () => {
    render(<MobileTabBar role="OWNER" activeKey="overview" navigate={vi.fn()} onMore={vi.fn()} />);
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Overview',
      'Livestock',
      'Daily Ops',
      'Feed & Finance',
    ]);
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('LABOUR gets operational tabs — no finance', () => {
    render(<MobileTabBar role="LABOUR" activeKey="daily" navigate={vi.fn()} onMore={vi.fn()} />);
    const labels = screen.getAllByRole('link').map((a) => a.textContent);
    expect(labels).toEqual(['Overview', 'Daily Ops', 'Livestock', 'Sales & Meat']);
    expect(labels).not.toContain('Feed & Finance');
  });

  it('BUYER collapses to overview + More', () => {
    render(<MobileTabBar role="BUYER" activeKey="overview" navigate={vi.fn()} onMore={vi.fn()} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('marks the active tab with aria-current and navigates on plain click', async () => {
    const navigate = vi.fn();
    render(<MobileTabBar role="OWNER" activeKey="livestock" navigate={navigate} onMore={vi.fn()} />);
    expect(screen.getByRole('link', { name: /Livestock/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Overview/ })).not.toHaveAttribute('aria-current');

    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: /Feed & Finance/ }));
    expect(navigate).toHaveBeenCalledWith('finance');
  });

  it('More opens the drawer callback', async () => {
    const onMore = vi.fn();
    render(<MobileTabBar role="OWNER" activeKey="overview" navigate={vi.fn()} onMore={onMore} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });
});
