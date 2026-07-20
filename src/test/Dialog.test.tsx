// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Dialog } from '../components/ui/Dialog';

afterEach(cleanup);

function Fixture({
  onClose,
  isOpen = true,
}: {
  onClose?: () => void;
  isOpen?: boolean;
}) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose ?? (() => {})} title="Test Dialog">
      <button>First</button>
      <button>Second</button>
    </Dialog>
  );
}

describe('Dialog accessibility', () => {
  it('renders nothing when closed', () => {
    render(<Fixture isOpen={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('exposes role="dialog" and aria-modal when open', () => {
    render(<Fixture />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('links the title via aria-labelledby', () => {
    render(<Fixture />);
    const dialog = screen.getByRole('dialog');
    const id = dialog.getAttribute('aria-labelledby');
    expect(id).toBeTruthy();
    const title = document.getElementById(id!);
    expect(title?.textContent).toBe('Test Dialog');
  });

  it('moves focus into the dialog on open', () => {
    render(<Fixture />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Fixture onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('provides an aria-label on the close button', () => {
    render(<Fixture />);
    expect(screen.getByLabelText('Close dialog')).toBeTruthy();
  });

  it('traps Tab focus within the dialog', () => {
    render(<Fixture />);
    const dialog = screen.getByRole('dialog');
    const buttons = screen.getAllByRole('button');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });
});
