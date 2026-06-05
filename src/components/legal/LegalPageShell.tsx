import Link from 'next/link';
import type { ReactNode } from 'react';

interface LegalPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export default function LegalPageShell({ eyebrow, title, description, children }: LegalPageShellProps) {
  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.22),transparent_34%),linear-gradient(180deg,rgba(10,8,24,0.96),#050505_42%)] px-5 py-10 text-white md:px-12 md:py-16">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/60 transition hover:border-purple-300/40 hover:text-white"
        >
          Zurück zu YORIAX
        </Link>

        <div className="mt-10 rounded-[2rem] border border-white/10 bg-black/35 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-teal-200">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-6xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/58 md:text-lg">{description}</p>
        </div>

        <div className="legal-content mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 text-white/72 backdrop-blur md:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}
