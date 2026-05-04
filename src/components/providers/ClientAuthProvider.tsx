'use client';

import { SessionProvider } from 'next-auth/react';
import { useEffect, useState } from 'react';

const APP_HOST = 'app.inflee.app';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function isAppHost(hostname: string): boolean {
  return hostname === APP_HOST || LOCAL_HOSTS.has(hostname);
}

export function ClientAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Wykrywamy host SYNCHRONICZNIE przy pierwszym renderze klienta.
  // typeof window guard zapobiega błędom na SSR (gdzie window nie istnieje).
  // Na SSR -> isOnAppHost=true (default, SessionProvider aktywny).
  // Na kliencie pierwszy render już ma poprawne isOnAppHost.
  //
  // Dlaczego nie useEffect: useEffect odpala się PO pierwszym renderze.
  // SessionProvider w pierwszym renderze już strzela fetch /api/auth/session,
  // zanim useEffect zdąży go ukryć. Synchronous check w useState initializer
  // rozwiązuje ten problem — SessionProvider od pierwszego renderu wie
  // że nie powinien się odpalać na landing host.
  const [isOnAppHost] = useState(() => {
    if (typeof window === 'undefined') return true; // SSR: default app host
    return isAppHost(window.location.hostname);
  });

  if (!isOnAppHost) {
    return <>{children}</>;
  }

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}