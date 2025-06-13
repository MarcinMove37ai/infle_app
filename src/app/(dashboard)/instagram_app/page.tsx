// src/app/instagram_app/page.tsx
import { Suspense } from 'react';
import RaportOdbiorcowContent from '@/components/pages/InstagramApp';
import PageLoader from '@/components/ui/PageLoader';

export default function InstagramAppPage() {
  return (
    <Suspense fallback={<PageLoader pageName="Instagram App" />}>
      <RaportOdbiorcowContent />
    </Suspense>
  );
}