'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User, ExternalLink } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/admin';
import { notifyPlayerForceSignOut } from '@/lib/player-events';
import Image from 'next/image';

interface ProfileDropdownProps {
  user: SupabaseUser;
  signOutAction: () => Promise<void>;
}

export default function ProfileDropdown({ user, signOutAction }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAdmin = isAdminUser(user);

  // Extract avatar and username from user metadata, fallback to empty
  const avatarUrl = user?.user_metadata?.avatar_url || '';
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/30 hover:border-purple-500 transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50"
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt={username} width={32} height={32} className="h-full w-full object-cover" />
        ) : (
          <div className="w-full h-full bg-purple-900/40 flex items-center justify-center text-purple-300">
            <User className="w-4 h-4" />
          </div>
        )}
      </button>

      {isOpen && (
        <div className="yoriax-card absolute right-0 z-50 mt-3 w-56 overflow-hidden rounded-2xl py-2 text-sm text-white animate-in fade-in slide-in-from-top-2 duration-200">
          <Link 
            href="/settings#konto" 
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            <span>Konto</span>
            <ExternalLink className="w-4 h-4 opacity-50" />
          </Link>
          
          <Link 
            href="/settings#profil" 
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2.5 mx-2 rounded-lg hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            Profil
          </Link>

          <Link
            href="mailto:apply@yoriax.com?subject=Bewerbung%20als%20KI-Künstler%20bei%20Yoriax" 
            onClick={() => setIsOpen(false)}
            className="mx-2 mt-1 flex items-center justify-between rounded-lg border border-primary-light/20 bg-gradient-to-r from-primary/25 to-accent/10 px-4 py-2.5 font-bold text-primary-light transition-all hover:from-primary/35 hover:to-accent/15"
          >
            <span>Als Künstler bewerben</span>
            <ExternalLink className="w-4 h-4 opacity-70" />
          </Link>

          {/* Admin Link */}
          {isAdmin && (
            <Link 
              href="/admin" 
              onClick={() => setIsOpen(false)}
              className="mx-2 flex items-center justify-between rounded-lg px-4 py-2.5 font-semibold text-primary-light transition-colors hover:bg-primary/20"
            >
              <span>Admin Dashboard</span>
            </Link>
          )}

          <Link 
            href="#" 
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            <span>Support</span>
            <ExternalLink className="w-4 h-4 opacity-50" />
          </Link>


          <Link 
            href="/settings#einstellungen" 
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2.5 mx-2 rounded-lg hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            Einstellungen
          </Link>

          <div className="h-px bg-purple-500/20 my-2 mx-4" />

          <Link
            href="/impressum"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2.5 mx-2 rounded-lg text-white/60 hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            Impressum
          </Link>

          <Link
            href="/datenschutz"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2.5 mx-2 rounded-lg text-white/60 hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            Datenschutz
          </Link>

          <Link
            href="/agb"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2.5 mx-2 rounded-lg text-white/60 hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            AGB
          </Link>

          <div className="h-px bg-purple-500/20 my-2 mx-4" />

          <form action={signOutAction} onSubmitCapture={notifyPlayerForceSignOut}>
            <button 
              type="submit" 
              onPointerDown={notifyPlayerForceSignOut}
              onClick={notifyPlayerForceSignOut}
              className="w-[calc(100%-1rem)] text-left px-4 py-2.5 mx-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            >
              Abmelden
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
