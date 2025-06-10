// src/app/trendy/page.tsx
import { Suspense } from 'react';
import TrendyContent from '@/components/pages/TrendyContent';
import PageLoader from '@/components/ui/PageLoader';

export default function TrendyPage() {
  return (
    <Suspense fallback={<PageLoader pageName="trendów" />}>
      <TrendyContent />
    </Suspense>
  );
}