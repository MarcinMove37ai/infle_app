// src/app/(legal)/privacy/page.tsx
import { Suspense } from 'react';
import PrivacyClient from './PrivacyClient';

// Informuje Next.js, aby nie budował tej strony statycznie
export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  return (
    <Suspense fallback={
      // Prosty fallback, możesz go dostosować
      <div className="lg:col-span-12 w-full text-center py-24 text-slate-400">
        Wczytywanie...
      </div>
    }>
      <PrivacyClient />
    </Suspense>
  );
}