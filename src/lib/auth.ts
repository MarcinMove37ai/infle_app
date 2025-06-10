import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// Rozszerzenie typów NextAuth - DODANO profilePicture
declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name?: string | null;
    emailVerified?: Date | null;
    profilePicture?: string | null; // DODANE POLE
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      emailVerified?: Date | null;
      profilePicture?: string | null; // DODANE POLE
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    emailVerified?: Date | null;
    profilePicture?: string | null; // DODANE POLE
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

        // Znajdź usera w bazie - DODANO SELECT profilePicture
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            password: true,
            emailVerified: true,
            profilePicture: true, // DODANE POLE
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

        // Zwróć użytkownika z profilePicture
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          emailVerified: user.emailVerified,
          profilePicture: user.profilePicture, // DODANE POLE
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
        token.profilePicture = user.profilePicture; // DODANE POLE
      }
      return token;
    },
    async session({ session, token }) {
      // Dodaj dane z tokenu do session
      if (token) {
        session.user.id = token.id;
        session.user.emailVerified = token.emailVerified;
        session.user.profilePicture = token.profilePicture; // DODANE POLE
      }
      return session;
    }
  }
};