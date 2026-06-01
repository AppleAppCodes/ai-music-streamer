'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Clock3,
  Loader2,
  Music2,
  Pause,
  Play,
  Radio,
  Search,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { Song } from '@/lib/types';
import { usePlayer } from '@/lib/player-context';
import { createClient } from '@/utils/supabase/client';

const LIVE_WINDOW_MS = 75_000;

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

interface FriendProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  last_active_at: string | null;
}

interface ListeningActivity {
  user_id: string;
  song_id: string | null;
  is_playing: boolean;
  progress_seconds: number;
  updated_at: string;
}

interface FriendFeedItem extends FriendProfile {
  friendshipId: string;
  activity?: ListeningActivity;
  song?: Song;
}

interface PendingFriendship extends Friendship {
  profile?: FriendProfile;
}

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

function isLive(activity?: ListeningActivity) {
  if (!activity?.is_playing) return false;
  return Date.now() - new Date(activity.updated_at).getTime() < LIVE_WINDOW_MS;
}

function formatRelativeTime(value?: string | null) {
  if (!value) return 'Noch keine Aktivität';

  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Gerade eben';
  if (seconds < 3600) return `Vor ${Math.floor(seconds / 60)} Min.`;
  if (seconds < 86400) return `Vor ${Math.floor(seconds / 3600)} Std.`;
  return `Vor ${Math.floor(seconds / 86400)} Tagen`;
}

function Avatar({ profile, className = 'h-12 w-12' }: { profile?: FriendProfile; className?: string }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt={profile.username} className={`${className} rounded-full object-cover`} />;
  }

  return (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-black text-white`}>
      {getInitials(profile?.username || '?')}
    </div>
  );
}

export default function FriendsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { currentSong, isPlaying, playSong, togglePlayPause } = usePlayer();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendFeedItem[]>([]);
  const [incoming, setIncoming] = useState<PendingFriendship[]>([]);
  const [outgoing, setOutgoing] = useState<PendingFriendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const loadFriendFeed = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/login');
      return;
    }

    setCurrentUserId(session.user.id);

    const { data: friendshipRows, error: friendshipError } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`)
      .order('updated_at', { ascending: false });

    if (friendshipError) {
      setNotice('Der Friend Feed konnte nicht geladen werden.');
      setLoading(false);
      return;
    }

    const friendships = (friendshipRows || []) as Friendship[];
    const relatedProfileIds = Array.from(new Set(friendships.map((friendship) => (
      friendship.requester_id === session.user.id ? friendship.addressee_id : friendship.requester_id
    ))));

    let profiles: FriendProfile[] = [];
    if (relatedProfileIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, last_active_at')
        .in('id', relatedProfileIds);
      profiles = (data || []) as FriendProfile[];
    }

    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const accepted = friendships.filter((friendship) => friendship.status === 'accepted');
    const acceptedProfileIds = accepted.map((friendship) => (
      friendship.requester_id === session.user.id ? friendship.addressee_id : friendship.requester_id
    ));

    let activities: ListeningActivity[] = [];
    if (acceptedProfileIds.length > 0) {
      const { data } = await supabase
        .from('listening_activity')
        .select('user_id, song_id, is_playing, progress_seconds, updated_at')
        .in('user_id', acceptedProfileIds);
      activities = (data || []) as ListeningActivity[];
    }

    const activityByUserId = new Map(activities.map((activity) => [activity.user_id, activity]));
    const activeSongIds = Array.from(new Set(activities.flatMap((activity) => activity.song_id ? [activity.song_id] : [])));
    let songs: Song[] = [];
    if (activeSongIds.length > 0) {
      const { data } = await supabase.from('songs').select('*').in('id', activeSongIds);
      songs = (data || []) as Song[];
    }
    const songById = new Map(songs.map((song) => [song.id, song]));

    const nextFriends = accepted.flatMap((friendship) => {
      const friendId = friendship.requester_id === session.user.id ? friendship.addressee_id : friendship.requester_id;
      const profile = profileById.get(friendId);
      if (!profile) return [];
      const activity = activityByUserId.get(friendId);
      return [{
        ...profile,
        friendshipId: friendship.id,
        activity,
        song: activity?.song_id ? songById.get(activity.song_id) : undefined,
      }];
    }).sort((a, b) => Number(isLive(b.activity)) - Number(isLive(a.activity)));

    const addProfile = (friendship: Friendship): PendingFriendship => {
      const profileId = friendship.requester_id === session.user.id ? friendship.addressee_id : friendship.requester_id;
      return { ...friendship, profile: profileById.get(profileId) };
    };

    setFriends(nextFriends);
    setIncoming(friendships.filter((friendship) => friendship.status === 'pending' && friendship.addressee_id === session.user.id).map(addProfile));
    setOutgoing(friendships.filter((friendship) => friendship.status === 'pending' && friendship.requester_id === session.user.id).map(addProfile));
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFriendFeed();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadFriendFeed]);

  useEffect(() => {
    const channel = supabase
      .channel('friend-feed-listening-activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listening_activity' }, () => {
        void loadFriendFeed();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadFriendFeed, supabase]);

  const searchProfiles = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query || !currentUserId) return;

    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, last_active_at')
      .ilike('username', `%${query}%`)
      .neq('id', currentUserId)
      .limit(8);
    setSearchResults((data || []) as FriendProfile[]);
    setSearching(false);
  };

  const sendFriendRequest = async (profile: FriendProfile) => {
    if (!currentUserId) return;

    const { error } = await supabase.from('friendships').insert({
      requester_id: currentUserId,
      addressee_id: profile.id,
      status: 'pending',
    });

    setNotice(error?.code === '23505' ? 'Zwischen euch gibt es bereits eine Anfrage oder Freundschaft.' : error ? 'Anfrage konnte nicht gesendet werden.' : `Anfrage an ${profile.username} gesendet.`);
    if (!error) {
      setSearchResults((results) => results.filter((result) => result.id !== profile.id));
      await loadFriendFeed();
    }
  };

  const updateFriendship = async (friendshipId: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase
      .from('friendships')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', friendshipId);
    setNotice(error ? 'Anfrage konnte nicht aktualisiert werden.' : status === 'accepted' ? 'Freundschaft bestätigt.' : 'Anfrage abgelehnt.');
    if (!error) await loadFriendFeed();
  };

  const removeFriendship = async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    setNotice(error ? 'Freundschaft konnte nicht entfernt werden.' : 'Freundschaft entfernt.');
    if (!error) await loadFriendFeed();
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-[#080808] px-6 pb-36 pt-14 md:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.24),transparent_48%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_38%)]" />
      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">
            <Radio className="h-4 w-4" />
            Social Listening
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">Friend Feed</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50 md:text-base">
            Sieh live, was deine Freunde hören, starte ihre Songs direkt und bleib bei neuen Entdeckungen auf dem Laufenden.
          </p>
        </header>

        <section className="mb-10 rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-xl md:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-white">Freunde finden</h2>
              <p className="text-xs text-white/45">Suche nach dem Nutzernamen und sende eine Anfrage.</p>
            </div>
          </div>
          <form onSubmit={searchProfiles} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Nutzername suchen"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/25 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-violet-400/70"
              />
            </div>
            <button type="submit" className="flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-black transition-colors hover:bg-white/85">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Suchen
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {searchResults.map((profile) => (
                <div key={profile.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3">
                  <Avatar profile={profile} className="h-10 w-10" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{profile.username}</span>
                  <button onClick={() => void sendFriendRequest(profile)} className="rounded-full bg-violet-500/15 p-2 text-violet-200 transition-colors hover:bg-violet-500/30" aria-label={`Anfrage an ${profile.username} senden`}>
                    <UserPlus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {notice && <p className="mt-3 text-xs text-white/55">{notice}</p>}
        </section>

        {incoming.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-bold text-white">Offene Anfragen</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {incoming.map((friendship) => (
                <div key={friendship.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <Avatar profile={friendship.profile} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-white">{friendship.profile?.username || 'Nutzer'}</p>
                    <p className="text-xs text-white/45">möchte sich mit dir verbinden</p>
                  </div>
                  <button onClick={() => void updateFriendship(friendship.id, 'accepted')} className="rounded-full bg-emerald-400/15 p-2 text-emerald-300 hover:bg-emerald-400/25" aria-label="Anfrage annehmen">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => void updateFriendship(friendship.id, 'declined')} className="rounded-full bg-white/5 p-2 text-white/55 hover:bg-white/10 hover:text-white" aria-label="Anfrage ablehnen">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-white">Was deine Freunde hören</h2>
              <p className="mt-1 text-sm text-white/45">Live-Aktivitäten erscheinen automatisch.</p>
            </div>
            {friends.length > 0 && <span className="text-xs font-bold uppercase tracking-wider text-white/35">{friends.length} Freunde</span>}
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-16 text-sm text-white/45">
              <Loader2 className="h-5 w-5 animate-spin" />
              Friend Feed wird geladen
            </div>
          ) : friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.025] px-6 py-20 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
                <UsersRound className="h-9 w-9 text-white/25" />
              </div>
              <h3 className="text-xl font-bold text-white">Dein Feed ist noch leer</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-white/45">Finde oben Freunde. Sobald ihr verbunden seid, erscheinen hier ihre aktuellen und zuletzt gehörten Songs.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {friends.map((friend) => {
                const live = isLive(friend.activity);
                const song = friend.song;
                const playingThisSong = song && currentSong?.id === song.id && isPlaying;
                const displayArtist = song?.artist_name || song?.creatorName || 'Creator';
                return (
                  <article key={friend.id} className={`group relative overflow-hidden rounded-2xl border bg-white/[0.045] p-4 transition-colors hover:bg-white/[0.075] ${live ? 'border-emerald-400/25' : 'border-white/10'}`}>
                    {live && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.12),transparent_48%)]" />}
                    <div className="relative mb-4 flex items-center gap-3">
                      <Avatar profile={friend} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-white">{friend.username}</p>
                        <p className="flex items-center gap-1.5 text-xs text-white/45">
                          {live ? <><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Hört gerade live</> : <><Clock3 className="h-3.5 w-3.5" /> {formatRelativeTime(friend.activity?.updated_at || friend.last_active_at)}</>}
                        </p>
                      </div>
                      <button onClick={() => void removeFriendship(friend.friendshipId)} className="rounded-full p-2 text-white/25 opacity-0 transition-all hover:bg-white/10 hover:text-white group-hover:opacity-100" aria-label={`Freundschaft mit ${friend.username} entfernen`}>
                        <UserMinus className="h-4 w-4" />
                      </button>
                    </div>

                    {song ? (
                      <div className="relative flex items-center gap-3 rounded-xl bg-black/25 p-3">
                        {song.cover_url ? <img src={song.cover_url} alt={song.title} className="h-14 w-14 rounded-lg object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/5"><Music2 className="h-5 w-5 text-white/30" /></div>}
                        <div className="min-w-0 flex-1">
                          <Link href={`/song/${song.id}`} className="block truncate text-sm font-bold text-white hover:underline">{song.title}</Link>
                          <Link href={`/artist/${encodeURIComponent(displayArtist)}`} className="block truncate text-xs text-white/45 transition-colors hover:text-white hover:underline">{displayArtist}</Link>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/30">{live ? 'Jetzt aktiv' : 'Zuletzt gehört'}</p>
                        </div>
                        <button
                          onClick={() => playingThisSong ? togglePlayPause() : playSong({ ...song, creatorName: displayArtist })}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
                          aria-label={playingThisSong ? 'Pausieren' : 'Song abspielen'}
                        >
                          {playingThisSong ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                        </button>
                      </div>
                    ) : (
                      <div className="relative flex items-center gap-3 rounded-xl bg-black/20 p-4 text-sm text-white/35">
                        <Music2 className="h-4 w-4" />
                        Noch keine Höraktivität
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {outgoing.length > 0 && (
          <section className="mt-10 border-t border-white/5 pt-7">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/40">Gesendete Anfragen</h2>
            <div className="flex flex-wrap gap-2">
              {outgoing.map((friendship) => (
                <div key={friendship.id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] py-1.5 pl-2 pr-3 text-xs text-white/60">
                  <Avatar profile={friendship.profile} className="h-6 w-6" />
                  {friendship.profile?.username || 'Nutzer'}
                  <button onClick={() => void removeFriendship(friendship.id)} className="text-white/35 hover:text-white" aria-label="Anfrage zurückziehen">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
