// src/app/page.tsx/page.tsx
import { Suspense } from 'react';
import RaportOdbiorcowContent from '@/components/pages/LinkedInApp';
import PageLoader from '@/components/ui/PageLoader';

export default function InstagramAppPage() {
  return (
    <Suspense fallback={<PageLoader pageName="LinkedIn App" />}>
      <RaportOdbiorcowContent />
    </Suspense>
  );
}