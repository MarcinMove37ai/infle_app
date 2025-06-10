// src/app/ebooki/page.tsx
import { Suspense } from 'react';
import EbookiContent from '@/components/pages/EbookiContent';
import PageLoader from '@/components/ui/PageLoader';

export default function EbookiPage() {
  return (
    <Suspense fallback={<PageLoader pageName="ebooków" />}>
      <EbookiContent />
    </Suspense>
  );
}