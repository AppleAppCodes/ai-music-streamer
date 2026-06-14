import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { CheckCircle2, LockKeyhole, Sparkles, TicketCheck } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';

async function signOutAction() {
  'use server';

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login?mode=register&bonus=early');
}

export default function PrelaunchLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#050506] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(124,58,237,0.42),transparent_34%),radial-gradient(circle_at_80%_24%,rgba(45,212,191,0.2),transparent_30%),linear-gradient(180deg,rgba(8,7,20,0.98),#050506_58%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")' }} />

      <main className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-8 sm:px-8 md:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" aria-label="YORIAX Startseite" className="inline-flex items-center">
            <Image
              src="/brand/yoriax-logo.png"
              alt="YORIAX"
              width={184}
              height={42}
              priority
              className="h-9 w-auto"
            />
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/75 transition hover:border-white/20 hover:bg-white/[0.12] hover:text-white"
          >
            Login
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100">
              <LockKeyhole className="h-4 w-4" />
              Prelaunch Zugang
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.96] tracking-tight text-white sm:text-6xl md:text-7xl">
              YORIAX startet bald.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
              Wir öffnen die Plattform gerade kontrolliert für den Launch. Registriere dich jetzt und sichere dir
              <span className="font-bold text-white"> 3 Monate werbefreies Hören</span> als Early-Access-Bonus.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {signedIn ? (
                <div className="rounded-2xl border border-teal-300/20 bg-teal-300/10 px-5 py-4">
                  <p className="flex items-center gap-2 text-sm font-black text-teal-100">
                    <CheckCircle2 className="h-5 w-5" />
                    Du bist registriert. Dein Early-Bonus ist gesichert.
                  </p>
                </div>
              ) : (
                <Link
                  href="/login?mode=register&bonus=early"
                  className="inline-flex items-center justify-center rounded-full bg-white px-7 py-4 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  Early Access sichern
                </Link>
              )}
              <Link
                href="/datenschutz"
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-7 py-4 text-sm font-black uppercase tracking-[0.16em] text-white/70 transition hover:border-white/20 hover:text-white"
              >
                Datenschutz
              </Link>
            </div>

            {signedIn ? (
              <form action={signOutAction} className="mt-5">
                <button
                  type="submit"
                  className="text-sm font-semibold text-white/42 underline-offset-4 transition hover:text-white hover:underline"
                >
                  Abmelden oder mit anderem Account registrieren
                </button>
              </form>
            ) : null}
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-violet-500/25 via-cyan-400/10 to-transparent blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-[0_40px_140px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-6">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-100">
                    <TicketCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/42">Early Bonus</p>
                    <h2 className="text-2xl font-black text-white">3 Monate werbefrei</h2>
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  {[
                    'Vor dem offiziellen Launch registrieren',
                    'Bonus wird direkt im Account hinterlegt',
                    'Nach Launch ohne Werbung weiterhören',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/[0.045] px-4 py-3 text-sm font-semibold text-white/68">
                      <Sparkles className="h-4 w-4 text-teal-200" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-2 text-xs font-bold uppercase tracking-[0.16em] text-white/28">
          <Link href="/impressum" className="transition hover:text-white/70">Impressum</Link>
          <Link href="/datenschutz" className="transition hover:text-white/70">Datenschutz</Link>
          <Link href="/agb" className="transition hover:text-white/70">AGB</Link>
        </footer>
      </main>
    </div>
  );
}
