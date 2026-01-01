import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Header } from '@/components/layout/Header';

describe('Header', () => {
  const mockOnMenuClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders the page title', () => {
      render(<Header title="Dashboard" onMenuClick={mockOnMenuClick} />);

      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });

    it('renders different titles correctly', () => {
      const { rerender } = render(<Header title="Transactions" onMenuClick={mockOnMenuClick} />);
      expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument();

      rerender(<Header title="Settings" onMenuClick={mockOnMenuClick} />);
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    });

    it('renders the mobile menu button', () => {
      const { container } = render(<Header title="Dashboard" onMenuClick={mockOnMenuClick} />);

      const menuButton = container.querySelector('button[aria-label="Open menu"]');
      expect(menuButton).toBeInTheDocument();
    });
  });

  describe('menu button interaction', () => {
    it('calls onMenuClick when menu button is clicked', () => {
      const { container } = render(<Header title="Dashboard" onMenuClick={mockOnMenuClick} />);

      const menuButton = container.querySelector('button[aria-label="Open menu"]');
      if (menuButton) {
        fireEvent.click(menuButton);
      }

      expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
    });

    it('calls onMenuClick multiple times on repeated clicks', () => {
      const { container } = render(<Header title="Dashboard" onMenuClick={mockOnMenuClick} />);

      const menuButton = container.querySelector('button[aria-label="Open menu"]');
      if (menuButton) {
        fireEvent.click(menuButton);
        fireEvent.click(menuButton);
        fireEvent.click(menuButton);
      }

      expect(mockOnMenuClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('accessibility', () => {
    it('has proper aria-label on menu button', () => {
      const { container } = render(<Header title="Dashboard" onMenuClick={mockOnMenuClick} />);

      const menuButton = container.querySelector('button[aria-label="Open menu"]');
      expect(menuButton).toBeInTheDocument();
      expect(menuButton).toHaveAttribute('aria-label', 'Open menu');
    });

    it('uses semantic heading element for title', () => {
      const { container } = render(<Header title="Dashboard" onMenuClick={mockOnMenuClick} />);

      const heading = container.querySelector('h1');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Dashboard');
    });
  });

  describe('styling', () => {
    it('renders header element', () => {
      const { container } = render(<Header title="Dashboard" onMenuClick={mockOnMenuClick} />);

      const header = container.querySelector('header');
      expect(header).toBeInTheDocument();
    });

    it('has sticky positioning class', () => {
      const { container } = render(<Header title="Dashboard" onMenuClick={mockOnMenuClick} />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('sticky');
      expect(header).toHaveClass('top-0');
    });
  });
});
