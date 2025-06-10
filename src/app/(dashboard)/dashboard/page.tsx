// src/app/dashboard/page.tsx
import { Suspense } from 'react';
import DashboardContent from '@/components/pages/DashboardContent';
import PageLoader from '@/components/ui/PageLoader';

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageLoader pageName="dashboardu" />}>
      <DashboardContent />
    </Suspense>
  );
}
