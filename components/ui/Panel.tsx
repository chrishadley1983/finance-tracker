import type { ReactNode } from 'react';

interface PanelProps {
  title?: ReactNode;
  /** Right side of the header: a link or small control. */
  action?: ReactNode;
  /**
   * 'open' (default): a top rule and no box, for sections of a page.
   * 'boxed': hairline border on a surface, for things that are a separate object (tables, forms).
   */
  variant?: 'open' | 'boxed';
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  as?: 'section' | 'div';
  id?: string;
}

export function Panel({ title, action, variant = 'open', className = '', bodyClassName = '', children, as = 'section', id }: PanelProps) {
  const Tag = as;
  const boxed = variant === 'boxed';
  return (
    <Tag
      id={id}
      className={`min-w-0 ${boxed ? 'rounded-[3px] border border-line bg-surface' : 'border-t-[1.5px] border-ink'} ${className}`}
    >
      {(title || action) && (
        <div className={`flex items-baseline justify-between gap-3 ${boxed ? 'border-b border-line-2 px-4 py-3' : 'py-2.5'}`}>
          {title && <h2 className="text-[13.5px] font-semibold text-ink">{title}</h2>}
          {action && <div className="text-[12.5px] text-ink-3">{action}</div>}
        </div>
      )}
      <div className={`${boxed ? 'p-4' : ''} ${bodyClassName}`}>{children}</div>
    </Tag>
  );
}
