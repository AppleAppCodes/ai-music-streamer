import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import AudioPlayer from "@/components/layout/AudioPlayer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Stream | The first streaming platform for AI-native music",
  description: "Stream, discover, and publish the best AI-generated music.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="h-full flex flex-col bg-background text-foreground overflow-hidden">
        {/* Global Film Grain Overlay */}
        <div 
          className="pointer-events-none fixed inset-0 z-[9999] h-full w-full opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="flex h-full w-full relative z-0">
          <Sidebar />
          <div className="flex-1 flex flex-col relative min-w-0">
            <Header />
            <main className="flex-1 overflow-y-auto pb-28 no-scrollbar bg-gradient-to-b from-surface to-background">
              {children}
            </main>
          </div>
        </div>
        <AudioPlayer />
      </body>
    </html>
  );
}
