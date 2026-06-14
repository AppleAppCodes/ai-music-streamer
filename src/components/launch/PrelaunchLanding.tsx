import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { CheckCircle2, LockKeyhole, Radio, Sparkles, Star, TicketCheck } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import type { SupportedLocale } from '@/lib/locale';

async function signOutAction() {
  'use server';

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login?mode=register&bonus=early');
}

const copy = {
  de: {
    homeAria: 'YORIAX Startseite',
    login: 'Login',
    badge: 'Prelaunch Zugang',
    title: 'YORIAX startet bald.',
    description: (
      <>
        YORIAX ist eine kuratierte Streaming-Plattform für ausgewählte KI-Musik. Wir öffnen die Plattform gerade kontrolliert für den Launch. Registriere dich jetzt und sichere dir
        <span className="font-bold text-white"> 3 Monate werbefreies Hören</span> als Early-Access-Bonus.
      </>
    ),
    registered: 'Du bist registriert. Dein Early-Bonus ist gesichert.',
    cta: 'Early Access sichern',
    ctaHeadline: 'Sichere dir deinen Startvorteil',
    ctaSubline: 'Registriere dich vor dem offiziellen Launch und höre die ersten 3 Monate werbefrei.',
    privacy: 'Datenschutz',
    signOut: 'Abmelden oder mit anderem Account registrieren',
    infoEyebrow: 'Was ist YORIAX?',
    infoTitle: 'Kuratierte KI-Musik, die nicht nach Zufall klingt.',
    infoText: 'Wir wählen Tracks, Artists und Playlists bewusst aus, damit du nicht durch Masse scrollst, sondern schnell Musik findest, die hochwertig produziert ist und zu YORIAX passt.',
    points: [
      'Handverlesene AI-Tracks statt beliebiger Upload-Flut',
      'Artists, Charts und Playlists mit klarer Qualitätskontrolle',
      'Ein Sound-Katalog für neue Creator und Hörer, die AI-Musik ernst nehmen',
    ],
    bonusEyebrow: 'Early Bonus',
    bonusTitle: '3 Monate werbefrei',
    bonusItems: [
      'Vor dem offiziellen Launch registrieren',
      'Bonus wird direkt im Account hinterlegt',
      'Nach Launch ohne Werbung weiterhören',
    ],
    legal: {
      impressum: 'Impressum',
      privacy: 'Datenschutz',
      terms: 'AGB',
    },
  },
  en: {
    homeAria: 'YORIAX home',
    login: 'Login',
    badge: 'Prelaunch access',
    title: 'YORIAX is launching soon.',
    description: (
      <>
        YORIAX is a curated streaming platform for selected AI-native music. We are opening the platform in a controlled prelaunch phase. Sign up now and secure
        <span className="font-bold text-white"> 3 months of ad-free listening</span> as an early-access bonus.
      </>
    ),
    registered: 'You are registered. Your early bonus is secured.',
    cta: 'Secure early access',
    ctaHeadline: 'Secure your launch bonus',
    ctaSubline: 'Register before the official launch and listen ad-free for the first 3 months.',
    privacy: 'Privacy',
    signOut: 'Sign out or register with another account',
    infoEyebrow: 'What is YORIAX?',
    infoTitle: 'Curated AI music that does not feel random.',
    infoText: 'We select tracks, artists, and playlists deliberately, so listeners do not have to scroll through volume. YORIAX is built around quality, discovery, and a clear sound identity.',
    points: [
      'Hand-picked AI tracks instead of an unfiltered upload feed',
      'Artists, charts, and playlists shaped by quality control',
      'A catalog for creators and listeners who take AI music seriously',
    ],
    bonusEyebrow: 'Early bonus',
    bonusTitle: '3 months ad-free',
    bonusItems: [
      'Register before the official launch',
      'The bonus is stored directly on your account',
      'Keep listening without ads after launch',
    ],
    legal: {
      impressum: 'Legal notice',
      privacy: 'Privacy',
      terms: 'Terms',
    },
  },
} satisfies Record<SupportedLocale, {
  homeAria: string;
  login: string;
  badge: string;
  title: string;
  description: ReactNode;
  registered: string;
  cta: string;
  ctaHeadline: string;
  ctaSubline: string;
  privacy: string;
  signOut: string;
  infoEyebrow: string;
  infoTitle: string;
  infoText: string;
  points: string[];
  bonusEyebrow: string;
  bonusTitle: string;
  bonusItems: string[];
  legal: {
    impressum: string;
    privacy: string;
    terms: string;
  };
}>;

export default function PrelaunchLanding({
  locale,
  signedIn,
}: {
  locale: SupportedLocale;
  signedIn: boolean;
}) {
  const t = copy[locale];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#050506] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(124,58,237,0.42),transparent_34%),radial-gradient(circle_at_80%_24%,rgba(45,212,191,0.2),transparent_30%),linear-gradient(180deg,rgba(8,7,20,0.98),#050506_58%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")' }} />

      <main className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-8 sm:px-8 md:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" aria-label={t.homeAria} className="inline-flex items-center">
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
            {t.login}
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-10 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-violet-100">
              <LockKeyhole className="h-4 w-4" />
              {t.badge}
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.96] tracking-tight text-white sm:text-6xl md:text-7xl">
              {t.title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/62 sm:text-lg">
              {t.description}
            </p>

            <div className="mt-7 max-w-2xl">
              {signedIn ? (
                <div className="relative overflow-hidden rounded-3xl border border-teal-200/35 bg-gradient-to-r from-teal-300/18 via-white/[0.07] to-violet-500/10 px-5 py-5 shadow-[0_0_55px_rgba(45,212,191,0.18)] backdrop-blur-xl">
                  <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_50%,rgba(45,212,191,0.22),transparent_60%)]" />
                  <p className="relative flex items-center gap-3 text-base font-black text-teal-50">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-300/18 text-teal-100 ring-1 ring-teal-200/35">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    {t.registered}
                  </p>
                </div>
              ) : (
                <div className="relative overflow-hidden rounded-[2rem] border border-violet-200/30 bg-white/[0.07] p-4 shadow-[0_0_80px_rgba(124,58,237,0.22)] backdrop-blur-xl sm:p-5">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(168,85,247,0.35),transparent_36%),radial-gradient(circle_at_88%_55%,rgba(45,212,191,0.2),transparent_42%)]" />
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="mb-1 text-xs font-black uppercase tracking-[0.2em] text-teal-100">Early Access</p>
                      <h2 className="text-2xl font-black tracking-tight text-white">{t.ctaHeadline}</h2>
                      <p className="mt-2 text-sm leading-6 text-white/58">{t.ctaSubline}</p>
                    </div>
                    <Link
                      href="/login?mode=register&bonus=early"
                      className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.16em] text-black shadow-[0_0_36px_rgba(255,255,255,0.18)] transition hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {t.cta}
                    </Link>
                  </div>
                  <Link
                    href="/datenschutz"
                    className="relative mt-3 inline-flex text-[11px] font-bold uppercase tracking-[0.16em] text-white/34 underline-offset-4 transition hover:text-white/65 hover:underline"
                  >
                    {t.privacy}
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-6 max-w-2xl rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
              <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-teal-200">
                <Radio className="h-4 w-4" />
                {t.infoEyebrow}
              </p>
              <h2 className="text-2xl font-black tracking-tight text-white">{t.infoTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-white/58">{t.infoText}</p>
              <div className="mt-4 grid gap-2">
                {t.points.map((point) => (
                  <div key={point} className="flex items-start gap-3 text-sm font-semibold leading-5 text-white/68">
                    <Star className="mt-0.5 h-4 w-4 shrink-0 text-violet-200" />
                    {point}
                  </div>
                ))}
              </div>
            </div>

            {signedIn ? (
              <form action={signOutAction} className="mt-5">
                <button
                  type="submit"
                  className="text-sm font-semibold text-white/42 underline-offset-4 transition hover:text-white hover:underline"
                >
                  {t.signOut}
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
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/42">{t.bonusEyebrow}</p>
                    <h2 className="text-2xl font-black text-white">{t.bonusTitle}</h2>
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  {t.bonusItems.map((item) => (
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
          <Link href="/impressum" className="transition hover:text-white/70">{t.legal.impressum}</Link>
          <Link href="/datenschutz" className="transition hover:text-white/70">{t.legal.privacy}</Link>
          <Link href="/agb" className="transition hover:text-white/70">{t.legal.terms}</Link>
        </footer>
      </main>
    </div>
  );
}
