'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { emitLikedSongChange, getLikedSongChangeDetail, LIKED_SONG_CHANGE_EVENT } from '@/lib/liked-song-events';

interface LikeButtonProps {
  songId: string;
  className?: string;
  iconClassName?: string;
}

export default function LikeButton({ songId, className = '', iconClassName = 'w-6 h-6' }: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    let isActive = true;

    const checkLikeStatus = async () => {
      setLoading(true);
      setIsLiked(false);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (isActive) {
          setUserId(null);
          setLoading(false);
        }
        return;
      }
      
      if (isActive) setUserId(session.user.id);
      
      const { data } = await supabase
        .from('liked_songs')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('song_id', songId)
        .limit(1);
        
      if (isActive) {
        setIsLiked(Boolean(data?.length));
        setLoading(false);
      }
    };

    checkLikeStatus();

    return () => {
      isActive = false;
    };
  }, [songId, supabase]);

  useEffect(() => {
    const handleLikedSongChange = (event: Event) => {
      const detail = getLikedSongChangeDetail(event);
      if (!detail || detail.songId !== songId) return;
      setIsLiked(detail.isLiked);
      setLoading(false);
    };

    window.addEventListener(LIKED_SONG_CHANGE_EVENT, handleLikedSongChange);
    return () => window.removeEventListener(LIKED_SONG_CHANGE_EVENT, handleLikedSongChange);
  }, [songId]);

  const toggleLike = async () => {
    if (!userId) {
      router.push('/login');
      return;
    }
    
    // Optimistic UI update
    const newStatus = !isLiked;
    setIsLiked(newStatus);
    emitLikedSongChange(songId, newStatus);
    
    if (newStatus) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300); // Remove animation class after 300ms
      
      const { error } = await supabase
        .from('liked_songs')
        .insert({ user_id: userId, song_id: songId });
        
      if (error && error.code !== '23505') {
        setIsLiked(false); // Revert on error
        emitLikedSongChange(songId, false);
        console.error('Error liking song:', error);
      }
    } else {
      const { error } = await supabase
        .from('liked_songs')
        .delete()
        .eq('user_id', userId)
        .eq('song_id', songId);
        
      if (error) {
        setIsLiked(true); // Revert on error
        emitLikedSongChange(songId, true);
        console.error('Error unliking song:', error);
      }
    }
  };

  return (
    <button 
      onClick={toggleLike}
      disabled={loading}
      className={`transition-all duration-300 active:scale-75 ${isLiked ? 'text-primary-light' : 'text-white/60 hover:text-white'} ${isAnimating ? 'scale-125' : 'scale-100'} ${className}`}
      title={isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
    >
      {isLiked ? (
        <CheckCircle2 className={`${iconClassName} transition-all duration-300 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]`} strokeWidth={2.5} />
      ) : (
        <PlusCircle className={`${iconClassName} transition-all duration-300`} strokeWidth={2} />
      )}
    </button>
  );
}
