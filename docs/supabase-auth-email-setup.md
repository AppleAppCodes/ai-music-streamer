# YORIAX auth email setup

Supabase Auth can send the confirmation email with the YORIAX sender and template, but the sending domain must first be verified with an SMTP provider.

Google OAuth accounts do not receive a Supabase opt-in/confirmation email because Google already returns a verified OAuth identity. YORIAX sends a separate branded welcome email after the first successful session through the app server.

## Required dashboard configuration

1. Verify a YORIAX sending address such as `noreply@yoriax.com` with an SMTP provider.
2. Open the Supabase project Authentication settings and enable custom SMTP.
3. Enter the provider host, port, username, password, sender address, and sender name `YORIAX`.
4. Open the Supabase email templates page, select the signup confirmation template, and paste the contents of `docs/supabase-confirmation-email.html`.
5. Send a test signup and confirm that the sender, subject, and confirmation link are correct.

Project dashboard:

- Authentication settings: `https://supabase.com/dashboard/project/eiqelhjugiwckvxyixyh/auth/smtp`
- Email templates: `https://supabase.com/dashboard/project/eiqelhjugiwckvxyixyh/auth/templates`

## YORIAX welcome email

The app calls `POST /api/auth/welcome` after a successful session. The endpoint is idempotent and records sent emails in `public.user_welcome_emails`, so each account receives the welcome email once.

Required server-side environment variables:

```bash
RESEND_API_KEY=
WELCOME_EMAIL_FROM="YORIAX <noreply@yoriax.com>"
WELCOME_EMAIL_REPLY_TO=support@yoriax.com
```

`WELCOME_EMAIL_REPLY_TO` is optional. Do not expose `RESEND_API_KEY` through any `NEXT_PUBLIC_` or `EXPO_PUBLIC_` variable.
