// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import crypto from 'crypto';
import { getProfileType } from '@/lib/profileStorage';
import { SocialProfileType } from '@prisma/client'; // NOWY IMPORT - enum

// Funkcja do lazy initialization Resend
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_dummy_key_for_build_only') {
    throw new Error('RESEND_API_KEY is not properly configured');
  }
  return new Resend(apiKey);
}

// Szablon maila weryfikacyjnego — dwujęzyczny (EN/PL), bliźniaczy do maila resetu hasła.
// Ciemny header z logo-gradientem, białe ciało, bez emoji, jeden box informacyjny.
function buildVerificationEmail(opts: { firstName: string; verifyUrl: string; pl: boolean }) {
  const { firstName, verifyUrl, pl } = opts;

  const t = pl
    ? {
        subject: 'Potwierdź swój email - inflee.app',
        tagline: 'Edukuj · Rośnij · Zarabiaj',
        heading: 'Potwierdź swój adres email',
        hi: `Cześć ${firstName},`,
        intro: 'Dziękujemy za rejestrację w inflee.app. Aby aktywować konto i zacząć korzystać z platformy, potwierdź swój adres email klikając przycisk poniżej.',
        button: 'Potwierdź email',
        notice: 'Link jest ważny przez 24 godziny. Po weryfikacji będziesz mógł się zalogować. Jeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość.',
        trouble: 'Problem z przyciskiem? Wklej ten link do przeglądarki:',
        footer: '© 2026 inflee.app · Masz pytania?',
      }
    : {
        subject: 'Confirm your email - inflee.app',
        tagline: 'Educate · Grow · Earn',
        heading: 'Confirm your email address',
        hi: `Hi ${firstName},`,
        intro: 'Thanks for signing up for inflee.app. To activate your account and start using the platform, please confirm your email address by clicking the button below.',
        button: 'Confirm email',
        notice: 'This link is valid for 24 hours. Once verified, you will be able to log in. If you did not create an account, you can safely ignore this email.',
        trouble: 'Trouble with the button? Paste this link into your browser:',
        footer: '© 2026 inflee.app · Questions?',
      };

  const html = `<!DOCTYPE html>
<html lang="${pl ? 'pl' : 'en'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f3f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif; color:#1a1a1f;">
  <div style="padding:24px 12px;">
    <div style="max-width:520px; margin:0 auto; background-color:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e8e8ec;">

      <div style="background-color:#0A0A0A; padding:28px 32px; text-align:center;">
        <span style="font-size:22px; font-weight:700; background:linear-gradient(135deg,#A855F7,#6366F1); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:#A855F7;">inflee.app</span>
        <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#8a8a93; margin-top:4px;">${t.tagline}</div>
      </div>

      <div style="padding:32px;">
        <h1 style="margin:0 0 16px; font-size:20px; font-weight:600; color:#1a1a1f;">${t.heading}</h1>

        <p style="margin:0 0 14px; font-size:15px; line-height:1.65; color:#4a4a55;">${t.hi}</p>
        <p style="margin:0 0 24px; font-size:15px; line-height:1.65; color:#4a4a55;">${t.intro}</p>

        <div style="text-align:center; margin:28px 0;">
          <a href="${verifyUrl}" style="display:inline-block; background:linear-gradient(135deg,#9333ea,#4f46e5); color:#ffffff; text-decoration:none; padding:13px 36px; border-radius:10px; font-size:15px; font-weight:600;">${t.button}</a>
        </div>

        <div style="background-color:#f7f7fa; border-radius:10px; padding:14px 16px; margin:24px 0;">
          <p style="margin:0; font-size:13px; line-height:1.6; color:#6a6a76;">${t.notice}</p>
        </div>

        <p style="margin:24px 0 6px; font-size:12px; color:#9a9aa5;">${t.trouble}</p>
        <p style="margin:0; font-size:11px; color:#9a9aa5; word-break:break-all; font-family:'SF Mono',Monaco,'Cascadia Code',monospace;">${verifyUrl}</p>
      </div>

      <div style="padding:20px 32px; background-color:#fafafb; border-top:1px solid #eeeef2; text-align:center;">
        <p style="margin:0; font-size:12px; color:#9a9aa5;">${t.footer} <a href="mailto:support@inflee.app" style="color:#6366F1; text-decoration:none;">support@inflee.app</a></p>
      </div>

    </div>
  </div>
</body>
</html>`;

  return { subject: t.subject, html };
}

export async function POST(request: Request) {
  // DEBUG - sprawdź zmienne środowiskowe w API route
  console.log('=== API ROUTE ENVIRONMENT CHECK ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  console.log('DATABASE_URL preview:', process.env.DATABASE_URL?.substring(0, 30) + '...');
  console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
  console.log('NEXTAUTH_SECRET exists:', !!process.env.NEXTAUTH_SECRET);
  console.log('All DATABASE env keys:', Object.keys(process.env).filter(key =>
    key.toUpperCase().includes('DATABASE') || key.toUpperCase().includes('DB') || key.toUpperCase().includes('POSTGRES')
  ));
  console.log('=== END DEBUG ===');

  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, socialLink, password, profilePicture, checkedProfileId, inviteCode, lang } = body;
    const pl = lang === 'pl';

    console.log('📝 Registration request received:', {
      firstName,
      lastName,
      email,
      phone: phone ? 'provided' : 'not provided',
      socialLink: socialLink ? 'provided' : 'not provided',
      profilePicture: profilePicture ? 'provided' : 'not provided',
      checkedProfileId: checkedProfileId || 'not provided'
    });

    // Walidacja podstawowa
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'Imię, nazwisko, email i hasło są wymagane' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Hasło musi mieć minimum 6 znaków' },
        { status: 400 }
      );
    }

    // Sprawdź czy użytkownik już istnieje
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Użytkownik z tym emailem już istnieje' },
        { status: 400 }
      );
    }

    // ── Bramka invite-only (flaga sterowana z panelu GOD) ──────────────────────
    // Czytamy singleton ustawień. Brak rekordu → traktujemy jak inviteOnly:true
    // (domyślnie zamknięte = bezpiecznie). Gdy włączone, wymagamy PRAWIDŁOWEGO kodu.
    const appSetting = await prisma.appSetting.findUnique({ where: { id: 'app' } });
    const inviteOnly = appSetting?.inviteOnly ?? true;

    // Walidujemy kod zawsze, gdy został podany — żeby móc go skonsumować i powiązać
    // seedy nawet, gdyby invite-only było chwilowo wyłączone.
    let validInvite: { id: string; applicationId: string | null } | null = null;
    if (inviteCode) {
      const invite = await prisma.inviteCode.findUnique({
        where: { code: inviteCode },
        select: { id: true, status: true, usedByUserId: true, applicationId: true },
      });
      const isUsable =
        invite && invite.status === 'issued' && invite.usedByUserId === null;
      if (isUsable) {
        validInvite = { id: invite!.id, applicationId: invite!.applicationId };
      }
    }

    // Twarda blokada: gdy invite-only włączone, bez ważnego kodu nie ma rejestracji.
    if (inviteOnly && !validInvite) {
      return NextResponse.json(
        { error: 'Rejestracja wymaga ważnego kodu zaproszenia.' },
        { status: 403 }
      );
    }

    // NOWA LOGIKA - Sprawdź czy mamy ID sprawdzonego profilu i określ typ
    let instagramProfileId: string | null = null;
    let linkedinProfileId: string | null = null;
    let socialProfileType: SocialProfileType = SocialProfileType.NONE; // POPRAWIONE - użycie enum

    if (checkedProfileId) {
      console.log('🔗 Linking user with profile ID:', checkedProfileId);

      try {
        const profileType = await getProfileType(checkedProfileId);
        if (profileType === 'instagram') {
          instagramProfileId = checkedProfileId;
          socialProfileType = SocialProfileType.INSTAGRAM_ONLY; // POPRAWIONE - użycie enum
          console.log('✅ Will link user to Instagram profile');
        } else if (profileType === 'linkedin') {
          linkedinProfileId = checkedProfileId;
          socialProfileType = SocialProfileType.LINKEDIN_ONLY; // POPRAWIONE - użycie enum
          console.log('✅ Will link user to LinkedIn profile');
        } else {
          console.log('⚠️ Profile ID provided but profile not found in database');
        }
      } catch (error) {
        console.error('❌ Error checking profile type:', error);
        // Kontynuuj rejestrację bez powiązania profilu
      }
    } else {
      console.log('ℹ️ No profile ID provided, creating user without social profile link');
    }

    // Hashowanie hasła
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generuj token weryfikacyjny
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Generuj URL do domyślnego logo
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const defaultLogoUrl = `${baseUrl}/api/assets/uploads/logo_inflee.webp`;

    // Utworzenie użytkownika + konsumpcja kodu ATOMOWO. Jeśli powiązanie kodu
    // zawiedzie, cała transakcja się cofa (nie zostaje user bez kodu ani odwrotnie).
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName,
          lastName,
          email: email.toLowerCase().trim(),
          phone: phone?.trim() || null,
          socialLink: socialLink?.trim() || null,
          profilePicture: profilePicture?.trim() || null,
          password: hashedPassword,
          verificationToken,
          // NOWE POLA - powiązanie z profilem społecznościowym
          instagramProfileId,
          linkedinProfileId,
          socialProfileType,
          // Domyślne logo dla nowego użytkownika
          authorLogoUrl: defaultLogoUrl,
        },
      });

      // Konsumpcja kodu: wiążemy z userem, oznaczamy used. Warunek w `where`
      // (status issued + niezużyty) chroni przed race — gdyby ktoś użył kodu
      // równolegle, update nie złapie żadnego wiersza i poniżej to wykryjemy.
      if (validInvite) {
        const consumed = await tx.inviteCode.updateMany({
          where: { id: validInvite.id, status: 'issued', usedByUserId: null },
          data: { status: 'used', usedByUserId: created.id, usedAt: new Date() },
        });
        if (consumed.count === 0) {
          // Kod zniknął/został użyty między walidacją a tu — cofamy wszystko.
          throw new Error('INVITE_CONSUMED_RACE');
        }
        // Jeśli kod pochodził z wniosku — flip na 'invited'.
        if (validInvite.applicationId) {
          await tx.application.update({
            where: { id: validInvite.applicationId },
            data: { status: 'invited' },
          });
        }
      }

      return created;
    });

    console.log('✅ User created successfully:', {
      id: user.id,
      email: user.email,
      socialProfileType: user.socialProfileType,
      instagramProfileId: user.instagramProfileId,
      linkedinProfileId: user.linkedinProfileId
    });

    // Wyślij email weryfikacyjny
    try {
      // Inicjalizuj Resend dopiero tutaj
      const resend = getResendClient();

      const verifyUrl = `${process.env.NEXTAUTH_URL}/verify/${verificationToken}?lang=${pl ? 'pl' : 'en'}`;
      const { subject, html } = buildVerificationEmail({
        firstName: user.firstName,
        verifyUrl,
        pl,
      });
      await resend.emails.send({
        from: 'inflee.app <noreply@inflee.app>',
        to: [user.email],
        subject,
        html,
      });
      console.log('✅ Verification email sent successfully');
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      // User został utworzony, ale email się nie wysłał - to nie jest krytyczny błąd
    }

    // Zwróć odpowiedź bez hasła i tokenu
    const { password: _, verificationToken: __, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      message: 'Konto zostało utworzone! Sprawdź swoją skrzynkę pocztową i kliknij link weryfikacyjny.',
      user: userWithoutPassword
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Registration error:', error);
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas tworzenia konta' },
      { status: 500 }
    );
  }
}