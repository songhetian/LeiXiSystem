'use client';

import dynamic from 'next/dynamic';

const EmployeeChangeLogsPage = dynamic(
  () => import('@/features/employee/pages/change-logs'),
  { ssr: false }
);

export default function Page() {
  return <EmployeeChangeLogsPage />;
}