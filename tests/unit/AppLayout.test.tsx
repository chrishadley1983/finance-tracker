import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AppLayout } from '@/components/layout/AppLayout';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, onClick }: { children: React.ReactNode; href: string; onClick?: () => void }) => (
    <a href={href} onClick={onClick}>{children}</a>
  ),
}));

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders children content', () => {
      render(
        <AppLayout title="Test Page">
          <div data-testid="child-content">Hello World</div>
        </AppLayout>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('renders the Header with correct title', () => {
      render(
        <AppLayout title="Dashboard">
          <div>Content</div>
        </AppLayout>
      );

      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });

    it('renders the Sidebar', () => {
      const { container } = render(
        <AppLayout title="Dashboard">
          <div>Content</div>
        </AppLayout>
      );

      // Sidebar should contain navigation items
      const sidebar = container.querySelector('aside');
      expect(sidebar).toBeInTheDocument();
      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    it('renders main element with children', () => {
      const { container } = render(
        <AppLayout title="Dashboard">
          <p>Main content here</p>
        </AppLayout>
      );

      const main = container.querySelector('main');
      expect(main).toBeInTheDocument();
      expect(main).toHaveTextContent('Main content here');
    });
  });

  describe('sidebar toggle', () => {
    it('sidebar is closed by default on mobile', () => {
      const { container } = render(
        <AppLayout title="Dashboard">
          <div>Content</div>
        </AppLayout>
      );

      const sidebar = container.querySelector('aside');
      expect(sidebar).toHaveClass('-translate-x-full');
    });

    it('opens sidebar when menu button is clicked', () => {
      const { container } = render(
        <AppLayout title="Dashboard">
          <div>Content</div>
        </AppLayout>
      );

      const menuButton = container.querySelector('button[aria-label="Open menu"]');
      if (menuButton) {
        fireEvent.click(menuButton);
      }

      const sidebar = container.querySelector('aside');
      expect(sidebar).toHaveClass('translate-x-0');
    });

    it('closes sidebar when overlay is clicked', () => {
      const { container } = render(
        <AppLayout title="Dashboard">
          <div>Content</div>
        </AppLayout>
      );

      // Open sidebar first
      const menuButton = container.querySelector('button[aria-label="Open menu"]');
      if (menuButton) {
        fireEvent.click(menuButton);
      }

      // Click overlay to close
      const overlay = container.querySelector('.bg-black\\/50');
      if (overlay) {
        fireEvent.click(overlay);
      }

      const sidebar = container.querySelector('aside');
      expect(sidebar).toHaveClass('-translate-x-full');
    });

    it('closes sidebar when navigation link is clicked', () => {
      const { container } = render(
        <AppLayout title="Dashboard">
          <div>Content</div>
        </AppLayout>
      );

      // Open sidebar first
      const menuButton = container.querySelector('button[aria-label="Open menu"]');
      if (menuButton) {
        fireEvent.click(menuButton);
      }

      // Click a nav link
      const transactionsLink = screen.getByText('Transactions').closest('a');
      if (transactionsLink) {
        fireEvent.click(transactionsLink);
      }

      const sidebar = container.querySelector('aside');
      expect(sidebar).toHaveClass('-translate-x-full');
    });
  });

  describe('layout structure', () => {
    it('has correct wrapper structure', () => {
      const { container } = render(
        <AppLayout title="Dashboard">
          <div>Content</div>
        </AppLayout>
      );

      // Root div should have min-h-screen
      const rootDiv = container.querySelector('.min-h-screen');
      expect(rootDiv).toBeInTheDocument();
    });

    it('has main content offset for sidebar', () => {
      const { container } = render(
        <AppLayout title="Dashboard">
          <div>Content</div>
        </AppLayout>
      );

      // Main content container should have left padding for sidebar on desktop
      const contentWrapper = container.querySelector('.lg\\:pl-64');
      expect(contentWrapper).toBeInTheDocument();
    });
  });

  describe('different page titles', () => {
    it.each([
      'Test Title 1',
      'Test Title 2',
      'Test Title 3',
    ])('renders with title "%s"', (title) => {
      render(
        <AppLayout title={title}>
          <div>Content</div>
        </AppLayout>
      );

      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    });
  });
});
