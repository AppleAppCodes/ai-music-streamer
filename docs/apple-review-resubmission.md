# Apple Review Resubmission

## Required Supabase setting

The native iOS implementation uses Apple's native Authentication Services flow. It does not require an Apple OAuth Services ID or rotating `.p8` client secret.

In Supabase:

1. Open **Authentication → Sign In / Providers → Apple**.
2. Enable the Apple provider.
3. Add `com.yoriax.app` under **Client IDs**.
4. Leave the OAuth-only fields empty.
5. Save and confirm that `https://eiqelhjugiwckvxyixyh.supabase.co/auth/v1/settings` reports `"apple": true`.

## Physical-device verification

Use a disposable account. Completing the recording permanently deletes it.

1. Install the current production build on a physical iPhone or iPad.
2. Start the device screen recording before opening Yoriax.
3. Show the login screen with **Continue with Apple** and **Continue with Google** at equal size and prominence.
4. Create a disposable account or sign in with a disposable review account.
5. Open the profile/settings screen.
6. Scroll to **Account → Delete Account**.
7. Tap **Delete Account**.
8. Show both destructive confirmation dialogs.
9. Confirm deletion.
10. Keep recording until the app returns to the login screen and the **Account deleted** confirmation is visible.
11. Stop recording and verify that the account no longer appears in Supabase Authentication users.

## Suggested App Review note

> Sign in with Apple is available on the login screen with equal prominence to Google login. Account deletion is available in Profile → Settings → Account → Delete Account. The flow asks for confirmation, permanently removes the user's authentication record and associated profile, uploads, playlists, likes, comments, reports, and storage files from Supabase, signs the user out, and displays a completion message. A physical-device screen recording of the complete flow is attached.
