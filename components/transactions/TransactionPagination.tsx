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
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-white border border-slate-200 rounded-lg">
      {/* Showing X-Y of Z */}
      <div className="text-sm text-slate-600">
        {total > 0 ? (
          <>
            Showing <span className="font-medium text-slate-900">{startItem}</span> to{' '}
            <span className="font-medium text-slate-900">{endItem}</span> of{' '}
            <span className="font-medium text-slate-900">{total.toLocaleString()}</span> transactions
          </>
        ) : (
          'No transactions'
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Page size dropdown */}
        <div className="flex items-center gap-2">
          <label htmlFor="pageSize" className="text-sm text-slate-600">
            Show
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={handlePageSizeChange}
            className="h-9 px-2 border border-slate-300 rounded-md bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-600">per page</span>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevious}
            disabled={!canGoPrevious}
            className="inline-flex items-center justify-center h-9 px-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
            aria-label="Previous page"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>

          {/* Page indicator */}
          <span className="text-sm text-slate-600 px-2">
            Page <span className="font-medium text-slate-900">{page}</span> of{' '}
            <span className="font-medium text-slate-900">{totalPages || 1}</span>
          </span>

          <button
            onClick={handleNext}
            disabled={!canGoNext}
            className="inline-flex items-center justify-center h-9 px-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
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
