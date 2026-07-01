import type { Metadata } from "next";
import { Geist, Geist_Mono, Syncopate } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import AudioPlayer from "@/components/layout/AudioPlayer";
import PlayerLayout from "@/components/layout/PlayerLayout";
import CookieConsent from "@/components/ui/CookieConsent";
import MobileNavigation from "@/components/layout/MobileNavigation";
import GuestPreviewBanner from "@/components/layout/GuestPreviewBanner";
import MobileAppInstallPrompt from "@/components/layout/MobileAppInstallPrompt";
import { createClient } from "@/utils/supabase/server";
import { Analytics } from "@vercel/analytics/react";
import { isAdminUser } from "@/lib/admin";
import { getAppVersionLabel } from "@/lib/app-version";
import { isPrelaunchLockEnabled, isUserWhitelisted } from "@/lib/prelaunch";
import { getLocaleFromAcceptLanguage } from "@/lib/locale";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_ALT,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_URL,
  buildPageMetadata,
  jsonLdScript,
  rootStructuredData,
} from "@/lib/seo";
import { headers } from "next/headers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const syncopate = Syncopate({
  variable: "--font-syncopate",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: '/',
    image: DEFAULT_OG_IMAGE,
    imageAlt: DEFAULT_OG_ALT,
  }),
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  applicationName: SITE_NAME,
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black-translucent',
  },
  category: 'music',
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=4", type: "image/x-icon" },
      { url: "/brand/yoriax-app-icon-192.png?v=4", sizes: "192x192", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico?v=4", type: "image/x-icon" }],
    apple: [{ url: "/apple-touch-icon.png?v=4", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "apple-itunes-app": "app-id=6780680190, app-argument=https://www.yoriax.com",
    "theme-color": "#08030f",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const headerStore = await headers();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = isAdminUser(user);
  const isWhitelisted = isUserWhitelisted(user?.email);
  const isPrelaunchLocked = isPrelaunchLockEnabled() && !isAdmin && !isWhitelisted;
  const shouldRenderAppShell = Boolean(user) && !isPrelaunchLocked;
  const shouldRenderGuestBanner = !user && !isPrelaunchLocked;
  const appVersionLabel = getAppVersionLabel();
  const locale = getLocaleFromAcceptLanguage(headerStore.get('accept-language'));

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${syncopate.variable} h-full antialiased dark`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-background text-foreground md:h-full md:overflow-hidden">
        <script
          id="yoriax-root-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(rootStructuredData)}
        />
        <PlayerLayout isAuthenticated={shouldRenderAppShell}>
          {isPrelaunchLocked ? (
            <main className="relative z-0 min-h-dvh w-full">
              {children}
            </main>
          ) : (
            <div className="relative z-0 flex min-h-dvh w-full md:h-full md:min-h-0">
              {user ? <Sidebar user={user} appVersionLabel={appVersionLabel} /> : null}
              <div className="flex-1 flex flex-col relative min-w-0">
                <Header user={user} />
                <main className={`yoriax-app-main no-drag md:flex-1 md:overflow-y-auto md:no-scrollbar ${
                  user
                    ? 'pb-[calc(10.25rem+env(safe-area-inset-bottom))] md:pb-32'
                    : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
                }`}>
                  {children}
                </main>
              </div>
            </div>
          )}
          {shouldRenderAppShell ? (
            <>
              <AudioPlayer />
              <MobileNavigation user={user!} />
            </>
          ) : shouldRenderGuestBanner ? (
            <GuestPreviewBanner />
          ) : null}
          <MobileAppInstallPrompt />
          <CookieConsent />
        </PlayerLayout>
        <Analytics />
      </body>
    </html>
  );
}
