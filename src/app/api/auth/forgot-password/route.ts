// src/app/api/auth/forgot-password/route.ts
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

// Szablon maila resetu hasła — dwujęzyczny (EN/PL), spójny ze stylem aplikacji.
// Ciemny header z logo-gradientem, białe ciało, bez emoji, jeden box informacyjny.
function buildResetEmail(opts: { firstName: string; resetUrl: string; pl: boolean }) {
  const { firstName, resetUrl, pl } = opts;

  const t = pl
    ? {
        subject: 'Resetowanie hasła - inflee.app',
        tagline: 'Edukuj · Rośnij · Zarabiaj',
        heading: 'Zresetuj swoje hasło',
        hi: `Cześć ${firstName},`,
        intro: 'Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w inflee.app. Kliknij przycisk poniżej, aby ustawić nowe hasło.',
        button: 'Ustaw nowe hasło',
        notice: 'Link jest ważny przez 1 godzinę i można go użyć tylko raz. Jeśli to nie Ty prosiłeś o reset hasła, zignoruj tę wiadomość — Twoje hasło pozostanie bez zmian.',
        trouble: 'Problem z przyciskiem? Wklej ten link do przeglądarki:',
        footer: '© 2026 inflee.app · Masz pytania?',
      }
    : {
        subject: 'Reset your password - inflee.app',
        tagline: 'Educate · Grow · Earn',
        heading: 'Reset your password',
        hi: `Hi ${firstName},`,
        intro: 'We received a request to reset the password for your inflee.app account. Click the button below to choose a new one.',
        button: 'Set a new password',
        notice: 'This link is valid for 1 hour and can be used once. If you did not request a password reset, you can safely ignore this email — your password will stay the same.',
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
          <a href="${resetUrl}" style="display:inline-block; background:linear-gradient(135deg,#9333ea,#4f46e5); color:#ffffff; text-decoration:none; padding:13px 36px; border-radius:10px; font-size:15px; font-weight:600;">${t.button}</a>
        </div>

        <div style="background-color:#f7f7fa; border-radius:10px; padding:14px 16px; margin:24px 0;">
          <p style="margin:0; font-size:13px; line-height:1.6; color:#6a6a76;">${t.notice}</p>
        </div>

        <p style="margin:24px 0 6px; font-size:12px; color:#9a9aa5;">${t.trouble}</p>
        <p style="margin:0; font-size:11px; color:#9a9aa5; word-break:break-all; font-family:'SF Mono',Monaco,'Cascadia Code',monospace;">${resetUrl}</p>
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

export async function POST(request: NextRequest) {
  try {
    const { email, lang } = await request.json();
    const pl = lang === 'pl';

    if (!email) {
      return NextResponse.json(
        { error: pl ? 'Email jest wymagany' : 'Email is required' },
        { status: 400 }
      );
    }

    // Sprawdź czy user istnieje
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      // Ze względów bezpieczeństwa zawsze zwracamy sukces (nie ujawniamy istnienia kont).
      return NextResponse.json({
        success: true,
        message: pl
          ? 'Jeśli konto z tym emailem istnieje, wysłaliśmy link do resetowania hasła.'
          : 'If an account with this email exists, we have sent a password reset link.'
      });
    }

    // Token resetujący (32 bajty = 64 znaki hex), ważny 1 godzinę.
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { email: user.email },
      data: { resetToken, resetTokenExpiry }
    });

    // Link resetu z językiem (strona resetu uszanuje ?lang=).
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password/${resetToken}?lang=${pl ? 'pl' : 'en'}`;

    const { subject, html } = buildResetEmail({
      firstName: user.firstName,
      resetUrl,
      pl,
    });

    const resend = getResendClient();
    await resend.emails.send({
      from: 'inflee.app <noreply@inflee.app>',
      to: [user.email],
      subject,
      html,
    });

    return NextResponse.json({
      success: true,
      message: pl
        ? 'Link do resetowania hasła został wysłany na Twój email.'
        : 'A password reset link has been sent to your email.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}