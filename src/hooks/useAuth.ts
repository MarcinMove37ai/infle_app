// src/hooks/useAuth.ts
'use client';

import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { User, UserRole } from '@/types/types';

// Rozszerzony typ użytkownika (bez zmian)
interface ExtendedUser extends User {
  linkedinProfileId?: string | null;
  linkedinUsername?: string | null;
  socialProfileType?: string | null;
}

export const useAuth = () => {
  const { data: session, status, update } = useSession();

  // Mapowanie sesji NextAuth na nasz format User (bez zmian)
  const user: ExtendedUser | null = session?.user ? {
    id: (session.user as any).id || '',
    email: session.user.email || '',
    first_name: session.user.name?.split(' ')[0] || '',
    last_name: session.user.name?.split(' ').slice(1).join(' ') || '',
    status: 'active',
    cognito_sub: (session.user as any).id || '',
    profilePicture: (session.user as any).profilePicture || null,
    instagramProfileId: (session.user as any).instagramProfileId || null,
    instagramUsername: (session.user as any).instagramUsername || null,
    linkedinProfileId: (session.user as any).linkedinProfileId || null,
    linkedinUsername: (session.user as any).linkedinUsername || null,
    socialProfileType: (session.user as any).socialProfileType || null,
  } : null;

  // Pobierz rolę dynamicznie z sesji, z domyślną wartością 'USER'
  const userRole: UserRole = (session?.user as any)?.role || 'USER';

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

  const refreshSession = async () => {
    try {
      console.log('🔄 Refreshing session...');
      await update();
      console.log('✅ Session refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing session:', error);
      throw error;
    }
  };

  const forceRefreshUserData = async () => {
    try {
      console.log('🔄 Force refreshing user data from database...');
      const response = await fetch('/api/auth/refresh-user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        await update();
        console.log('✅ User data force refreshed successfully');
      } else {
        throw new Error('Failed to refresh user data');
      }
    } catch (error)
    {
      console.error('❌ Error force refreshing user data:', error);
      throw error;
    }
  };

  return {
    user,
    userRole, // Zwracana jest teraz rola z sesji
    signOut,
    refreshSession,
    forceRefreshUserData,
    isLoading: status === 'loading',
    isAuthenticated: !!session,
  };
};