'use client';

import { useState, useEffect } from 'react';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already made a choice
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = window.setTimeout(() => setIsVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    localStorage.setItem('cookie-consent', 'rejected');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-teal-300/15 bg-[linear-gradient(105deg,rgba(7,7,14,0.98),rgba(42,16,88,0.97)_58%,rgba(11,95,90,0.95))] p-5 text-white shadow-2xl animate-in slide-in-from-bottom-full duration-500 md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-200">Datenschutz</p>
          <h3 className="mt-2 text-lg font-black tracking-tight text-white">YORIAX nutzt nur notwendige lokale Speicherung</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Wir speichern aktuell nur notwendige Informationen für Login, Sicherheit, Player- und Cookie-Einstellungen. Marketing-Cookies und Werbepartner-Tracking sind derzeit nicht aktiviert.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:w-72">
          <button 
            onClick={handleAcceptAll}
            className="w-full rounded-full bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.02]"
          >
            Verstanden
          </button>
          <button 
            onClick={handleRejectAll}
            className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            Ablehnen
          </button>
        </div>
      </div>
    </div>
  );
}
