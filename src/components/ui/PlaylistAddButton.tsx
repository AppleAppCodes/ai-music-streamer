'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
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
          currentPlaylistId={currentPlaylistId}
          onRemoveFromCurrent={onRemoveFromCurrent}
        />
      )}
    </>
  );
}
