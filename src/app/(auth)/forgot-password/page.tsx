// src/app/(auth)/forgot-password/page.tsx
import { Suspense } from 'react';
import ForgotPasswordClient from './ForgotPasswordClient';

// Wymagane dla odczytu searchParams
export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <ForgotPasswordClient />
    </Suspense>
  );
}