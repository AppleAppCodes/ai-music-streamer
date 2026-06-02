# YORIAX auth email setup

Supabase Auth can send the confirmation email with the YORIAX sender and template, but the sending domain must first be verified with an SMTP provider.

## Required dashboard configuration

1. Verify a YORIAX sending address such as `noreply@yoriax.com` with an SMTP provider.
2. Open the Supabase project Authentication settings and enable custom SMTP.
3. Enter the provider host, port, username, password, sender address, and sender name `YORIAX`.
4. Open the Supabase email templates page, select the signup confirmation template, and paste the contents of `docs/supabase-confirmation-email.html`.
5. Send a test signup and confirm that the sender, subject, and confirmation link are correct.

Project dashboard:

- Authentication settings: `https://supabase.com/dashboard/project/eiqelhjugiwckvxyixyh/auth/smtp`
- Email templates: `https://supabase.com/dashboard/project/eiqelhjugiwckvxyixyh/auth/templates`
