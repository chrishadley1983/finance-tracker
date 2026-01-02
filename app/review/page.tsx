import { ReviewQueue } from '@/components/review';

export const metadata = {
  title: 'Review Queue | Finance Tracker',
  description: 'Review and categorise transactions',
};

export default function ReviewPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Review Queue
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Review uncategorised transactions and those flagged for review
        </p>
      </div>

      <ReviewQueue />
    </div>
  );
}
