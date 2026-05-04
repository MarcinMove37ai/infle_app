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
  // SSR + pierwszy render po hydration: SessionProvider JEST aktywny.
  // Powód: useSession() w komponentach dzieci wybucha jeśli SessionProvider
  // nie istnieje przy pierwszym renderze.
  // Po useEffect (po hydration) sprawdzamy hostname — jeśli landing host
  // (nie app.inflee.app, nie localhost), unmountujemy SessionProvider.
  const [hostChecked, setHostChecked] = useState(false);
  const [isOnAppHost, setIsOnAppHost] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    setIsOnAppHost(isAppHost(hostname));
    setHostChecked(true);
  }, []);

  if (hostChecked && !isOnAppHost) {
    return <>{children}</>;
  }

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}