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
import { createClient } from "@/utils/supabase/server";

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
  title: "Yoriax | The first streaming platform for AI-native music",
  description: "Stream, discover, and publish the best AI-generated music.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=4", type: "image/x-icon" },
      { url: "/brand/yoriax-app-icon-192.png?v=4", sizes: "192x192", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico?v=4", type: "image/x-icon" }],
    apple: [{ url: "/apple-touch-icon.png?v=4", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${syncopate.variable} h-full antialiased dark`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-background text-foreground md:h-full md:overflow-hidden">
        <PlayerLayout isAuthenticated={Boolean(user)}>
          {/* Global Film Grain Overlay */}
          <div 
            className="pointer-events-none fixed inset-0 z-[9999] h-full w-full opacity-[0.04]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />
          <div className="relative z-0 flex min-h-dvh w-full md:h-full md:min-h-0">
            {user ? <Sidebar user={user} /> : null}
            <div className="flex-1 flex flex-col relative min-w-0">
              <Header user={user} />
              <main className={`bg-gradient-to-b from-surface to-background md:flex-1 md:overflow-y-auto md:no-scrollbar ${
                user
                  ? 'pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-28'
                  : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
              }`}>
                {children}
              </main>
            </div>
          </div>
          {user ? (
            <>
              <AudioPlayer />
              <MobileNavigation user={user} />
            </>
          ) : (
            <GuestPreviewBanner />
          )}
          <CookieConsent />
        </PlayerLayout>
      </body>
    </html>
  );
}
