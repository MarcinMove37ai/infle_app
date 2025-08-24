import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Rozszerzenie typów NextAuth - DODANO pole 'role'
declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name?: string | null;
    emailVerified?: Date | null;
    profilePicture?: string | null;
    role?: string | null; // <-- DODANA ROLA
    // Istniejące pola social media
    instagramProfileId?: string | null;
    instagramUsername?: string | null;
    linkedinProfileId?: string | null;
    linkedinUsername?: string | null;
    socialProfileType?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      emailVerified?: Date | null;
      profilePicture?: string | null;
      role?: string | null; // <-- DODANA ROLA
      // Istniejące pola social media
      instagramProfileId?: string | null;
      instagramUsername?: string | null;
      linkedinProfileId?: string | null;
      linkedinUsername?: string | null;
      socialProfileType?: string | null;
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    emailVerified?: Date | null;
    profilePicture?: string | null;
    role?: string | null; // <-- DODANA ROLA
    // Istniejące pola social media
    instagramProfileId?: string | null;
    instagramUsername?: string | null;
    linkedinProfileId?: string | null;
    linkedinUsername?: string | null;
    socialProfileType?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Brak emaila lub hasła');
        }

        // Znajdź usera w bazie - DODANO pole 'role'
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            password: true,
            emailVerified: true,
            profilePicture: true,
            role: true, // <-- POBIERZ ROLĘ
            // Istniejące pola social media
            instagramProfileId: true,
            linkedinProfileId: true,
            socialProfileType: true,
          }
        });

        if (!user) {
          throw new Error('Błędny email lub hasło');
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);

        if (!passwordMatch) {
          throw new Error('Błędny email lub hasło');
        }

        if (!user.emailVerified) {
          throw new Error('Email nie został zweryfikowany');
        }

        let instagramUsername = null;
        if (user.instagramProfileId) {
          const instagramProfile = await prisma.instagramProfileCheck.findUnique({
            where: { id: user.instagramProfileId },
            select: { username: true }
          });
          instagramUsername = instagramProfile?.username || null;
        }

        let linkedinUsername = null;
        if (user.linkedinProfileId) {
          const linkedinProfile = await prisma.linkedInProfileCheck.findUnique({
            where: { id: user.linkedinProfileId },
            select: { linkedinUrl: true }
          });
          linkedinUsername = linkedinProfile?.linkedinUrl || null;
        }

        // Zwróć użytkownika z wszystkimi polami, w tym z rolą
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          emailVerified: user.emailVerified,
          profilePicture: user.profilePicture,
          role: user.role, // <-- ZWRÓĆ ROLĘ
          // Istniejące pola social media
          instagramProfileId: user.instagramProfileId,
          instagramUsername: instagramUsername,
          linkedinProfileId: user.linkedinProfileId,
          linkedinUsername: linkedinUsername,
          socialProfileType: user.socialProfileType,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.emailVerified = user.emailVerified;
        token.profilePicture = user.profilePicture;
        token.role = user.role; // <-- DODAJ ROLĘ DO TOKENU
        // Istniejące pola social media
        token.instagramProfileId = user.instagramProfileId;
        token.instagramUsername = user.instagramUsername;
        token.linkedinProfileId = user.linkedinProfileId;
        token.linkedinUsername = user.linkedinUsername;
        token.socialProfileType = user.socialProfileType;
      }

      if (trigger === 'update') {
        console.log('🔄 JWT Callback - Update triggered, refreshing data from database');

        try {
          const updatedUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              emailVerified: true,
              profilePicture: true,
              role: true, // <-- POBIERZ ZAKTUALIZOWANĄ ROLĘ
              instagramProfileId: true,
              linkedinProfileId: true,
              socialProfileType: true,
            }
          });

          if (updatedUser) {
            let instagramUsername = null;
            if (updatedUser.instagramProfileId) {
              const instagramProfile = await prisma.instagramProfileCheck.findUnique({
                where: { id: updatedUser.instagramProfileId },
                select: { username: true }
              });
              instagramUsername = instagramProfile?.username || null;
            }

            let linkedinUsername = null;
            if (updatedUser.linkedinProfileId) {
              const linkedinProfile = await prisma.linkedInProfileCheck.findUnique({
                where: { id: updatedUser.linkedinProfileId },
                select: { linkedinUrl: true }
              });
              linkedinUsername = linkedinProfile?.linkedinUrl || null;
            }

            // Zaktualizuj token z najnowszymi danymi
            token.emailVerified = updatedUser.emailVerified;
            token.profilePicture = updatedUser.profilePicture;
            token.role = updatedUser.role; // <-- ZAKTUALIZUJ ROLĘ
            token.instagramProfileId = updatedUser.instagramProfileId;
            token.instagramUsername = instagramUsername;
            token.linkedinProfileId = updatedUser.linkedinProfileId;
            token.linkedinUsername = linkedinUsername;
            token.socialProfileType = updatedUser.socialProfileType;

            console.log('✅ JWT Token updated with fresh data:', {
              role: updatedUser.role,
              instagramProfileId: updatedUser.instagramProfileId,
              instagramUsername: instagramUsername,
              linkedinProfileId: updatedUser.linkedinProfileId,
              linkedinUsername: linkedinUsername
            });
          }
        } catch (error) {
          console.error('❌ Error updating JWT token with fresh data:', error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.emailVerified = token.emailVerified;
        session.user.profilePicture = token.profilePicture;
        session.user.role = token.role; // <-- DODAJ ROLĘ DO SESJI
        // Istniejące pola social media
        session.user.instagramProfileId = token.instagramProfileId;
        session.user.instagramUsername = token.instagramUsername;
        session.user.linkedinProfileId = token.linkedinProfileId;
        session.user.linkedinUsername = token.linkedinUsername;
        session.user.socialProfileType = token.socialProfileType;
      }
      return session;
    }
  }
};