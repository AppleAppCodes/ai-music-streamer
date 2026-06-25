'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const APP_STORE_URL = 'https://apps.apple.com/app/id6780680190';
const DISMISS_STORAGE_KEY = 'yoriax:mobile-app-prompt-dismissed-until';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isIosMobileBrowser() {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };

  if (/yoriax/i.test(userAgent)) return false;
  if (navigatorWithStandalone.standalone) return false;
  if (!/mobile|iphone|ipad|ipod/i.test(userAgent) && !(platform === 'MacIntel' && maxTouchPoints > 1)) return false;

  return /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function getLocalizedCopy(lang: string) {
  if (lang.toLowerCase().startsWith('de')) {
    return {
      eyebrow: 'App empfohlen',
      title: 'YORIAX läuft besser in der App.',
      body: 'Öffne Songs, Künstler und Playlists direkt in der iPhone-App.',
      primary: 'In App öffnen',
      secondary: 'App Store',
      dismiss: 'Schließen',
    };
  }

  return {
    eyebrow: 'App recommended',
    title: 'YORIAX works better in the app.',
    body: 'Open songs, artists, and playlists directly in the iPhone app.',
    primary: 'Open app',
    secondary: 'App Store',
    dismiss: 'Close',
  };
}

function createYoriaxSchemeUrl(pathname: string) {
  const normalizedPath = pathname.replace(/^\/+/, '');
  return normalizedPath ? `yoriax://${normalizedPath}` : 'yoriax://';
}

export default function MobileAppInstallPrompt() {
  const pathname = usePathname() || '/';
  const [visible, setVisible] = useState(false);

  const copy = useMemo(() => {
    if (typeof document === 'undefined') return getLocalizedCopy('en');
    return getLocalizedCopy(document.documentElement.lang || window.navigator.language || 'en');
  }, []);

  useEffect(() => {
    if (!isIosMobileBrowser()) return;
    if (pathname.startsWith('/api') || pathname.startsWith('/auth/callback')) return;

    const dismissedUntil = Number(window.localStorage.getItem(DISMISS_STORAGE_KEY) || 0);
    if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) return;

    const id = window.setTimeout(() => setVisible(true), 650);
    return () => window.clearTimeout(id);
  }, [pathname]);

  if (!visible) return null;

  const openApp = () => {
    const startedAt = Date.now();
    const schemeUrl = createYoriaxSchemeUrl(pathname);

    window.location.href = schemeUrl;

    window.setTimeout(() => {
      if (document.visibilityState === 'visible' && Date.now() - startedAt < 1800) {
        window.location.href = APP_STORE_URL;
      }
    }, 950);
  };

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_DURATION_MS));
    setVisible(false);
  };

  return (
    <aside
      aria-label="YORIAX App"
      className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[120] md:hidden"
    >
      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/12 bg-[#0b0712]/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-teal-400/15 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <Image
            src="/brand/yoriax-app-icon-96.png"
            alt="YORIAX"
            width={52}
            height={52}
            className="h-[52px] w-[52px] rounded-2xl border border-white/10 object-cover shadow-[0_0_24px_rgba(139,92,246,0.28)]"
          />

          <div className="min-w-0 flex-1">
            <p className="font-syncopate text-[0.62rem] font-bold uppercase tracking-[0.28em] text-teal-300">
              {copy.eyebrow}
            </p>
            <h2 className="mt-1 truncate text-base font-black leading-tight text-white">
              {copy.title}
            </h2>
            <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-white/62">
              {copy.body}
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label={copy.dismiss}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-black text-white/70"
          >
            ×
          </button>
        </div>

        <div className="relative mt-3 grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            onClick={openApp}
            className="rounded-full bg-white px-4 py-3 text-sm font-black text-black shadow-[0_10px_30px_rgba(255,255,255,0.12)] active:scale-[0.98]"
          >
            {copy.primary}
          </button>
          <a
            href={APP_STORE_URL}
            className="rounded-full border border-primary/35 bg-primary/15 px-4 py-3 text-sm font-black text-white active:scale-[0.98]"
          >
            {copy.secondary}
          </a>
        </div>
      </div>
    </aside>
  );
}
