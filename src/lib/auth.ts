import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

// Rozszerzenie typów NextAuth
declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name?: string | null;
    emailVerified?: Date | null;
    profilePicture?: string | null;
    role?: string | null;
    instagramProfileId?: string | null;
    instagramUsername?: string | null;
    linkedinProfileId?: string | null;
    linkedinUsername?: string | null;
    socialProfileType?: string | null;
    authProvider?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      emailVerified?: Date | null;
      profilePicture?: string | null;
      role?: string | null;
      instagramProfileId?: string | null;
      instagramUsername?: string | null;
      linkedinProfileId?: string | null;
      linkedinUsername?: string | null;
      socialProfileType?: string | null;
      authProvider?: string | null;
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    emailVerified?: Date | null;
    profilePicture?: string | null;
    role?: string | null;
    instagramProfileId?: string | null;
    instagramUsername?: string | null;
    linkedinProfileId?: string | null;
    linkedinUsername?: string | null;
    socialProfileType?: string | null;
    authProvider?: string | null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Cookie domain scope dla NextAuth.
//
// W produkcji ustawiamy domain = 'app.inflee.app' żeby session cookie
// NIE wyciekało na custom domeny klientów (np. lp.legalgpt.pl).
// Bez tego:
//   - User loguje się na app.inflee.app → dostaje cookie
//   - Otwiera landing klienta na lp.legalgpt.pl → cookie może polecieć
//   - Klient (lub XSS na jego content'cie) ma dostęp do sesji admina
//
// Z domain scope:
//   - Cookie jest valid TYLKO dla app.inflee.app (i subdomen)
//   - Custom domeny klientów dostają requesty bez cookie → traktowane jako anon
//
// W dev (localhost) zostawiamy default — bo localhost nie ma domeny,
// próba ustawienia domain = 'app.inflee.app' zepsułaby login.
// ─────────────────────────────────────────────────────────────────────
const APP_HOST = process.env.APP_HOST || 'app.inflee.app';
const isProduction = process.env.NODE_ENV === 'production';
const cookieDomain = isProduction ? APP_HOST : undefined;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: isProduction ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        domain: cookieDomain,
      },
    },
    callbackUrl: {
      name: isProduction ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
      options: {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        domain: cookieDomain,
      },
    },
    csrfToken: {
      // CSRF token NIE używa __Host- prefix bo wymaga domain unset (a my chcemy domain w prod)
      name: isProduction ? '__Secure-next-auth.csrf-token' : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
        domain: cookieDomain,
      },
    },
  },
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
            role: true,
            authProvider: true,
            instagramProfileId: true,
            linkedinProfileId: true,
            socialProfileType: true,
          }
        });

        if (!user) {
          throw new Error('Błędny email lub hasło');
        }

        // Blokuj credentials login dla Google-only users
        if (!user.password) {
          throw new Error('To konto używa logowania Google. Użyj przycisku Google.');
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

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          emailVerified: user.emailVerified,
          profilePicture: user.profilePicture,
          role: user.role,
          authProvider: user.authProvider,
          instagramProfileId: user.instagramProfileId,
          instagramUsername: instagramUsername,
          linkedinProfileId: user.linkedinProfileId,
          linkedinUsername: linkedinUsername,
          socialProfileType: user.socialProfileType,
        };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // ───────────────────────────────────────────────
    // signIn — obsługa Google OAuth (auto-rejestracja / łączenie kont)
    // ───────────────────────────────────────────────
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          const email = user.email!.toLowerCase();
          const googleId = account.providerAccountId;

          // 1. Szukaj po googleId (najszybsza ścieżka — user już się logował Google)
          let dbUser = await prisma.user.findUnique({
            where: { googleId },
          });

          if (dbUser) {
            return true;
          }

          // 2. Szukaj po email (łączenie kont lub auto-rejestracja)
          dbUser = await prisma.user.findUnique({
            where: { email },
          });

          if (dbUser) {
            // Istniejący user credentials → łącz konta
            await prisma.user.update({
              where: { email },
              data: {
                googleId,
                authProvider: dbUser.authProvider === 'credentials' ? 'both' : dbUser.authProvider,
                emailVerified: dbUser.emailVerified || new Date(),
                profilePicture: dbUser.profilePicture || user.image || null,
              },
            });
            return true;
          }

          // 3. Nowy user → rejestracja TYLKO z ważnym kodem (invite-only).
          // Kod przyjechał z frontu w cookie 'invite_code' (przeżywa redirect OAuth).
          const cookieStore = await cookies();
          const inviteCode = cookieStore.get('invite_code')?.value || null;

          // Flaga inviteOnly (singleton). Brak rekordu → traktujemy jak true.
          const appSetting = await prisma.appSetting.findUnique({ where: { id: 'app' } });
          const inviteOnly = appSetting?.inviteOnly ?? true;

          // Walidacja kodu (istnieje, issued, niezużyty).
          let validInvite: { id: string; applicationId: string | null } | null = null;
          if (inviteCode) {
            const invite = await prisma.inviteCode.findUnique({
              where: { code: inviteCode },
              select: { id: true, status: true, usedByUserId: true, applicationId: true },
            });
            if (invite && invite.status === 'issued' && invite.usedByUserId === null) {
              validInvite = { id: invite.id, applicationId: invite.applicationId };
            }
          }

          // Bez ważnego kodu (gdy invite-only) → ODRZUCAMY i kierujemy na Apply.
          // Zwrócenie URL-a z callbacku signIn = NextAuth zrobi redirect tam.
          if (inviteOnly && !validInvite) {
            return '/register?denied=google';
          }

          // Tworzymy usera + konsumujemy kod atomowo.
          const nameParts = (user.name || '').split(' ');
          const firstName = nameParts[0] || 'User';
          const lastName = nameParts.slice(1).join(' ') || '';

          await prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
              data: {
                email,
                firstName,
                lastName,
                password: null,
                googleId,
                authProvider: 'google',
                emailVerified: new Date(),
                profilePicture: user.image || null,
                role: 'free',
              },
            });

            if (validInvite) {
              const consumed = await tx.inviteCode.updateMany({
                where: { id: validInvite.id, status: 'issued', usedByUserId: null },
                data: { status: 'used', usedByUserId: created.id, usedAt: new Date() },
              });
              if (consumed.count === 0) throw new Error('INVITE_CONSUMED_RACE');
              if (validInvite.applicationId) {
                await tx.application.update({
                  where: { id: validInvite.applicationId },
                  data: { status: 'invited' },
                });
              }
            }
          });

          // Sprzątamy cookie po konsumpcji (jednorazowe).
          cookieStore.delete('invite_code');

          return true;
        } catch (error) {
          console.error('❌ Google signIn callback error:', error);
          return false;
        }
      }

      // Credentials provider → przepuść normalnie
      return true;
    },

    // ───────────────────────────────────────────────
    // jwt — budowanie tokenu z danych z bazy (jeden punkt prawdy)
    // ───────────────────────────────────────────────
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        // Pobierz dane z bazy — działa identycznie dla Google i Credentials
        const email = user.email?.toLowerCase() || token.email?.toLowerCase();
        if (email) {
          const dbUser = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              emailVerified: true,
              profilePicture: true,
              role: true,
              authProvider: true,
              instagramProfileId: true,
              linkedinProfileId: true,
              socialProfileType: true,
            },
          });

          if (dbUser) {
            token.id = dbUser.id;
            token.emailVerified = dbUser.emailVerified;
            token.profilePicture = dbUser.profilePicture;
            token.role = dbUser.role;
            token.authProvider = dbUser.authProvider;
            token.instagramProfileId = dbUser.instagramProfileId;
            token.linkedinProfileId = dbUser.linkedinProfileId;
            token.socialProfileType = dbUser.socialProfileType;

            if (dbUser.instagramProfileId) {
              const igProfile = await prisma.instagramProfileCheck.findUnique({
                where: { id: dbUser.instagramProfileId },
                select: { username: true },
              });
              token.instagramUsername = igProfile?.username || null;
            }
            if (dbUser.linkedinProfileId) {
              const liProfile = await prisma.linkedInProfileCheck.findUnique({
                where: { id: dbUser.linkedinProfileId },
                select: { linkedinUrl: true },
              });
              token.linkedinUsername = liProfile?.linkedinUrl || null;
            }
          }
        }
      }

      // Obsługa session update (np. po zmianie profilu w ustawieniach)
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
              role: true,
              authProvider: true,
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

            token.emailVerified = updatedUser.emailVerified;
            token.profilePicture = updatedUser.profilePicture;
            token.role = updatedUser.role;
            token.authProvider = updatedUser.authProvider;
            token.instagramProfileId = updatedUser.instagramProfileId;
            token.instagramUsername = instagramUsername;
            token.linkedinProfileId = updatedUser.linkedinProfileId;
            token.linkedinUsername = linkedinUsername;
            token.socialProfileType = updatedUser.socialProfileType;

            console.log('✅ JWT Token updated with fresh data:', {
              role: updatedUser.role,
              authProvider: updatedUser.authProvider,
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

    // ───────────────────────────────────────────────
    // session — mapowanie tokenu na sesję (bez zmian w logice)
    // ───────────────────────────────────────────────
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.emailVerified = token.emailVerified;
        session.user.profilePicture = token.profilePicture;
        session.user.role = token.role;
        session.user.authProvider = token.authProvider;
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