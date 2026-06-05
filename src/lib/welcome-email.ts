import type { SupabaseClient, User } from '@supabase/supabase-js';

type WelcomeEmailResult =
  | { ok: true; sent: true }
  | { ok: true; sent: false; reason: 'already_sent' };

type SendWelcomeEmailInput = {
  displayName: string;
  to: string;
};

const resendEndpoint = 'https://api.resend.com/emails';

export class WelcomeEmailProviderNotConfiguredError extends Error {
  constructor() {
    super('Welcome email provider is not configured');
    this.name = 'WelcomeEmailProviderNotConfiguredError';
  }
}

function getUserDisplayName(user: User) {
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
  return 'du';
}

function createWelcomeEmailHtml({ displayName }: Pick<SendWelcomeEmailInput, 'displayName'>) {
  const safeDisplayName = displayName.replace(/[<>&"]/g, (char) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
    };
    return entities[char] ?? char;
  });

  return `
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Willkommen bei YORIAX</title>
  </head>
  <body style="margin:0;background:#050506;color:#ffffff;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-radius:28px;overflow:hidden;background:linear-gradient(145deg,rgba(124,58,237,.22),rgba(20,184,166,.12) 45%,rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.12);">
            <tr>
              <td style="padding:34px 32px 10px;">
                <div style="letter-spacing:8px;font-weight:900;font-size:15px;color:#c4b5fd;">YORIAX</div>
                <h1 style="margin:30px 0 12px;font-size:34px;line-height:1.05;color:#ffffff;">Willkommen, ${safeDisplayName}.</h1>
                <p style="margin:0;color:rgba(255,255,255,.72);font-size:16px;line-height:1.6;">
                  Dein Account ist bereit. Entdecke neue Tracks, speichere deine Favoriten und folge Artists, die zu deinem Sound passen.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 32px 34px;">
                <a href="https://www.yoriax.com/" style="display:inline-block;background:#ffffff;color:#050506;text-decoration:none;font-weight:900;border-radius:999px;padding:14px 22px;">
                  YORIAX öffnen
                </a>
                <p style="margin:28px 0 0;color:rgba(255,255,255,.46);font-size:13px;line-height:1.55;">
                  Du bekommst diese Mail, weil du dich bei YORIAX registriert oder angemeldet hast.
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

function createWelcomeEmailText({ displayName }: Pick<SendWelcomeEmailInput, 'displayName'>) {
  return [
    `Willkommen bei YORIAX, ${displayName}.`,
    '',
    'Dein Account ist bereit. Entdecke neue Tracks, speichere deine Favoriten und folge Artists, die zu deinem Sound passen.',
    '',
    'YORIAX öffnen: https://www.yoriax.com/',
  ].join('\n');
}

async function sendWelcomeEmail({ displayName, to }: SendWelcomeEmailInput) {
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
      subject: 'Willkommen bei YORIAX',
      html: createWelcomeEmailHtml({ displayName }),
      text: createWelcomeEmailText({ displayName }),
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
    displayName: getUserDisplayName(user),
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
