'use client';

interface TransactionPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function TransactionPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: TransactionPaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  const handlePrevious = () => {
    if (canGoPrevious) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onPageChange(page + 1);
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = parseInt(e.target.value, 10);
    onPageSizeChange(newSize);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
      {/* Showing X-Y of Z */}
      <div className="text-sm text-ink-2">
        {total > 0 ? (
          <>
            Showing <span className="fig font-medium text-ink">{startItem}</span> to{' '}
            <span className="fig font-medium text-ink">{endItem}</span> of{' '}
            <span className="fig font-medium text-ink">{total.toLocaleString()}</span> transactions
          </>
        ) : (
          'No transactions'
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Page size dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="pageSize" className="text-sm text-ink-2">
            Show
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={handlePageSizeChange}
            className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-sm text-ink-2">per page</span>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevious}
            disabled={!canGoPrevious}
            className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface px-2.5 text-sm font-medium text-ink-2 hover:bg-sunk disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface"
            aria-label="Previous page"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          {/* Page indicator */}
          <span className="px-1 text-sm text-ink-2">
            Page <span className="fig font-medium text-ink">{page}</span> of{' '}
            <span className="fig font-medium text-ink">{totalPages || 1}</span>
          </span>

          <button
            onClick={handleNext}
            disabled={!canGoNext}
            className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface px-2.5 text-sm font-medium text-ink-2 hover:bg-sunk disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface"
            aria-label="Next page"
          >
            Next
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
