import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { SupportedLocale } from '@/lib/locale';

type WelcomeEmailResult =
  | { ok: true; sent: true }
  | { ok: true; sent: false; reason: 'already_sent' };

type SendWelcomeEmailInput = {
  displayName: string;
  locale: SupportedLocale;
  to: string;
};

const resendEndpoint = 'https://api.resend.com/emails';

const welcomeEmailCopy = {
  de: {
    subject: 'Willkommen bei YORIAX',
    title: 'Willkommen bei YORIAX',
    heading: (displayName: string) => `Willkommen, ${displayName}.`,
    body: 'Dein Account ist bereit. Entdecke neue Tracks, speichere deine Favoriten und folge Artists, die zu deinem Sound passen.',
    earlyTitle: 'Early-Access-Bonus gesichert:',
    earlyBody: 'Dein Account erhält zum Start von YORIAX 3 Monate werbefreies Hören.',
    button: 'YORIAX öffnen',
    reason: 'Du bekommst diese Mail, weil du dich bei YORIAX registriert oder angemeldet hast.',
    fallbackName: 'du',
  },
  en: {
    subject: 'Welcome to YORIAX',
    title: 'Welcome to YORIAX',
    heading: (displayName: string) => `Welcome, ${displayName}.`,
    body: 'Your account is ready. Discover new tracks, save favorites, and follow artists that match your sound.',
    earlyTitle: 'Early-access bonus secured:',
    earlyBody: 'Your account gets 3 months of ad-free listening for the YORIAX launch.',
    button: 'Open YORIAX',
    reason: 'You received this email because you registered or signed in to YORIAX.',
    fallbackName: 'there',
  },
} satisfies Record<SupportedLocale, {
  subject: string;
  title: string;
  heading: (displayName: string) => string;
  body: string;
  earlyTitle: string;
  earlyBody: string;
  button: string;
  reason: string;
  fallbackName: string;
}>;

export class WelcomeEmailProviderNotConfiguredError extends Error {
  constructor() {
    super('Welcome email provider is not configured');
    this.name = 'WelcomeEmailProviderNotConfiguredError';
  }
}

function getUserDisplayName(user: User, locale: SupportedLocale) {
  const metadata = user.user_metadata ?? {};
  const name =
    typeof metadata.full_name === 'string'
      ? metadata.full_name
      : typeof metadata.name === 'string'
        ? metadata.name
        : typeof metadata.username === 'string'
          ? metadata.username
          : '';

  if (name.trim()) return name.trim();
  if (user.email?.includes('@')) return user.email.split('@')[0];
  return welcomeEmailCopy[locale].fallbackName;
}

function isEarlyAccessBonusActive() {
  return process.env.YORIAX_PRELAUNCH_LOCK !== 'false';
}

function createWelcomeEmailHtml({
  displayName,
  locale,
}: Pick<SendWelcomeEmailInput, 'displayName' | 'locale'>) {
  const copy = welcomeEmailCopy[locale];
  const safeDisplayName = displayName.replace(/[<>&"]/g, (char) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
    };
    return entities[char] ?? char;
  });
  const earlyAccessHtml = isEarlyAccessBonusActive()
    ? `
                <div style="margin:24px 0 0;border:1px solid rgba(45,212,191,.26);background:rgba(45,212,191,.1);border-radius:18px;padding:16px 18px;color:#ccfbf1;font-size:14px;line-height:1.55;">
                  <strong style="color:#ffffff;">${copy.earlyTitle}</strong><br />
                  ${copy.earlyBody}
                </div>`
    : '';

  return `
<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${copy.title}</title>
  </head>
  <body style="margin:0;background:#050506;color:#ffffff;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-radius:28px;overflow:hidden;background:linear-gradient(145deg,rgba(124,58,237,.22),rgba(20,184,166,.12) 45%,rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.12);">
            <tr>
              <td style="padding:34px 32px 10px;">
                <div style="letter-spacing:8px;font-weight:900;font-size:15px;color:#c4b5fd;">YORIAX</div>
                <h1 style="margin:30px 0 12px;font-size:34px;line-height:1.05;color:#ffffff;">${copy.heading(safeDisplayName)}</h1>
                <p style="margin:0;color:rgba(255,255,255,.72);font-size:16px;line-height:1.6;">
                  ${copy.body}
                </p>
                ${earlyAccessHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:26px 32px 34px;">
                <a href="https://www.yoriax.com/" style="display:inline-block;background:#ffffff;color:#050506;text-decoration:none;font-weight:900;border-radius:999px;padding:14px 22px;">
                  ${copy.button}
                </a>
                <p style="margin:28px 0 0;color:rgba(255,255,255,.46);font-size:13px;line-height:1.55;">
                  ${copy.reason}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function createWelcomeEmailText({
  displayName,
  locale,
}: Pick<SendWelcomeEmailInput, 'displayName' | 'locale'>) {
  const copy = welcomeEmailCopy[locale];
  const lines = [
    copy.heading(displayName),
    '',
    copy.body,
  ];

  if (isEarlyAccessBonusActive()) {
    lines.push('', `${copy.earlyTitle} ${copy.earlyBody}`);
  }

  lines.push('', `${copy.button}: https://www.yoriax.com/`);

  return lines.join('\n');
}

async function sendWelcomeEmail({ displayName, locale, to }: SendWelcomeEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WELCOME_EMAIL_FROM;
  const replyTo = process.env.WELCOME_EMAIL_REPLY_TO;

  if (!apiKey || !from) {
    throw new WelcomeEmailProviderNotConfiguredError();
  }

  const response = await fetch(resendEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: welcomeEmailCopy[locale].subject,
      html: createWelcomeEmailHtml({ displayName, locale }),
      text: createWelcomeEmailText({ displayName, locale }),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Welcome email delivery failed with status ${response.status}`);
  }
}

export async function sendWelcomeEmailForUser(
  supabase: SupabaseClient,
  user: User,
  locale: SupportedLocale = 'en',
): Promise<WelcomeEmailResult> {
  if (!user.email) {
    throw new Error('Authenticated user has no email address');
  }

  const { data: existing, error: existingError } = await supabase
    .from('user_welcome_emails')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return { ok: true, sent: false, reason: 'already_sent' };

  await sendWelcomeEmail({
    displayName: getUserDisplayName(user, locale),
    locale,
    to: user.email,
  });

  const { error: insertError } = await supabase.from('user_welcome_emails').insert({
    email: user.email,
    user_id: user.id,
  });

  if (insertError && insertError.code !== '23505') {
    throw insertError;
  }

  return { ok: true, sent: true };
}
