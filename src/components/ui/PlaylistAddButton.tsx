'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, ListPlus, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import AddToPlaylistModal from './AddToPlaylistModal';
import { createClient } from '@/utils/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import { compressImage } from '@/lib/imageCompression';
import { isAdminUser } from '@/lib/admin';
import { uploadSongCover } from '@/lib/song-cover-upload';

interface PlaylistAddButtonProps {
  songId: string;
  iconClassName?: string;
  className?: string;
  currentPlaylistId?: string;
  onRemoveFromCurrent?: () => void;
  openUpwards?: boolean;
}

export default function PlaylistAddButton({ 
  songId, 
  iconClassName = "w-5 h-5", 
  className = "",
  currentPlaylistId,
  onRemoveFromCurrent,
  openUpwards = false
}: PlaylistAddButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAdmin(isAdminUser(data.session?.user));
    });
  }, [supabase]);

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
        <div className={`yoriax-card absolute right-0 ${openUpwards ? 'bottom-full mb-1' : 'top-full mt-1'} z-[100] w-56 overflow-hidden rounded-xl py-1`}>
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
          
          {isAdmin && (
            <>
              <div className="h-px w-full bg-white/10 my-1"></div>
              <button 
                className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex items-center gap-3 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowMenu(false);
                  fileInputRef.current?.click();
                }}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4 text-white/70" />}
                Cover ändern
              </button>
            </>
          )}

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

      {isAdmin && (
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={async (e) => {
            let file = e.target.files?.[0];
            if (!file) return;
            setIsUploading(true);
            try {
              file = await compressImage(file);
              await uploadSongCover(songId, file);
              window.location.reload();
            } catch (err) {
              console.error(err);
              alert('Fehler beim Hochladen: ' + getErrorMessage(err));
            } finally {
              setIsUploading(false);
            }
          }}
        />
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
