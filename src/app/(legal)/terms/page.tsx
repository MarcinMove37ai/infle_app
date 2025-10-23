// src/app/(legal)/terms/page.tsx
import { Suspense } from 'react';
import TermsClient from './TermsClient';

// Informuje Next.js, aby nie budował tej strony statycznie
export const dynamic = 'force-dynamic';

export default function TermsPage() {
  return (
    <Suspense fallback={
      <div className="lg:col-span-12 w-full text-center py-24 text-slate-400">
        Wczytywanie...
      </div>
    }>
      <TermsClient />
    </Suspense>
  );
}