// src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import RedirectLoader from '@/components/ui/RedirectLoader';

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    // Czekaj aż status sesji będzie znany
    if (status === 'loading') return;

    const timer = setTimeout(() => {
      // Jeśli zalogowany - idź do dashboard
      if (session) {
        router.push('/dashboard');
      } else {
        // Jeśli niezalogowany - idź do login
        router.push('/login');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [router, session, status]);

  return (
    <RedirectLoader 
      message="Ładowanie serwisu inflee.app"
    />
  );
}