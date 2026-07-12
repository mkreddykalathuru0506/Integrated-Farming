import { render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { chartAnim, severityColor, severityTextClass } from './chart';
import { ChartTooltip } from './ChartTooltip';
import { EmptyState } from './EmptyState';

afterEach(() => vi.unstubAllGlobals());

describe('severity → status token map (chart-spec §1)', () => {
  it('maps severities onto themable status tokens, never hex', () => {
    expect(severityColor('CRITICAL')).toBe('hsl(var(--destructive))');
    expect(severityColor('WARNING')).toBe('hsl(var(--warning))');
    expect(severityColor('INFO')).toBe('hsl(var(--primary))');
    expect(severityColor('SOMETHING_ELSE')).toBe('hsl(var(--muted-foreground))');
    expect(severityTextClass('WARNING')).toBe('text-warning-ink');
  });
});

describe('chartAnim (chart-spec §7)', () => {
  it('600ms ease-out entrance when motion is allowed', () => {
    expect(chartAnim()).toEqual({
      isAnimationActive: true,
      animationDuration: 600,
      animationEasing: 'ease-out',
      animationBegin: 0,
    });
  });

  it('disables the entrance under prefers-reduced-motion (JS gate — CSS kill cannot reach Recharts)', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(chartAnim().isAnimationActive).toBe(false);
  });
});

describe('ChartTooltip (chart-spec §6)', () => {
  it('renders label + swatch rows on popover tokens', () => {
    const { container } = render(
      <ChartTooltip
        active
        label="Jul"
        payload={[{ name: 'Revenue', value: 500000, color: 'hsl(var(--chart-1))' }]}
        format={(v) => `₹${v}`}
      />,
    );
    expect(screen.getByText('Jul')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('₹500000')).toBeInTheDocument();
    expect(container.querySelector('.bg-popover')).not.toBeNull();
  });

  it('renders nothing when inactive or empty', () => {
    const { container } = render(<ChartTooltip active={false} payload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('EmptyState illustrations (slice 11.10)', () => {
  it('renders the spot illustration instead of the icon circle when named', () => {
    const { container } = render(
      <EmptyState icon={Inbox} illustration="livestock" title="No batches yet" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true'); // decorative — title carries meaning
    expect(screen.getByText('No batches yet')).toBeInTheDocument();
  });

  it('falls back to the icon circle when no illustration is given (no call-site breaks)', () => {
    const { container } = render(<EmptyState icon={Inbox} title="Empty" />);
    expect(container.querySelector('.rounded-full.bg-muted')).not.toBeNull();
  });
});
