'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { User, LogOut, Settings, ExternalLink, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ProfileDropdownProps {
  user: any;
  signOutAction: () => Promise<void>;
}

export default function ProfileDropdown({ user, signOutAction }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // Extract avatar and username from user metadata, fallback to defaults
  const avatarUrl = user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80';
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
        <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-56 bg-black/80 backdrop-blur-xl text-white rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.15)] z-50 border border-purple-500/20 py-2 text-sm animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden">
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
            href="#" 
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2.5 mx-2 rounded-lg hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            Zuletzt
          </Link>

          <Link 
            href="#" 
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            <span>Support</span>
            <ExternalLink className="w-4 h-4 opacity-50" />
          </Link>

          <button 
            onClick={() => setIsOpen(false)}
            className="w-[calc(100%-1rem)] text-left px-4 py-2.5 mx-2 rounded-lg hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            Private Session
          </button>

          <Link 
            href="/settings#einstellungen" 
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2.5 mx-2 rounded-lg hover:bg-purple-500/10 hover:text-purple-300 transition-colors"
          >
            Einstellungen
          </Link>

          <div className="h-px bg-purple-500/20 my-2 mx-4" />

          <form action={signOutAction}>
            <button 
              type="submit" 
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
