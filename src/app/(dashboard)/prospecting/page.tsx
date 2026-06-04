// src/app/(dashboard)/prospecting/page.tsx
import { Suspense } from 'react';
import ProspectingContent from '@/components/pages/ProspectingContent';
import PageLoader from '@/components/ui/PageLoader';

export default function ProspectingPage() {
  return (
    <Suspense fallback={<PageLoader pageName="users" />}>
      <ProspectingContent />
    </Suspense>
  );
}