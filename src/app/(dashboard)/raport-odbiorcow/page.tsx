// src/app/raport-odbiorcow/page.tsx
import { Suspense } from 'react';
import RaportOdbiorcowContent from '@/components/pages/RaportOdbiorcowContent';
import PageLoader from '@/components/ui/PageLoader';

export default function RaportOdbiorcowPage() {
  return (
    <Suspense fallback={<PageLoader pageName="raportu odbiorców" />}>
      <RaportOdbiorcowContent />
    </Suspense>
  );
}