'use client';

import { useState } from 'react';
import { MoreVertical, Share2, User2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Song } from '@/lib/types';
import LikeButton from './LikeButton';
import PlaylistAddButton from './PlaylistAddButton';
import Link from 'next/link';

export default function MobileSongMenu({ song }: { song: Song }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  const closeMenu = () => setIsOpen(false);

  const displayArtist = song.artist_name || 'Unbekannt';

  return (
    <div className="md:hidden">
      <button 
        onClick={handleClick}
        className="p-2 text-white/50 hover:text-white transition-colors flex items-center justify-center"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { e.stopPropagation(); closeMenu(); }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            />
            
            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-0 left-0 right-0 z-[101] bg-[#1a1a1a] rounded-t-3xl overflow-hidden pb-[calc(2rem+env(safe-area-inset-bottom))] border-t border-white/10"
            >
              {/* Drag handle */}
              <div className="w-full flex justify-center pt-3 pb-1">
                <div className="w-12 h-1.5 bg-white/20 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center gap-4 px-6 py-4 border-b border-white/5">
                <img src={song.cover_url} alt={song.title} className="w-14 h-14 rounded-md object-cover shadow-md" />
                <div className="flex flex-col min-w-0">
                  <span className="text-lg font-bold text-white truncate">{song.title}</span>
                  <span className="text-sm text-white/60 truncate">{displayArtist}</span>
                </div>
              </div>

              {/* Menu Items */}
              <div className="flex flex-col px-4 py-2">
                <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors">
                  <LikeButton songId={song.id} iconClassName="w-6 h-6" className="p-0 hover:bg-transparent" />
                  <span className="text-base font-medium text-white">Gefällt mir</span>
                </div>
                
                <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors">
                  <PlaylistAddButton songId={song.id} iconClassName="w-6 h-6" className="p-0 hover:bg-transparent bg-transparent" />
                  <span className="text-base font-medium text-white">Zur Playlist hinzufügen</span>
                </div>

                <Link 
                  href={`/artist/${encodeURIComponent(displayArtist)}`}
                  onClick={closeMenu}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <User2 className="w-6 h-6 text-white/70" />
                  <span className="text-base font-medium text-white">Künstler ansehen</span>
                </Link>

                <button 
                  onClick={() => {
                    const url = `${window.location.origin}/song/${song.id}`;
                    if (navigator.share) {
                      navigator.share({ title: song.title, url });
                    } else {
                      navigator.clipboard.writeText(url);
                    }
                    closeMenu();
                  }}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-left"
                >
                  <Share2 className="w-6 h-6 text-white/70" />
                  <span className="text-base font-medium text-white">Teilen</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
