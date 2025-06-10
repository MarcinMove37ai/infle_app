'use client';

import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { User, UserRole } from '@/types/types';

export const useAuth = () => {
  const { data: session, status } = useSession();

  // TYMCZASOWY DEBUG - sprawdźmy pełną session
  console.log('🔍 Full session:', session);

  // Mapowanie NextAuth session na nasz format User
  const user: User | null = session?.user ? {
    id: (session.user as any).id || '1',
    email: session.user.email || '',
    first_name: session.user.name?.split(' ')[0] || '',
    last_name: session.user.name?.split(' ').slice(1).join(' ') || '',
    status: 'active', // Domyślnie active, później dodamy do bazy
    cognito_sub: (session.user as any).id || '',
    profilePicture: (session.user as any).profilePicture || null, // DODANE POLE
  } : null;

  // Domyślna rola USER, później dodamy do bazy/session
  const userRole: UserRole = 'USER';

  const signOut = async () => {
    try {
      await nextAuthSignOut({
        callbackUrl: '/login',
        redirect: true
      });
    } catch (error) {
      console.error('Błąd podczas wylogowywania:', error);
    }
  };

  return {
    user,
    userRole,
    signOut,
    isLoading: status === 'loading',
    isAuthenticated: !!session,
  };
};