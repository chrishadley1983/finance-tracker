import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';

// Mock next/navigation
const mockPathname = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

// Mock Supabase client — logout button calls createClient().auth.signOut()
const mockSignOut = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}));

// Mock next/link - pass through className
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, className }: { children: React.ReactNode; href: string; onClick?: () => void; className?: string }) => (
    <a href={href} onClick={onClick} className={className}>{children}</a>
  ),
}));

// Mock fetch for review count
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Sidebar', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/');
    mockSignOut.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stats: { total: 0 } }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders all navigation items', () => {
      render(<Sidebar isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Accounts')).toBeInTheDocument();
      expect(screen.getByText('Transactions')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.getByText('Budgets')).toBeInTheDocument();
      expect(screen.getByText('Investments')).toBeInTheDocument();
      expect(screen.getByText('FIRE Calculator')).toBeInTheDocument();
      expect(screen.getByText('Planning Notes')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders the logo', () => {
      render(<Sidebar isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Finance Tracker')).toBeInTheDocument();
    });

    it('renders correct navigation links', () => {
      render(<Sidebar isOpen={true} onClose={mockOnClose} />);

      const links = screen.getAllByRole('link');
      expect(links.length).toBe(13);

      const hrefs = links.map(link => link.getAttribute('href'));
      expect(hrefs).toContain('/');
      expect(hrefs).toContain('/accounts');
      expect(hrefs).toContain('/transactions');
      expect(hrefs).toContain('/import');
      expect(hrefs).toContain('/review');
      expect(hrefs).toContain('/categories');
      expect(hrefs).toContain('/budgets');
      expect(hrefs).toContain('/wealth');
      expect(hrefs).toContain('/fire');
      expect(hrefs).toContain('/reports');
      expect(hrefs).toContain('/planning');
      expect(hrefs).toContain('/pets');
      expect(hrefs).toContain('/settings');
    });
  });

  describe('active state', () => {
    it('highlights the active route', () => {
      mockPathname.mockReturnValue('/transactions');
      render(<Sidebar isOpen={true} onClose={mockOnClose} />);

      const transactionsLink = screen.getByText('Transactions').closest('a');
      expect(transactionsLink).toHaveClass('bg-emerald-600');
    });

    it('does not highlight inactive routes', () => {
      mockPathname.mockReturnValue('/');
      render(<Sidebar isOpen={true} onClose={mockOnClose} />);

      const transactionsLink = screen.getByText('Transactions').closest('a');
      expect(transactionsLink).not.toHaveClass('bg-emerald-600');
      expect(transactionsLink).toHaveClass('text-slate-300');
    });
  });

  describe('mobile behavior', () => {
    it('shows overlay when open on mobile', () => {
      const { container } = render(<Sidebar isOpen={true} onClose={mockOnClose} />);

      // The overlay div should exist when isOpen is true
      const overlay = container.querySelector('.bg-black\\/50');
      expect(overlay).toBeInTheDocument();
    });

    it('does not show overlay when closed', () => {
      const { container } = render(<Sidebar isOpen={false} onClose={mockOnClose} />);

      const overlay = container.querySelector('.bg-black\\/50');
      expect(overlay).toBeNull();
    });

    it('calls onClose when overlay is clicked', () => {
      const { container } = render(<Sidebar isOpen={true} onClose={mockOnClose} />);

      const overlay = container.querySelector('.bg-black\\/50');
      if (overlay) {
        fireEvent.click(overlay);
      }
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when a nav link is clicked', () => {
      render(<Sidebar isOpen={true} onClose={mockOnClose} />);

      const dashboardLink = screen.getByText('Dashboard').closest('a');
      if (dashboardLink) {
        fireEvent.click(dashboardLink);
      }
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('visibility', () => {
    it('has translate-x-0 class when open', () => {
      const { container } = render(<Sidebar isOpen={true} onClose={mockOnClose} />);

      const sidebar = container.querySelector('aside');
      expect(sidebar).toHaveClass('translate-x-0');
    });

    it('has -translate-x-full class when closed', () => {
      const { container } = render(<Sidebar isOpen={false} onClose={mockOnClose} />);

      const sidebar = container.querySelector('aside');
      expect(sidebar).toHaveClass('-translate-x-full');
    });
  });
});
