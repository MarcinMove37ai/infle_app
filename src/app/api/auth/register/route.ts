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
    const { firstName, lastName, email, phone, socialLink, password, profilePicture, checkedProfileId } = body;

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

    // Utworzenie użytkownika z tokenem weryfikacyjnym, domyślnym logo i powiązaniem profilu
    const user = await prisma.user.create({
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
      }
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

      await resend.emails.send({
        from: 'inflee.app <noreply@inflee.app>',
        to: [user.email],
        subject: 'Potwierdź swój email - inflee.app',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Potwierdź swój email - inflee.app</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f7fafc; color: #2d3748;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

              <!-- Content -->
              <div style="padding: 32px;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a202c;">Witaj ${user.firstName}! 👋</h2>

                <p style="margin: 0 0 16px 0; color: #4a5568; line-height: 1.6; font-size: 16px;">
                  Dziękujemy za rejestrację w <a href="${process.env.NEXTAUTH_URL}" style="color: #3b82f6; text-decoration: none; font-weight: 600;">inflee.app</a>! Aby rozpocząć korzystanie z platformy, potwierdź swój adres email.
                </p>

                <!-- Email Highlight Box -->
                <div style="background-color: #f0f9ff; border: 1px solid #7dd3fc; border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center;">
                  <p style="margin: 0 0 8px 0; color: #0c4a6e; font-size: 14px; font-weight: 600;">📧 Weryfikujemy adres email:</p>
                  <div style="background-color: #ffffff; border: 1px solid #3b82f6; border-radius: 8px; padding: 12px; margin: 8px 0;">
                    <span style="font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; color: #1e40af; font-weight: 600; font-size: 16px;">${user.email}</span>
                  </div>
                </div>

                <!-- Verification Button -->
                <div style="margin: 32px 0; text-align: center;">
                  <a href="${process.env.NEXTAUTH_URL}/verify/${verificationToken}"
                     style="display: inline-block; background: linear-gradient(135deg, #9333ea 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.25); transition: all 0.2s ease;">
                    Potwierdź email
                  </a>
                </div>

                <!-- Info Box -->
                <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 24px 0;">
                  <p style="margin: 0; color: #4a5568; font-size: 14px; line-height: 1.5;">
                    <span style="font-weight: 600;">📧 Ważne informacje:</span><br>
                    • Link jest ważny przez 24 godziny<br>
                    • Jeśli nie rejestrowałeś się, zignoruj ten email<br>
                    • Po weryfikacji będziesz mógł się zalogować
                  </p>
                </div>

                <!-- Alternative Link -->
                <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 8px;">
                  <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; font-weight: 500;">Problemy z przyciskiem? Skopiuj link:</p>
                  <p style="margin: 0; font-size: 11px; color: #64748b; word-break: break-all; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;">${process.env.NEXTAUTH_URL}/verify/${verificationToken}</p>
                </div>
              </div>

              <!-- Footer -->
              <div style="padding: 24px 32px; background-color: #f8fafc; text-align: center; border-radius: 0 0 12px 12px;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">© 2025 inflee.app • Platforma edukacyjna</p>
              </div>

            </div>
          </body>
          </html>
        `
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