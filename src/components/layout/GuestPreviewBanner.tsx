import Link from 'next/link';
import CookieSettingsButton from '@/components/ui/CookieSettingsButton';

export default function GuestPreviewBanner() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex min-h-[72px] items-center justify-between gap-4 border-t border-teal-300/15 bg-[linear-gradient(105deg,rgba(10,8,24,0.98),rgba(76,29,149,0.97)_58%,rgba(13,148,136,0.92))] px-4 py-3 text-white shadow-[0_-14px_42px_rgba(0,0,0,0.46)] sm:px-6">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-100">Yoriax Vorschau</p>
        <p className="mt-1 hidden text-sm font-medium text-white/90 sm:block">
          Registriere dich kostenlos, um Songs zu hören, Favoriten zu speichern und eigene Playlists zu erstellen.
        </p>
        <CookieSettingsButton className="mt-1 text-[11px] font-bold text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline">
          Cookie-Einstellungen
        </CookieSettingsButton>
      </div>
      <Link
        href="/login"
        className="shrink-0 rounded-full bg-white px-4 py-2.5 text-xs font-black text-black transition-transform hover:scale-[1.03] sm:px-6 sm:text-sm"
      >
        Kostenlos registrieren
      </Link>
    </div>
  );
}
