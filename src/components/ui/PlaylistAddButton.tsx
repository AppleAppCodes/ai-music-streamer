'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, ListPlus, Trash2 } from 'lucide-react';
import AddToPlaylistModal from './AddToPlaylistModal';

interface PlaylistAddButtonProps {
  songId: string;
  iconClassName?: string;
  className?: string;
  currentPlaylistId?: string;
  onRemoveFromCurrent?: () => void;
}

export default function PlaylistAddButton({ 
  songId, 
  iconClassName = "w-5 h-5", 
  className = "",
  currentPlaylistId,
  onRemoveFromCurrent
}: PlaylistAddButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center justify-center" ref={menuRef}>
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className={`text-white/40 hover:text-white transition-colors p-1 ${className}`}
        title="Mehr Optionen"
      >
        <MoreHorizontal className={iconClassName} />
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[#282828] rounded-md shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-white/5 overflow-hidden z-[100] py-1">
          <button 
            className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex items-center gap-3 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(false);
              setShowModal(true);
            }}
          >
            <ListPlus className="w-4 h-4 text-white/70" />
            Zur Playlist hinzufügen
          </button>
          
          {onRemoveFromCurrent && (
            <>
              <div className="h-px w-full bg-white/10 my-1"></div>
              <button 
                className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/10 flex items-center gap-3 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(false);
                  onRemoveFromCurrent();
                }}
              >
                <Trash2 className="w-4 h-4" />
                Aus Playlist entfernen
              </button>
            </>
          )}
        </div>
      )}

      {showModal && (
        <AddToPlaylistModal 
          songId={songId} 
          onClose={() => setShowModal(false)} 
          currentPlaylistId={currentPlaylistId}
          onRemoveFromCurrent={onRemoveFromCurrent}
        />
      )}
    </div>
  );
}
