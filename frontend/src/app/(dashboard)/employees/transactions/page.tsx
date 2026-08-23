'use client';

import dynamic from 'next/dynamic';

const TransactionsPage = dynamic(
  () => import('@/features/employee/pages/transactions'),
  { ssr: false }
);

export default function Page() {
  return <TransactionsPage />;
}
