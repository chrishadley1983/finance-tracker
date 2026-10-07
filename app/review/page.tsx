import { AppLayout } from '@/components/layout';
import { ReviewQueue } from '@/components/review';

export const metadata = {
  title: 'To review | Hadley Finance Tracker',
  description: 'Review uncategorised and flagged transactions',
};

export default function ReviewPage() {
  return (
    <AppLayout title="To review">
      <ReviewQueue />
    </AppLayout>
  );
}
