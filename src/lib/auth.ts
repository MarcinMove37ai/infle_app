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
    linkedinProfileId?: string | null;
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
      linkedinProfileId?: string | null;
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
    linkedinProfileId?: string | null;
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

        // Zwróć użytkownika z wszystkimi polami
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          emailVerified: user.emailVerified,
          profilePicture: user.profilePicture,
          // NOWE POLA
          instagramProfileId: user.instagramProfileId,
          linkedinProfileId: user.linkedinProfileId,
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
    async jwt({ token, user }) {
      // Po pierwszym logowaniu dodaj user data do tokenu
      if (user) {
        token.id = user.id;
        token.emailVerified = user.emailVerified;
        token.profilePicture = user.profilePicture;
        // NOWE POLA
        token.instagramProfileId = user.instagramProfileId;
        token.linkedinProfileId = user.linkedinProfileId;
        token.socialProfileType = user.socialProfileType;
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
        session.user.linkedinProfileId = token.linkedinProfileId;
        session.user.socialProfileType = token.socialProfileType;
      }
      return session;
    }
  }
};