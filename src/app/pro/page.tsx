'use client';

import { useState } from 'react';
import { CheckCircle2, Zap, Sparkles, AudioWaveform, ArrowRight, ShieldCheck, Headphones } from 'lucide-react';
import Link from 'next/link';

export default function ProPricingPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Ein Fehler ist aufgetreten. Bitte versuche es später erneut.');
      }
    } catch (err) {
      console.error(err);
      alert('Netzwerkfehler. Bitte versuche es später erneut.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-6 bg-gradient-to-br from-black via-zinc-900 to-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-500/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="z-10 text-center max-w-3xl mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold tracking-wide uppercase mb-6">
          <Headphones className="w-4 h-4" />
          Das ultimative Hörerlebnis
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 mb-6 font-syncopate">
          Erlebe Musik ohne Grenzen.
        </h1>
        <p className="text-xl text-white/60 leading-relaxed max-w-2xl mx-auto">
          Unterstütze die Plattform und genieße exklusive Vorteile. Mit <strong className="text-white">YORIAX Pro</strong> holst du das Maximum aus deinem Streaming-Erlebnis heraus.
        </p>
      </div>

      <div className="z-10 w-full max-w-lg">
        <div className="relative rounded-3xl p-1 bg-gradient-to-b from-indigo-500/50 to-purple-500/50">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/20 to-purple-500/20 blur-xl -z-10" />
          
          <div className="bg-zinc-950/90 backdrop-blur-xl rounded-[22px] p-8 md:p-10 border border-white/10">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">YORIAX Pro</h2>
                <p className="text-white/50 text-sm">Jederzeit kündbar.</p>
              </div>
              <div className="text-right">
                <span className="text-4xl font-black text-white">4,99€</span>
                <span className="text-white/50"> / Monat</span>
              </div>
            </div>

            <div className="space-y-4 mb-10">
              <Feature text="Unbegrenztes, werbefreies Streaming" />
              <Feature text="Songs herunterladen (MP3) & offline hören" />
              <Feature text="Exklusiver Zugang zu Premium-Playlists" />
              <Feature text="Unterstütze die Entwicklung von YORIAX" />
              <Feature text="Premium-Badge an deinem Profil" />
            </div>

            <button
              onClick={handleSubscribe}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-white text-black font-bold text-lg hover:bg-zinc-200 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Jetzt Pro holen
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            <p className="text-center text-xs text-white/40 mt-4 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Sichere Zahlung über Stripe
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <CheckCircle2 className="w-3 h-3 text-indigo-400" />
      </div>
      <span className="text-white/80 font-medium">{text}</span>
    </div>
  );
}
