import { AppLayout } from '@/components/layout';
import { SettingsContent } from '@/components/settings/SettingsContent';

export const metadata = {
  title: 'Settings | Hadley Finance Tracker',
};

export default function SettingsPage() {
  return (
    <AppLayout title="Settings">
      <SettingsContent />
    </AppLayout>
  );
}
