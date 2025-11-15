// src/app/leady/page.tsx
import { Suspense } from 'react';
import LeadsContent from '@/components/pages/LeadsContent';
import PageLoader from '@/components/ui/PageLoader';

export default function LeadyPage() {
  return (
    <Suspense fallback={<PageLoader pageName="leadów" />}>
      <LeadsContent />
    </Suspense>
  );
}