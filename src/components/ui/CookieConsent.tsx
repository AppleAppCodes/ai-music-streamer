'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-[#e5e5e5] text-black border-t border-gray-300 shadow-2xl p-6 md:p-8 animate-in slide-in-from-bottom-full duration-500">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        
        {/* Text Section */}
        <div className="flex-1 text-sm text-gray-800 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold text-lg mb-3 text-black">Deine Privatsphäre ist uns wichtig</h3>
            <p className="mb-4">
              Wir und unsere <span className="font-bold">88</span> Partner speichern Informationen auf Geräten und/oder greifen darauf zu, z. B. eindeutige IDs in Cookies, um personenbezogene Daten zu verarbeiten. 
              Klicke unten auf „Cookie-Einstellungen“, um mehr über die Zwecke zu erfahren, für die wir und unsere Partner Cookies verwenden, oder um die Einstellungen zu ändern. Du kannst deine Einstellungen jederzeit überprüfen oder deine Einwilligung widerrufen, indem du in unserer Cookie-Richtlinie auf den Link zu deinen Cookie-Einstellungen klickst. Diese Entscheidungen werden unseren Partnern mitgeteilt und haben keinen Einfluss auf die Browsingdaten.
            </p>
            <p>
              Indem Du auf &quot;Cookies akzeptieren&quot; klickst, willigst Du in unsere Nutzung und die Weitergabe Deiner Daten an <Link href="#" className="underline hover:text-black font-medium">unsere Partner</Link> ein.
            </p>
          </div>
          <div>
            <p className="font-bold mb-2">Wir und unsere Partner verarbeiten Daten, um Folgendes bereitzustellen:</p>
            <p className="mb-4">
              Speichern von oder Zugriff auf Informationen auf einem Endgerät. Personalisierte Werbung. Personalisierte Inhalte. Messung von Werbeleistung und der Performance von Inhalten, Zielgruppenforschung sowie Entwicklung und Verbesserung der Angebote.
            </p>
            <p className="mb-4">
              Weitere Informationen zu unseren Partnern und zum Opt-out findest Du in unserer:
            </p>
            <Link href="#" className="underline hover:text-black font-medium uppercase text-xs tracking-wider">
              Liste der Partner (Anbieter)
            </Link>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row lg:flex-col justify-end gap-3 lg:w-64 shrink-0 mt-4 lg:mt-0">
          <button 
            onClick={handleAcceptAll}
            className="w-full py-3 px-4 bg-[#1a1a1a] hover:bg-black text-white text-xs font-bold tracking-widest uppercase rounded transition-colors"
          >
            Cookies akzeptieren
          </button>
          <button 
            onClick={handleRejectAll}
            className="w-full py-3 px-4 bg-[#1a1a1a] hover:bg-black text-white text-xs font-bold tracking-widest uppercase rounded transition-colors"
          >
            Alle ablehnen
          </button>
          <button 
            className="w-full py-3 px-4 bg-transparent hover:bg-gray-200 text-black text-xs font-bold tracking-widest uppercase rounded transition-colors border border-transparent hover:border-gray-300"
          >
            Cookie Einstellungen
          </button>
        </div>
      </div>
    </div>
  );
}
