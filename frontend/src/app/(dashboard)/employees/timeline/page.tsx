'use client';

import dynamic from 'next/dynamic';

const TimelinePage = dynamic(
  () => import('@/features/employee/pages/timeline'),
  { ssr: false }
);

export default function Page() {
  return <TimelinePage />;
}