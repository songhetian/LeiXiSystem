'use client';

import dynamic from 'next/dynamic';

const NotificationSettingsPage = dynamic(
  () => import('@/features/notification/pages/settings'),
  { ssr: false }
);

export default function Page() {
  return <NotificationSettingsPage />;
}