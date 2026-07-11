import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '../i18n';
import { ConfirmDialog } from './Dialog';

function setup(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="Delete unit"
      description="Are you sure?"
      variant="danger"
      {...props}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe('ConfirmDialog', () => {
  it('renders title, description and default i18n labels', () => {
    setup({ variant: 'default' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete unit')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const { onConfirm, onOpenChange } = setup({ confirmLabel: 'Delete' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('closes via onOpenChange(false) when cancel is clicked', () => {
    const { onConfirm, onOpenChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closes on Escape (Radix keyboard handling)', () => {
    const { onOpenChange } = setup();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('traps focus inside the dialog (smoke)', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('disables the confirm button and shows a spinner while loading', () => {
    setup({ loading: true, confirmLabel: 'Delete' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(confirm.querySelector('[data-slot="spinner"]')).not.toBeNull();
  });
});
