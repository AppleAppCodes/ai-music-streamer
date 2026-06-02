import Link from 'next/link';

export default function GuestPreviewBanner() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex min-h-[72px] items-center justify-between gap-4 bg-gradient-to-r from-fuchsia-700 via-violet-600 to-blue-500 px-4 py-3 text-white shadow-[0_-12px_36px_rgba(0,0,0,0.34)] sm:px-6">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.18em]">Yoriax Vorschau</p>
        <p className="mt-1 hidden text-sm font-medium text-white/90 sm:block">
          Registriere dich kostenlos, um Songs zu hören, Favoriten zu speichern und eigene Playlists zu erstellen.
        </p>
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
