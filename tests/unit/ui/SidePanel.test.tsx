import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SidePanel } from '@/components/ui/SidePanel';

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open details</button>
      <SidePanel
        open={open}
        title="Transaction details"
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <input aria-label="Note" />
      </SidePanel>
    </>
  );
}

describe('SidePanel', () => {
  afterEach(() => cleanup());

  it('renders a modal dialog labelled by its title', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('Open details'));

    const dialog = screen.getByRole('dialog', { name: 'Transaction details' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus into the panel on open', () => {
    render(<Harness />);
    const trigger = screen.getByText('Open details');
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('Escape closes and focus returns to the trigger', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const trigger = screen.getByText('Open details');
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('close button closes', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText('Open details'));
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    render(<SidePanel open={false} onClose={vi.fn()} title="Hidden">x</SidePanel>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
