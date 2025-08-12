// src/app/(dashboard)/ustawienia/page.tsx
import { Suspense } from 'react';
import UstawieniaContent from '@/components/pages/UstawieniaContent';
import PageLoader from '@/components/ui/PageLoader';

export default function UstawieniaPage() {
  return (
    <Suspense fallback={<PageLoader pageName="ustawień" />}>
      <UstawieniaContent />
    </Suspense>
  );
}