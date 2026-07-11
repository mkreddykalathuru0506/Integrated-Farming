import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button loading', () => {
  it('disables the button, sets aria-busy and shows a spinner', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn.querySelector('[data-slot="spinner"]')).not.toBeNull();
    // children stay in the DOM (invisible) so the width is preserved
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Save').className).toContain('invisible');
  });

  it('does not fire onClick while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders normally (no spinner, enabled) when not loading', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeEnabled();
    expect(btn).not.toHaveAttribute('aria-busy');
    expect(btn.querySelector('[data-slot="spinner"]')).toBeNull();
  });
});
