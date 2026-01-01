import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Button } from '@/components/Button';

describe('Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders children content', () => {
      render(<Button>Click me</Button>);

      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders as a button element', () => {
      render(<Button>Test</Button>);

      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });
  });

  describe('variants', () => {
    it('applies primary variant styles by default', () => {
      const { container } = render(<Button>Primary</Button>);

      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-blue-600');
      expect(button).toHaveClass('text-white');
    });

    it('applies primary variant styles when specified', () => {
      const { container } = render(<Button variant="primary">Primary</Button>);

      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-blue-600');
      expect(button).toHaveClass('text-white');
    });

    it('applies secondary variant styles', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>);

      const button = container.querySelector('button');
      expect(button).toHaveClass('bg-gray-200');
      expect(button).toHaveClass('text-gray-800');
    });
  });

  describe('onClick handler', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      const { container } = render(<Button onClick={handleClick}>Click me</Button>);

      const button = container.querySelector('button');
      if (button) {
        fireEvent.click(button);
      }

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick multiple times on repeated clicks', () => {
      const handleClick = vi.fn();
      const { container } = render(<Button onClick={handleClick}>Click me</Button>);

      const button = container.querySelector('button');
      if (button) {
        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.click(button);
      }

      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it('works without onClick handler', () => {
      const { container } = render(<Button>No handler</Button>);

      const button = container.querySelector('button');
      expect(() => {
        if (button) fireEvent.click(button);
      }).not.toThrow();
    });
  });

  describe('disabled state', () => {
    it('is not disabled by default', () => {
      const { container } = render(<Button>Click me</Button>);

      const button = container.querySelector('button');
      expect(button).not.toBeDisabled();
    });

    it('can be disabled', () => {
      const { container } = render(<Button disabled>Disabled</Button>);

      const button = container.querySelector('button');
      expect(button).toBeDisabled();
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      const { container } = render(<Button onClick={handleClick} disabled>Disabled</Button>);

      const button = container.querySelector('button');
      if (button) {
        fireEvent.click(button);
      }

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('applies disabled styles for primary variant', () => {
      const { container } = render(<Button variant="primary" disabled>Disabled</Button>);

      const button = container.querySelector('button');
      expect(button).toHaveClass('disabled:bg-blue-300');
    });

    it('applies disabled styles for secondary variant', () => {
      const { container } = render(<Button variant="secondary" disabled>Disabled</Button>);

      const button = container.querySelector('button');
      expect(button).toHaveClass('disabled:bg-gray-100');
    });
  });

  describe('styling', () => {
    it('has base styles', () => {
      const { container } = render(<Button>Styled</Button>);

      const button = container.querySelector('button');
      expect(button).toHaveClass('px-4');
      expect(button).toHaveClass('py-2');
      expect(button).toHaveClass('rounded');
      expect(button).toHaveClass('font-medium');
      expect(button).toHaveClass('transition-colors');
    });

    it('has hover styles for primary', () => {
      const { container } = render(<Button variant="primary">Primary</Button>);

      const button = container.querySelector('button');
      expect(button).toHaveClass('hover:bg-blue-700');
    });

    it('has hover styles for secondary', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>);

      const button = container.querySelector('button');
      expect(button).toHaveClass('hover:bg-gray-300');
    });
  });

  describe('children types', () => {
    it('renders text children', () => {
      render(<Button>Text content</Button>);

      expect(screen.getByText('Text content')).toBeInTheDocument();
    });

    it('renders element children', () => {
      render(
        <Button>
          <span data-testid="child-span">Span content</span>
        </Button>
      );

      expect(screen.getByTestId('child-span')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      );

      expect(screen.getByText('Icon')).toBeInTheDocument();
      expect(screen.getByText('Text')).toBeInTheDocument();
    });
  });
});
