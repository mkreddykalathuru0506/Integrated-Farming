import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InrInput } from './InrInput';

describe('InrInput', () => {
  it('emits the integer-paise string for valid rupee text', () => {
    const onChangePaise = vi.fn();
    render(<InrInput value="" onChangePaise={onChangePaise} aria-label="Amount" />);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.50' } });
    expect(onChangePaise).toHaveBeenCalledWith('1250', '12.50');
  });

  it('emits null for invalid text and flags aria-invalid once the value holds it', () => {
    const onChangePaise = vi.fn();
    const { rerender } = render(
      <InrInput value="" onChangePaise={onChangePaise} aria-label="Amount" />,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'abc' } });
    expect(onChangePaise).toHaveBeenCalledWith(null, 'abc');

    // controlled: parent stores the raw text; the input then shows the invalid state
    rerender(<InrInput value="abc" onChangePaise={onChangePaise} aria-label="Amount" />);
    expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not flag an empty value as invalid and uses the decimal keypad', () => {
    render(<InrInput value="" onChangePaise={() => {}} aria-label="Amount" />);
    const input = screen.getByLabelText('Amount');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });
});
