import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BarChart3, CheckCircle2, Headphones, Library, Mic2, Music2, Radio, Sparkles } from 'lucide-react';

type SongLink = {
  id: string;
  title: string | null;
  artist_name: string | null;
  cover_url: string | null;
};

type LinkItem = {
  href: string;
  label: string;
  description: string;
};

export type SeoLandingPageContent = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLink: LinkItem;
  secondaryLink: LinkItem;
  introTitle: string;
  intro: string[];
  proofPoints: string[];
  sections: Array<{
    title: string;
    body: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  related: LinkItem[];
};

type SeoLandingPageProps = {
  content: SeoLandingPageContent;
  songs: SongLink[];
};

const iconClassName = 'h-5 w-5';

export default function SeoLandingPage({ content, songs }: SeoLandingPageProps) {
  return (
    <div className="min-h-full bg-[#07070a] pb-28 text-white">
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/brand/yoriax-og.png"
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,10,0.96),rgba(7,7,10,0.82)_48%,rgba(7,7,10,0.62))]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#07070a] to-transparent" />
        </div>

        <div className="relative mx-auto grid min-h-[min(720px,calc(100dvh-3.5rem))] max-w-7xl items-end gap-10 px-5 pb-14 pt-16 sm:px-8 md:px-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:pb-20 lg:pt-20">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-teal-200">
              <Sparkles className="h-4 w-4" />
              {content.eyebrow}
            </p>
            <h1 className="text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
              {content.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
              {content.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={content.primaryLink.href}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black transition-transform hover:scale-[1.02]"
              >
                {content.primaryLink.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={content.secondaryLink.href}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/14 bg-white/[0.06] px-6 text-sm font-black text-white transition-colors hover:bg-white/[0.1]"
              >
                {content.secondaryLink.label}
              </Link>
            </div>
          </div>

          <div className="hidden min-w-0 lg:block">
            <div className="grid grid-cols-2 gap-3">
              {songs.slice(0, 4).map((song, index) => (
                <Link
                  key={song.id}
                  href={`/song/${song.id}`}
                  className={`group relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] shadow-2xl ${index % 2 ? 'translate-y-8' : ''}`}
                >
                  {song.cover_url ? (
                    <Image
                      src={song.cover_url}
                      alt={song.title ?? 'YORIAX song'}
                      fill
                      sizes="260px"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Music2 className="h-12 w-12 text-white/25" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="truncate text-sm font-black text-white">{song.title ?? 'YORIAX Song'}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-white/58">{song.artist_name ?? 'YORIAX Artist'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-5 sm:px-8 md:px-10">
        <section className="grid gap-8 border-b border-white/8 py-14 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-200">YORIAX SEO Guide</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{content.introTitle}</h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-white/68">
            {content.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section className="grid gap-4 py-12 md:grid-cols-3">
          {content.proofPoints.map((point, index) => {
            const icons = [Radio, BarChart3, Library];
            const Icon = icons[index] ?? CheckCircle2;
            return (
              <div key={point} className="rounded-2xl border border-white/8 bg-white/[0.04] p-5">
                <Icon className={`${iconClassName} text-teal-200`} />
                <p className="mt-4 text-sm font-bold leading-6 text-white/78">{point}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 py-10 lg:grid-cols-3">
          {content.sections.map((section) => (
            <article key={section.title} className="min-h-52 rounded-2xl border border-white/8 bg-[#111116] p-6">
              <Headphones className="h-5 w-5 text-violet-200" />
              <h2 className="mt-5 text-xl font-black tracking-tight text-white">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-white/62">{section.body}</p>
            </article>
          ))}
        </section>

        {songs.length > 0 ? (
          <section className="py-12">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-200">Trending on YORIAX</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Popular AI music to start with</h2>
              </div>
              <Link href="/charts/viral" className="hidden text-sm font-black text-white/62 underline-offset-4 hover:text-white hover:underline sm:block">
                Viral charts
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {songs.slice(0, 6).map((song) => (
                <Link
                  key={song.id}
                  href={`/song/${song.id}`}
                  className="group min-w-0 rounded-2xl border border-white/8 bg-white/[0.035] p-3 transition-colors hover:bg-white/[0.07]"
                >
                  <div className="relative aspect-square overflow-hidden rounded-xl bg-white/5">
                    {song.cover_url ? (
                      <Image
                        src={song.cover_url}
                        alt={song.title ?? 'AI song on YORIAX'}
                        fill
                        sizes="180px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Music2 className="h-9 w-9 text-white/22" />
                      </div>
                    )}
                  </div>
                  <p className="mt-3 truncate text-sm font-black text-white">{song.title ?? 'YORIAX Song'}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-white/48">{song.artist_name ?? 'YORIAX Artist'}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-8 border-y border-white/8 py-14 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <Mic2 className="h-6 w-6 text-teal-200" />
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white">Questions people ask</h2>
          </div>
          <div className="grid gap-4">
            {content.faq.map((item) => (
              <article key={item.question} className="rounded-2xl border border-white/8 bg-white/[0.035] p-5">
                <h3 className="text-base font-black text-white">{item.question}</h3>
                <p className="mt-2 text-sm leading-7 text-white/62">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-14">
          <h2 className="text-2xl font-black tracking-tight text-white">Explore more AI music</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {content.related.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-white/8 bg-white/[0.035] p-5 transition-colors hover:bg-white/[0.07]"
              >
                <p className="flex items-center gap-2 text-sm font-black text-white">
                  {item.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </p>
                <p className="mt-2 text-sm leading-6 text-white/52">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
