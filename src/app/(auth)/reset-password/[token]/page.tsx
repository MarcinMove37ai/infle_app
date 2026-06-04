// src/app/(auth)/reset-password/[token]/page.tsx
import { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';

// Wymagane dla odczytu searchParams (lang)
export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-full bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    }>
      <ResetPasswordClient />
    </Suspense>
  );
}