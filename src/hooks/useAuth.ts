'use client';

import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { User, UserRole } from '@/types/types';

export const useAuth = () => {
  const { data: session, status, update } = useSession(); // 🆕 DODANO `update`

  // TYMCZASOWY DEBUG - sprawdźmy pełną session
  console.log('🔍 Full session:', session);

  // Mapowanie NextAuth session na nasz format User
  const user: User | null = session?.user ? {
    id: (session.user as any).id || '1',
    email: session.user.email || '',
    first_name: session.user.name?.split(' ')[0] || '',
    last_name: session.user.name?.split(' ').slice(1).join(' ') || '',
    status: 'active',
    cognito_sub: (session.user as any).id || '',
    profilePicture: (session.user as any).profilePicture || null,
    // 🆕 DODANE pola IG
    instagramProfileId: (session.user as any).instagramProfileId || null,
    instagramUsername: (session.user as any).instagramUsername || null,
    linkedinProfileId: (session.user as any).linkedinProfileId || null,
    socialProfileType: (session.user as any).socialProfileType || null,
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

  // 🆕 NOWA FUNKCJA - Odświeżenie sesji po przypisaniu profilu
  const refreshSession = async () => {
    try {
      console.log('🔄 Refreshing session...');

      // Użyj update() z next-auth/react
      await update();

      console.log('✅ Session refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing session:', error);
      throw error; // Rzuć błąd dalej, żeby komponent mógł go obsłużyć
    }
  };

  // 🆕 NOWA FUNKCJA - Wymuszenie pełnego refresh'a z backendu
  const forceRefreshUserData = async () => {
    try {
      console.log('🔄 Force refreshing user data from database...');

      // Wywołaj endpoint do refresh'a danych użytkownika
      const response = await fetch('/api/auth/refresh-user-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Po sukcesie, odśwież sesję NextAuth
        await update();
        console.log('✅ User data force refreshed successfully');
      } else {
        throw new Error('Failed to refresh user data');
      }
    } catch (error) {
      console.error('❌ Error force refreshing user data:', error);
      throw error;
    }
  };

  return {
    user,
    userRole,
    signOut,
    refreshSession, // 🆕 Nowa funkcja
    forceRefreshUserData, // 🆕 Nowa funkcja
    isLoading: status === 'loading',
    isAuthenticated: !!session,
  };
};