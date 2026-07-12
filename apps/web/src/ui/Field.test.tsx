import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';
import { Input } from './Input';

describe('Field', () => {
  it('associates the label with the child input via htmlFor/id', () => {
    render(
      <Field label="Farm name">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Farm name');
    expect(input.tagName).toBe('INPUT');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('keeps a caller-provided id', () => {
    render(
      <Field label="Email">
        <Input id="my-email" />
      </Field>,
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'my-email');
  });

  it('wires error text with aria-invalid + aria-describedby and role=alert', () => {
    render(
      <Field label="Wage" error="Required">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Wage');
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Required');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('shows the hint (described-by) when there is no error, and marks required', () => {
    render(
      <Field label="GSTIN" hint="15 characters" required>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/GSTIN/);
    expect(input).toHaveAttribute('aria-required', 'true');
    const hintId = input.getAttribute('aria-describedby');
    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId!)).toHaveTextContent('15 characters');
  });
});
