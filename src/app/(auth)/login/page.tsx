// src/app/(auth)/login/page.tsx
import { Suspense } from 'react';
import LoginForm from './LoginForm'; // Import komponentu, który właśnie przenieśliśmy

// Upewniamy się, że ta strona jest zawsze renderowana dynamicznie
export const dynamic = 'force-dynamic';

// Prosty komponent ładowania, który będzie wyświetlany
// podczas gdy komponent klienta (z hookiem) się ładuje.
function LoadingFallback() {
  return (
    <div
      className="h-screen bg-[#0A0A0A] text-white flex items-center justify-center"
      style={{ fontFamily: '"Segoe UI", Roboto, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginForm />
    </Suspense>
  );
}