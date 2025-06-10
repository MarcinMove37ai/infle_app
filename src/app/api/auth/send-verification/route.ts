// src/app/api/auth/send-verification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

// Funkcja do lazy initialization Resend
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_dummy_key_for_build_only') {
    throw new Error('RESEND_API_KEY is not properly configured');
  }
  return new Resend(apiKey);
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email jest wymagany' }, { status: 400 });
    }

    // Sprawdź czy user istnieje
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json({ error: 'Użytkownik nie znaleziony' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: 'Email już został zweryfikowany' }, { status: 400 });
    }

    // Generuj token weryfikacyjny
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Zapisz token w bazie
    await prisma.user.update({
      where: { email },
      data: { verificationToken }
    });

    // Inicjalizuj Resend dopiero tutaj
    const resend = getResendClient();

    // Wyślij email weryfikacyjny
    await resend.emails.send({
      from: 'inflee.app <noreply@inflee.app>',
      to: [email],
      subject: 'Ponowna weryfikacja email - inflee.app',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ponowna weryfikacja email - inflee.app</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f7fafc; color: #2d3748;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">

            <!-- Content -->
            <div style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1a202c;">Cześć ${user.firstName}! 🔄</h2>

              <p style="margin: 0 0 16px 0; color: #4a5568; line-height: 1.6; font-size: 16px;">
                Otrzymałeś ten email, ponieważ zażądano ponownej weryfikacji Twojego adresu email w <a href="${process.env.NEXTAUTH_URL}" style="color: #3b82f6; text-decoration: none; font-weight: 600;">inflee.app</a>.
              </p>

              <!-- Email Highlight Box -->
              <div style="background-color: #f0f9ff; border: 1px solid #7dd3fc; border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center;">
                <p style="margin: 0 0 8px 0; color: #0c4a6e; font-size: 14px; font-weight: 600;">📧 Ponowna weryfikacja dla:</p>
                <div style="background-color: #ffffff; border: 1px solid #3b82f6; border-radius: 8px; padding: 12px; margin: 8px 0;">
                  <span style="font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; color: #1e40af; font-weight: 600; font-size: 16px;">${user.email}</span>
                </div>
              </div>

              <p style="margin: 0 0 24px 0; color: #4a5568; line-height: 1.6; font-size: 16px;">
                Kliknij poniższy przycisk, aby potwierdzić swój email:
              </p>

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
                  • Jeśli nie żądałeś tej weryfikacji, zignoruj ten email<br>
                  • To Twoja ponowna próba weryfikacji
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

    return NextResponse.json({ success: true, message: 'Email weryfikacyjny został wysłany' });

  } catch (error) {
    console.error('Send verification error:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}