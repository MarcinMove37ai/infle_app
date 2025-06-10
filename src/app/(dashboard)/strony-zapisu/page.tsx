// src/app/strony-zapisu/page.tsx
import { Suspense } from 'react';
import StronyZapisuContent from '@/components/pages/StronyZapisuContent';
import PageLoader from '@/components/ui/PageLoader';

export default function StronyZapisuPage() {
  return (
    <Suspense fallback={<PageLoader pageName="stron zapisu" />}>
      <StronyZapisuContent />
    </Suspense>
  );
}