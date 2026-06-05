'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import {
  COOKIE_SETTINGS_EVENT,
  readCookieConsent,
  writeCookieConsent,
} from '@/lib/cookie-consent';

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [allowPreferences, setAllowPreferences] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const existingConsent = readCookieConsent();
      if (existingConsent) {
        setAllowPreferences(existingConsent.preferences);
      } else {
        setIsVisible(true);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const openSettings = () => {
      const existingConsent = readCookieConsent();
      setAllowPreferences(existingConsent?.preferences ?? false);
      setShowDetails(true);
      setIsVisible(true);
    };

    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings);
  }, []);

  const saveConsent = (preferences: boolean) => {
    writeCookieConsent(preferences);
    setAllowPreferences(preferences);
    setIsVisible(false);
    setShowDetails(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] text-white sm:inset-x-5 sm:bottom-5">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(139,92,246,0.32),transparent_36%),linear-gradient(105deg,rgba(7,7,14,0.98),rgba(24,18,44,0.98)_58%,rgba(5,55,53,0.96))] shadow-[0_24px_90px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-teal-200">
              <ShieldCheck className="h-4 w-4" />
              Datenschutz
            </div>
            <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              Deine Privatsphäre auf YORIAX
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Wir nutzen notwendige Speicherung für Login, Sicherheit und deine Cookie-Entscheidung. Komfort-Speicherung für Sprache und Player-Zustand nutzt YORIAX nur, wenn du sie erlaubst. Analytics- und Marketing-Cookies sind aktuell deaktiviert.
            </p>

            <button
              type="button"
              onClick={() => setShowDetails((value) => !value)}
              className="mt-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/70 transition-colors hover:text-white"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Einstellungen anzeigen
              <ChevronDown className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:w-[25rem]">
            <button
              type="button"
              onClick={() => saveConsent(false)}
              className="w-full rounded-full border border-white/15 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-widest text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Nur notwendig
            </button>
            <button
              type="button"
              onClick={() => saveConsent(true)}
              className="w-full rounded-full bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-black transition-transform hover:scale-[1.02]"
            >
              Komfort erlauben
            </button>
          </div>
        </div>

        {showDetails && (
          <div className="border-t border-white/10 bg-black/22 p-5 sm:p-6">
            <div className="grid gap-3 md:grid-cols-2">
              <ConsentCard
                title="Notwendig"
                badge="Immer aktiv"
                description="Erforderlich für Login, Sicherheitsprüfung, Auth-Session und das Speichern deiner Cookie-Entscheidung."
                active
                locked
              />
              <ConsentCard
                title="Komfort"
                badge={allowPreferences ? 'Aktiv' : 'Optional'}
                description="Merkt Sprache, Player-Zustand, Queue, Shuffle und Repeat lokal auf diesem Gerät."
                active={allowPreferences}
                onToggle={() => setAllowPreferences((value) => !value)}
              />
              <ConsentCard
                title="Analytics"
                badge="Nicht aktiv"
                description="YORIAX lädt aktuell kein Analytics-Tracking. Diese Kategorie bleibt deaktiviert, bis wir ein Tool bewusst integrieren."
                active={false}
                locked
              />
              <ConsentCard
                title="Marketing"
                badge="Nicht aktiv"
                description="Keine Werbe-Cookies, keine Partner-Pixel und kein personalisiertes Anzeigen-Tracking."
                active={false}
                locked
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => saveConsent(false)}
                className="rounded-full border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-widest text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                Alle optionalen ablehnen
              </button>
              <button
                type="button"
                onClick={() => saveConsent(allowPreferences)}
                className="rounded-full bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_0_28px_rgba(139,92,246,0.35)] transition-transform hover:scale-[1.02]"
              >
                Auswahl speichern
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsentCard({
  active,
  badge,
  description,
  locked = false,
  onToggle,
  title,
}: {
  active: boolean;
  badge: string;
  description: string;
  locked?: boolean;
  onToggle?: () => void;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-black text-white">{title}</h4>
            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${active ? 'bg-teal-300/15 text-teal-100' : 'bg-white/8 text-white/45'}`}>
              {badge}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/55">{description}</p>
        </div>
        <button
          type="button"
          disabled={locked}
          onClick={onToggle}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
            active
              ? 'border-teal-300/35 bg-teal-300/20 text-teal-100'
              : 'border-white/15 bg-white/5 text-white/45'
          } ${locked ? 'cursor-default opacity-80' : 'hover:bg-white/10'}`}
          aria-label={`${title} ${active ? 'aktiv' : 'inaktiv'}`}
        >
          {active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
