// src/app/raport-tworcy/page.tsx
import { Suspense } from 'react';
import RaportTworcyContent from '@/components/pages/RaportTworcyContent';
import PageLoader from '@/components/ui/PageLoader';

export default function RaportTworcyPage() {
  return (
    <Suspense fallback={<PageLoader pageName="raportu twórcy" />}>
      <RaportTworcyContent />
    </Suspense>
  );
}