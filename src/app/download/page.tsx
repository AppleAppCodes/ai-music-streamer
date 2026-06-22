'use client';

import { Download, Monitor, Zap, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function DownloadPage() {

  return (
    <div className="yoriax-page flex-1 overflow-y-auto pb-32">
      {/* Hero Section similar to the screenshot */}
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24 mt-10">
        <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-primary to-accent shadow-2xl">
          {/* Glass Overlay for depth */}
          <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px] pointer-events-none"></div>

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between p-10 md:p-16 lg:p-20 gap-12">
            
            {/* Text Content */}
            <div className="flex-1 max-w-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center shadow-lg">
                  <Monitor className="w-5 h-5 text-white" />
                </div>
                <span className="text-black font-black text-xl tracking-tight">YORIAX Desktop</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl font-black text-black tracking-tighter mb-6 leading-[1.1]">
                Lade YORIAX für Mac herunter
              </h1>
              
              <p className="text-lg md:text-xl text-black/80 font-medium mb-10 leading-relaxed">
                Genieße hochwertiges Audio, blitzschnelle Ladezeiten und nahtlose Integration auf deinem Computer. Entdecke neue Künstler und speichere deine Lieblingssongs direkt auf deinem Gerät.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  href="/download/mac"
                  className="inline-flex items-center justify-center gap-3 bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:scale-105 hover:bg-gray-50 transition-all shadow-xl w-full sm:w-auto"
                >
                  <Download className="w-5 h-5" />
                  Für Mac laden
                </Link>
                <Link 
                  href="/download/windows"
                  className="inline-flex items-center justify-center gap-3 bg-black/30 backdrop-blur-sm border border-white/20 text-white px-8 py-4 rounded-full font-bold text-lg hover:scale-105 hover:bg-black/50 transition-all shadow-xl w-full sm:w-auto"
                >
                  <Download className="w-5 h-5" />
                  Für PC laden
                </Link>
              </div>
            </div>
            
            {/* CSS Laptop Mockup */}
            <div className="flex-1 w-full max-w-2xl relative perspective-1000">
              <div className="relative w-full aspect-[16/10] bg-black rounded-t-3xl border-8 border-gray-800 shadow-2xl flex flex-col overflow-hidden transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-y-0 hover:rotate-x-0 transition-transform duration-700">
                {/* Mac Window Controls */}
                <div className="h-6 w-full bg-[#1A1A1A] flex items-center px-4 gap-2 shrink-0 border-b border-white/10">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]"></div>
                </div>
                {/* App UI Representation */}
                <div className="flex-1 w-full bg-[#050505] p-4 flex gap-4">
                  <div className="w-1/4 h-full bg-[#111] rounded-xl border border-white/5 flex flex-col p-3 gap-3">
                    <div className="w-full h-8 bg-white/10 rounded-lg"></div>
                    <div className="w-3/4 h-4 bg-white/5 rounded mt-4"></div>
                    <div className="w-1/2 h-4 bg-white/5 rounded"></div>
                    <div className="w-2/3 h-4 bg-white/5 rounded"></div>
                  </div>
                  <div className="flex-1 h-full flex flex-col gap-4">
                    <div className="h-32 w-full rounded-xl border border-white/5 bg-gradient-to-r from-primary/20 to-accent/15"></div>
                    <div className="flex gap-3">
                      <div className="flex-1 aspect-square bg-[#111] rounded-xl border border-white/5"></div>
                      <div className="flex-1 aspect-square bg-[#111] rounded-xl border border-white/5"></div>
                      <div className="flex-1 aspect-square bg-[#111] rounded-xl border border-white/5"></div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Laptop Base */}
              <div className="relative w-[110%] -left-[5%] h-6 bg-gray-300 rounded-b-2xl rounded-t-sm shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex justify-center transform rotate-y-[-5deg] rotate-x-[5deg] hover:rotate-y-0 hover:rotate-x-0 transition-transform duration-700">
                <div className="w-1/4 h-1 bg-gray-400 rounded-b-lg mt-0.5"></div>
              </div>
            </div>

          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
          <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-6">
              <Zap className="w-8 h-8 fill-primary/50" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Musik auf Knopfdruck</h3>
            <p className="text-white/60">Egal ob Hits oder Geheimtipps – deine Lieblingsmusik startet sofort. Kein lästiges Warten, einfach direkt im Takt bleiben.</p>
          </div>
          
          <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center mb-6">
              <Monitor className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Nahtlose Integration</h3>
            <p className="text-white/60">Egal ob Mac oder Windows-PC, YORIAX fügt sich perfekt ein. Steuere die Wiedergabe ganz einfach über die Medientasten deiner Tastatur.</p>
          </div>
          
          <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/5 border border-white/10">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary-light">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Sicheres Streaming</h3>
            <p className="text-white/60">Tauche ein in eine Welt ohne Sorgen. Wir sorgen für automatische Updates im Hintergrund, damit du dich aufs Wesentliche konzentrieren kannst: die Musik.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
