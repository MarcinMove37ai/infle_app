import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Rozszerzenie typów NextAuth - DODANO pola profili społecznościowych
declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name?: string | null;
    emailVerified?: Date | null;
    profilePicture?: string | null;
    // NOWE POLA
    instagramProfileId?: string | null;
    instagramUsername?: string | null;
    linkedinProfileId?: string | null;
    linkedinUsername?: string | null; // 🆕 DODANE POLE (zawiera linkedinUrl)
    socialProfileType?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      emailVerified?: Date | null;
      profilePicture?: string | null;
      // NOWE POLA
      instagramProfileId?: string | null;
      instagramUsername?: string | null;
      linkedinProfileId?: string | null;
      linkedinUsername?: string | null; // 🆕 DODANE POLE (zawiera linkedinUrl)
      socialProfileType?: string | null;
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    emailVerified?: Date | null;
    profilePicture?: string | null;
    // NOWE POLA
    instagramProfileId?: string | null;
    instagramUsername?: string | null;
    linkedinProfileId?: string | null;
    linkedinUsername?: string | null; // 🆕 DODANE POLE (zawiera linkedinUrl)
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

        // Znajdź usera w bazie - DODANO nowe pola
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
            // NOWE POLA
            instagramProfileId: true,
            linkedinProfileId: true,
            socialProfileType: true,
          }
        });

        if (!user) {
          throw new Error('Błędny email lub hasło');
        }

        // Sprawdź hasło z bcrypt
        const passwordMatch = await bcrypt.compare(credentials.password, user.password);

        if (!passwordMatch) {
          throw new Error('Błędny email lub hasło');
        }

        // Sprawdź czy email jest zweryfikowany PRZED zalogowaniem
        if (!user.emailVerified) {
          throw new Error('Email nie został zweryfikowany');
        }

        // 🆕 POBIERZ INSTAGRAM USERNAME jeśli instagramProfileId istnieje
        let instagramUsername = null;
        if (user.instagramProfileId) {
          const instagramProfile = await prisma.instagramProfileCheck.findUnique({
            where: { id: user.instagramProfileId },
            select: { username: true }
          });
          instagramUsername = instagramProfile?.username || null;
        }

        // 🆕 POBIERZ LINKEDIN URL jeśli linkedinProfileId istnieje
        let linkedinUsername = null;
        if (user.linkedinProfileId) {
          const linkedinProfile = await prisma.linkedInProfileCheck.findUnique({
            where: { id: user.linkedinProfileId },
            select: { linkedinUrl: true }
          });
          // Zapisz pełny URL LinkedIn
          linkedinUsername = linkedinProfile?.linkedinUrl || null;
        }

        // Zwróć użytkownika z wszystkimi polami
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          emailVerified: user.emailVerified,
          profilePicture: user.profilePicture,
          // NOWE POLA
          instagramProfileId: user.instagramProfileId,
          instagramUsername: instagramUsername,
          linkedinProfileId: user.linkedinProfileId,
          linkedinUsername: linkedinUsername, // 🆕 DODANE POLE (linkedinUrl)
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
      // Po pierwszym logowaniu dodaj user data do tokenu
      if (user) {
        token.id = user.id;
        token.emailVerified = user.emailVerified;
        token.profilePicture = user.profilePicture;
        // NOWE POLA
        token.instagramProfileId = user.instagramProfileId;
        token.instagramUsername = user.instagramUsername;
        token.linkedinProfileId = user.linkedinProfileId;
        token.linkedinUsername = user.linkedinUsername; // 🆕 DODANE POLE (linkedinUrl)
        token.socialProfileType = user.socialProfileType;
      }

      // 🆕 TRIGGER UPDATE - gdy wywołujemy update() z klienta
      if (trigger === 'update') {
        console.log('🔄 JWT Callback - Update triggered, refreshing data from database');

        try {
          // Pobierz najnowsze dane z bazy
          const updatedUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              emailVerified: true,
              profilePicture: true,
              instagramProfileId: true,
              linkedinProfileId: true,
              socialProfileType: true,
            }
          });

          if (updatedUser) {
            // 🆕 Pobierz Instagram username
            let instagramUsername = null;
            if (updatedUser.instagramProfileId) {
              const instagramProfile = await prisma.instagramProfileCheck.findUnique({
                where: { id: updatedUser.instagramProfileId },
                select: { username: true }
              });
              instagramUsername = instagramProfile?.username || null;
            }

            // 🆕 Pobierz LinkedIn URL
            let linkedinUsername = null;
            if (updatedUser.linkedinProfileId) {
              const linkedinProfile = await prisma.linkedInProfileCheck.findUnique({
                where: { id: updatedUser.linkedinProfileId },
                select: { linkedinUrl: true }
              });
              // Zapisz pełny URL LinkedIn
              linkedinUsername = linkedinProfile?.linkedinUrl || null;
            }

            // Zaktualizuj token z najnowszymi danymi
            token.emailVerified = updatedUser.emailVerified;
            token.profilePicture = updatedUser.profilePicture;
            token.instagramProfileId = updatedUser.instagramProfileId;
            token.instagramUsername = instagramUsername;
            token.linkedinProfileId = updatedUser.linkedinProfileId;
            token.linkedinUsername = linkedinUsername; // 🆕 DODANE POLE (linkedinUrl)
            token.socialProfileType = updatedUser.socialProfileType;

            console.log('✅ JWT Token updated with fresh data:', {
              instagramProfileId: updatedUser.instagramProfileId,
              instagramUsername: instagramUsername,
              linkedinProfileId: updatedUser.linkedinProfileId,
              linkedinUsername: linkedinUsername // 🆕 DODANY LOG (linkedinUrl)
            });
          }
        } catch (error) {
          console.error('❌ Error updating JWT token with fresh data:', error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Dodaj dane z tokenu do session
      if (token) {
        session.user.id = token.id;
        session.user.emailVerified = token.emailVerified;
        session.user.profilePicture = token.profilePicture;
        // NOWE POLA
        session.user.instagramProfileId = token.instagramProfileId;
        session.user.instagramUsername = token.instagramUsername;
        session.user.linkedinProfileId = token.linkedinProfileId;
        session.user.linkedinUsername = token.linkedinUsername; // 🆕 DODANE POLE (linkedinUrl)
        session.user.socialProfileType = token.socialProfileType;
      }
      return session;
    }
  }
};