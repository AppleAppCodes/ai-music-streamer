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
        <div className="absolute right-0 mt-2 w-56 bg-[#282828] text-white rounded-md shadow-2xl z-50 border border-white/10 py-1 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <Link 
            href="/settings" 
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between px-4 py-3 hover:bg-white/10 transition-colors"
          >
            <span>Konto</span>
            <ExternalLink className="w-4 h-4 text-white/50" />
          </Link>
          
          <Link 
            href="/settings" 
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 hover:bg-white/10 transition-colors"
          >
            Profil
          </Link>

          <Link 
            href="#" 
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 hover:bg-white/10 transition-colors"
          >
            Zuletzt
          </Link>

          <Link 
            href="#" 
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-between px-4 py-3 hover:bg-white/10 transition-colors"
          >
            <span>Support</span>
            <ExternalLink className="w-4 h-4 text-white/50" />
          </Link>

          <button 
            onClick={() => setIsOpen(false)}
            className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors"
          >
            Private Session
          </button>

          <Link 
            href="/settings" 
            onClick={() => setIsOpen(false)}
            className="block px-4 py-3 hover:bg-white/10 transition-colors"
          >
            Einstellungen
          </Link>

          <div className="h-px bg-white/10 my-1 mx-2" />

          <form action={signOutAction}>
            <button 
              type="submit" 
              className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors"
            >
              Abmelden
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
