'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import AddToPlaylistModal from './AddToPlaylistModal';

interface PlaylistAddButtonProps {
  songId: string;
  iconClassName?: string;
  className?: string;
}

export default function PlaylistAddButton({ songId, iconClassName = "w-5 h-5", className = "" }: PlaylistAddButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowModal(true);
        }}
        className={`text-white/40 hover:text-white transition-colors hover:scale-110 ${className}`}
        title="Zur Playlist hinzufügen"
      >
        <Plus className={iconClassName} />
      </button>

      {showModal && (
        <AddToPlaylistModal 
          songId={songId} 
          onClose={() => setShowModal(false)} 
        />
      )}
    </>
  );
}
