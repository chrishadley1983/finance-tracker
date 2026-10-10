import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MoneyInput, formatMoneyInput, parseMoneyInput } from '@/components/ui/MoneyInput';
import { paceFill } from '@/components/ui/PaceBar';

afterEach(cleanup);

describe('money input helpers', () => {
  it('formats with separators and pence only when there are some', () => {
    expect(formatMoneyInput(416085.32)).toBe('416,085.32');
    expect(formatMoneyInput(97520)).toBe('97,520');
    expect(formatMoneyInput(1250.5)).toBe('1,250.50');
    expect(formatMoneyInput(null)).toBe('');
  });
  it('parses what people type', () => {
    expect(parseMoneyInput('£1,250.50')).toBe(1250.5);
    expect(parseMoneyInput(' 97520 ')).toBe(97520);
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('-')).toBeUndefined();
    expect(parseMoneyInput('12a')).toBeUndefined();
  });
});

function Harness({ initial, onValue }: { initial: number | null; onValue: (v: number | null) => void }) {
  const [v, setV] = useState(initial);
  return (
    <MoneyInput
      label="Balance"
      value={v}
      onChange={(n) => {
        setV(n);
        onValue(n);
      }}
    />
  );
}

describe('MoneyInput', () => {
  it('shows a formatted £ amount at rest and the raw value while editing', () => {
    render(<Harness initial={416085.32} onValue={() => {}} />);
    const input = screen.getByRole('textbox', { name: 'Balance' }) as HTMLInputElement;
    expect(input.value).toBe('416,085.32');
    expect(input.className).toContain('fig');
    expect(screen.getByText('£')).toBeInTheDocument();
    fireEvent.focus(input);
    expect(input.value).toBe('416085.32');
    fireEvent.blur(input);
    expect(input.value).toBe('416,085.32');
  });

  it('passes the typed value through exactly, pence and all', () => {
    const onValue = vi.fn();
    render(<Harness initial={null} onValue={onValue} />);
    const input = screen.getByRole('textbox', { name: 'Balance' }) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1234.57' } });
    expect(onValue).toHaveBeenLastCalledWith(1234.57);
    fireEvent.change(input, { target: { value: '' } });
    expect(onValue).toHaveBeenLastCalledWith(null);
    fireEvent.change(input, { target: { value: '0.01' } });
    fireEvent.blur(input);
    expect(onValue).toHaveBeenLastCalledWith(0.01);
    expect(input.value).toBe('0.01');
  });
});

describe('PaceBar fill', () => {
  it('fills a line spent exactly to budget in neutral ink, fixed or not', () => {
    expect(paceFill(1450, 1450, 'ok', true)).toBe('bg-ink-2');
    expect(paceFill(1450, 1450, 'ok', false)).toBe('bg-ink-2');
    expect(paceFill(0, 1450, 'ok', true)).not.toBe('bg-line');
    expect(paceFill(1500, 1450, 'over')).toBe('bg-bad');
  });
});
