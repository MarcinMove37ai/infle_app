// src/app/statystyki/page.tsx (przykład)
import { Suspense } from 'react';
import StatystykiContent from '@/components/pages/StatystykiContent';
import PageLoader from '@/components/ui/PageLoader';

export default function StatystykiPage() {
  return (
    <Suspense fallback={<PageLoader pageName="statystyk" />}>
      <StatystykiContent />
    </Suspense>
  );
}