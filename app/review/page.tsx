import { AppLayout } from '@/components/layout';
import { ReviewQueue } from '@/components/review';

export const metadata = {
  title: 'Review Queue | Finance Tracker',
  description: 'Review and categorise transactions',
};

export default function ReviewPage() {
  return (
    <AppLayout title="Review Queue">
      <div className="mb-6">
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Review uncategorised transactions and those flagged for review
        </p>
      </div>

      <ReviewQueue />
    </AppLayout>
  );
}
