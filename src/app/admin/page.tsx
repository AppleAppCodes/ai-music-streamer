'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ShieldAlert, Users, Music, Search, ArrowLeft, Radio, Terminal, Play, Heart, Activity, UserPlus, Sparkles, TrendingUp, BellRing, Mic } from 'lucide-react';
import Link from 'next/link';
import { isAdminUser, isModUser } from '@/lib/admin';
import { UsersTab } from './tabs/UsersTab';
import { SongsTab } from './tabs/SongsTab';
import { ApprovalsTab } from './tabs/ApprovalsTab';
import { ModerationTab } from './tabs/ModerationTab';
import { AdsTab } from './tabs/AdsTab';
import { SpotlightTab } from './tabs/SpotlightTab';
import { BotTab } from './tabs/BotTab';
import { AnalyticsTab, type RetentionCohortRow } from './tabs/AnalyticsTab';
import { PushTab } from './tabs/PushTab';
import { ArtistsTab, type ArtistPerformanceRow } from './tabs/ArtistsTab';
import {
  createSlug,
  readAudioFileDuration,
  toAdminNumber,
  type AdminTab,
  type AdFile,
  type HighlightNewsForm,
  type McpLog,
  type MetricsDailyRow,
  type NewsPostData,
  type ProfileData,
  type Report,
  type SongData,
  type SongPerformanceRow,
} from './types';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isFullAdmin, setIsFullAdmin] = useState(false);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [songs, setSongs] = useState<SongData[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUploadingAd, setIsUploadingAd] = useState(false);
  const [uploadAdStatus, setUploadAdStatus] = useState<string | null>(null);
  const [adFiles, setAdFiles] = useState<AdFile[]>([]);
  const [isReplacingAudio, setIsReplacingAudio] = useState<string | null>(null);
  const [mcpLogs, setMcpLogs] = useState<McpLog[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<MetricsDailyRow[]>([]);
  const [dailyStarts, setDailyStarts] = useState<Array<{ day: string; starts: number }>>([]);
  const [retentionCohorts, setRetentionCohorts] = useState<RetentionCohortRow[]>([]);
  const [artistPerformance, setArtistPerformance] = useState<ArtistPerformanceRow[]>([]);
  const [liveConnected, setLiveConnected] = useState(false);
  const [spotlightArtists, setSpotlightArtists] = useState<Array<{ artist_name: string; is_spotlight: boolean }>>([]);
  const [spotlightPlaylists, setSpotlightPlaylists] = useState<Array<{ id: string; title: string; is_spotlight: boolean }>>([]);
  const [spotlightSaving, setSpotlightSaving] = useState<'artist' | 'playlist' | null>(null);
  const [officialOrder, setOfficialOrder] = useState<Array<{ id: string; title: string }>>([]);
  const [savingOfficialOrder, setSavingOfficialOrder] = useState(false);
  const [trendingPicks, setTrendingPicks] = useState<Array<{ id: string; title: string; artist_name: string }>>([]);
  const [trendingSearch, setTrendingSearch] = useState('');
  const [savingTrending, setSavingTrending] = useState(false);
  const [highlightNews, setHighlightNews] = useState<HighlightNewsForm>({
    id: null,
    enabled: false,
    slug: '',
    title: '',
    body: '',
    imageUrl: '',
    ctaLabel: '',
    ctaUrl: '',
  });
  const [savingHighlightNews, setSavingHighlightNews] = useState(false);
  const [newsPosts, setNewsPosts] = useState<NewsPostData[]>([]);
  const [isUploadingNewsImage, setIsUploadingNewsImage] = useState(false);
  const [uploadNewsImageStatus, setUploadNewsImageStatus] = useState<string | null>(null);
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);

  // Analytics
  const [totalStreams, setTotalStreams] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [dailyActiveUsers, setDailyActiveUsers] = useState(0);

  // Ad Settings
  const [adFrequency, setAdFrequency] = useState(3);
  const [isSavingAdFreq, setIsSavingAdFreq] = useState(false);


  const supabase = createClient();

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        router.push('/login');
        return;
      }

      if (!isModUser(user)) {
        router.push('/');
        return;
      }

      const adminCheck = isAdminUser(user);
      setIsAuthorized(true);
      setIsFullAdmin(adminCheck);

      if (!adminCheck) {
        setActiveTab('moderation');
      }

      if (adminCheck) {
        // Load Users via an admin-only SECURITY DEFINER RPC. Profile email /
        // account-state columns are no longer readable by the browser client
        // directly; the function self-authorizes via is_admin().
        const [{ data: usersData, error: usersError }, { data: engagementData, error: engagementError }] = await Promise.all([
          supabase.rpc('get_admin_user_list'),
          supabase.rpc('get_admin_user_engagement'),
        ]);
        if (engagementError) {
          // Surface instead of silently rendering all-zero engagement columns.
          console.error('Failed to load user engagement:', engagementError);
        }
        if (usersError) {
          console.error('Failed to load admin users:', usersError);
        } else if (usersData) {
          type EngagementRow = { user_id: string; songs_played: number; total_plays: number; last_played_at: string | null; likes: number; follows: number; playlists: number; favorite_genres: string[] | null; onboarding_skipped: boolean | null };
          const engagementById = new Map<string, EngagementRow>(
            ((engagementData as EngagementRow[]) || []).map((e) => [e.user_id, e]),
          );
          const rows = (usersData as ProfileData[]).map((u) => {
            const e = engagementById.get(u.id);
            return e
              ? { ...u, songs_played: e.songs_played, total_plays: e.total_plays, last_played_at: e.last_played_at, likes: e.likes, follows: e.follows, playlists: e.playlists, favorite_genres: e.favorite_genres, onboarding_skipped: e.onboarding_skipped }
              : u;
          });
          setProfiles(rows);
          const since = Date.now() - 24 * 60 * 60 * 1000;
          setDailyActiveUsers(
            rows.filter((u) =>
              (u.last_active_at && new Date(u.last_active_at).getTime() >= since) ||
              (u.last_played_at && new Date(u.last_played_at).getTime() >= since),
            ).length,
          );
        }

        // Load Songs & Streams. Performance metrics come from an admin-only
        // aggregate RPC so the UI does not execute multiple count queries per song.
        const [{ data: songsData }, { data: songPerformanceData, error: songPerformanceError }] = await Promise.all([
          supabase
            .from('songs')
            .select('id, title, artist_name, plays, ai_tool, created_at, is_approved, audio_url, cover_url, is_spotlight, spotlight_copy, genre, trending_sort_order')
            .order('created_at', { ascending: false }),
          supabase.rpc('get_admin_song_performance'),
        ]);

        if (songPerformanceError) {
          console.error('Failed to load admin song performance:', songPerformanceError);
        }

        if (songsData) {
          const performanceBySongId = new Map<string, SongPerformanceRow>(
            ((songPerformanceData as SongPerformanceRow[]) || []).map((row) => [row.song_id, row]),
          );
          const mergedSongs = (songsData as SongData[]).map((song) => {
            const performance = performanceBySongId.get(song.id);
            return performance
              ? {
                  ...song,
                  plays: toAdminNumber(performance.plays_total),
                  plays_tracked_total: toAdminNumber(performance.plays_tracked_total),
                  starts_total: toAdminNumber(performance.starts_total),
                  plays_24h: toAdminNumber(performance.plays_24h),
                  plays_7d: toAdminNumber(performance.plays_7d),
                  plays_30d: toAdminNumber(performance.plays_30d),
                  previous_7d: toAdminNumber(performance.previous_7d),
                  trend_percent: toAdminNumber(performance.trend_percent),
                  unique_listeners: toAdminNumber(performance.unique_listeners),
                  likes_count: toAdminNumber(performance.likes),
                  playlist_adds: toAdminNumber(performance.playlist_adds),
                  last_played_at: performance.last_played_at,
                }
              : song;
          });
          setSongs(mergedSongs);
          setTotalStreams(mergedSongs.reduce((acc, song) => acc + (song.plays || 0), 0));
          const picks = mergedSongs
            .filter((s) => s.trending_sort_order != null)
            .sort((a, b) => (a.trending_sort_order ?? 0) - (b.trending_sort_order ?? 0))
            .map((s) => ({ id: s.id, title: s.title, artist_name: s.artist_name }));
          setTrendingPicks(picks);
        }

        // Load Analytics
        const { count: likesCount } = await supabase.from('liked_songs').select('*', { count: 'exact', head: true });
        if (likesCount) setTotalLikes(likesCount);

        // Daily active users are returned by the admin users API above.

        // Load Ad Frequency + Spotlight News. News posts are the canonical
        // source for the fourth Home slide; app_settings remains a legacy
        // fallback so old clients do not break.
        const [{ data: settingsData }, { data: newsRows, error: newsRowsError }] = await Promise.all([
          supabase
            .from('app_settings')
            .select('ad_frequency, highlight_news_enabled, highlight_news_title, highlight_news_body, highlight_news_cta_label, highlight_news_cta_url, highlight_news_image_url, highlight_news_article_slug')
            .eq('id', 'global')
            .single(),
          supabase
            .from('news_posts')
            .select('id, slug, title, excerpt, body, image_url, cta_label, cta_url, is_published, is_featured, published_at, created_at')
            .order('created_at', { ascending: false })
            .limit(80),
        ]);
        if (newsRowsError) {
          console.error('Failed to load news posts:', newsRowsError);
        }
        const typedNewsPosts = (newsRows || []) as NewsPostData[];
        setNewsPosts(typedNewsPosts);
        if (settingsData) {
          setAdFrequency(settingsData.ad_frequency);
          const featuredNews = typedNewsPosts.find((post) => post.is_featured);
          setHighlightNews(featuredNews
            ? {
                id: featuredNews.id,
                enabled: true,
                slug: featuredNews.slug,
                title: featuredNews.title,
                body: featuredNews.body ?? featuredNews.excerpt ?? '',
                imageUrl: featuredNews.image_url ?? '',
                ctaLabel: featuredNews.cta_label ?? '',
                ctaUrl: featuredNews.cta_url ?? `/news/${featuredNews.slug}`,
              }
            : {
                id: null,
                enabled: Boolean(settingsData.highlight_news_enabled),
                slug: (settingsData.highlight_news_article_slug as string | null) ?? '',
                title: (settingsData.highlight_news_title as string | null) ?? '',
                body: (settingsData.highlight_news_body as string | null) ?? '',
                imageUrl: (settingsData.highlight_news_image_url as string | null) ?? '',
                ctaLabel: (settingsData.highlight_news_cta_label as string | null) ?? '',
                ctaUrl: (settingsData.highlight_news_cta_url as string | null) ?? '',
              });
        }

        // Load Ads
        const { data: adsData } = await supabase.storage.from('ads').list();
        if (adsData) {
          // Filter out hidden files like .emptyFolderPlaceholder
          setAdFiles(adsData.filter(f => f.name !== '.emptyFolderPlaceholder') as unknown as AdFile[]);
        }

        // Load MCP Logs
        const { data: mcpData } = await supabase
          .from('mcp_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        if (mcpData) setMcpLogs(mcpData);

        // Load daily metric snapshots for the Analytics tab (admin-only RPC).
        const { data: metricsData, error: metricsError } = await supabase.rpc('get_admin_daily_metrics', { days: 60 });
        if (metricsError) {
          console.error('Failed to load daily metrics:', metricsError);
        } else if (metricsData) {
          setDailyMetrics(metricsData as MetricsDailyRow[]);
        }

        // Daily "starts" (Anspielungen) for the analytics funnel view.
        const { data: startsData, error: startsError } = await supabase.rpc('get_admin_daily_starts', { days: 60 });
        if (startsError) {
          console.error('Failed to load daily starts:', startsError);
        } else if (startsData) {
          setDailyStarts((startsData as Array<{ day: string; starts: number | string }>).map((r) => ({ day: r.day, starts: Number(r.starts) })));
        }

        // D1/D7 retention per signup week (admin-only RPC).
        const { data: retentionData, error: retentionError } = await supabase.rpc('get_admin_retention_cohorts', { weeks: 12 });
        if (retentionError) {
          console.error('Failed to load retention cohorts:', retentionError);
        } else if (retentionData) {
          setRetentionCohorts((retentionData as Array<Record<string, string | number>>).map((r) => ({
            cohort_week: String(r.cohort_week),
            cohort_size: Number(r.cohort_size),
            d1: Number(r.d1),
            d7: Number(r.d7),
            w1: Number(r.w1),
          })));
        }

        // Per-artist rollup for the Artists tab (admin-only RPC).
        const { data: artistPerfData, error: artistPerfError } = await supabase.rpc('get_admin_artist_performance');
        if (artistPerfError) {
          console.error('Failed to load artist performance:', artistPerfError);
        } else if (artistPerfData) {
          setArtistPerformance(artistPerfData as ArtistPerformanceRow[]);
        }

        // Load lists for the Spotlight tab
        const { data: artistRows } = await supabase
          .from('artist_profiles')
          .select('artist_name, is_spotlight')
          .order('artist_name', { ascending: true });
        if (artistRows) setSpotlightArtists(artistRows as Array<{ artist_name: string; is_spotlight: boolean }>);

        const { data: playlistRows } = await supabase
          .from('playlists')
          .select('id, title, is_spotlight, is_public')
          .eq('is_public', true)
          .order('title', { ascending: true });
        if (playlistRows) setSpotlightPlaylists((playlistRows as Array<{ id: string; title: string; is_spotlight: boolean }>));

        // Official playlists in their display order (for the reorder control).
        const { data: officialRows } = await supabase
          .from('playlists')
          .select('id, title')
          .eq('is_official', true)
          .eq('is_public', true)
          .order('official_sort_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false });
        if (officialRows) setOfficialOrder(officialRows as Array<{ id: string; title: string }>);
      }

      // Load Reports
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (reportsData) setReports(reportsData);

      // Mods only see the moderation + approvals tabs; songs RLS hides
      // foreign unapproved rows, so the queue comes via a guarded RPC.
      if (!adminCheck) {
        const { data: pendingRows, error: pendingError } = await supabase.rpc('get_pending_songs');
        if (pendingError) {
          console.error('Failed to load pending songs:', pendingError);
        } else if (pendingRows) {
          setSongs((pendingRows as Pick<SongData, 'id' | 'title' | 'artist_name' | 'audio_url' | 'created_at'>[]).map(
            (row) => ({ ...row, plays: 0, is_approved: false }),
          ));
        }
      }

      setIsLoading(false);
    };

    checkAuthAndLoadData();
  }, [router, supabase]);

  // Live activity feed for the Bot Control tab: new mcp_logs rows (bot / admin /
  // MCP actions, written by the DB audit triggers) stream in without a reload.
  // RLS ensures only admins receive these rows.
  useEffect(() => {
    const channel = supabase
      .channel('mcp_logs_activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mcp_logs' },
        (payload) => {
          setMcpLogs((prev) => [payload.new as McpLog, ...prev].slice(0, 100));
        },
      )
      .subscribe((status) => {
        setLiveConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleDeleteSong = async (id: string, title: string) => {
    if (!window.confirm(`Möchtest du den Song "${title}" wirklich unwiderruflich löschen?`)) return;

    const { error } = await supabase.from('songs').delete().eq('id', id);
    if (!error) {
      setSongs(prev => prev.filter(s => s.id !== id));
    } else {
      alert('Fehler beim Löschen des Songs: ' + error.message);
    }
  };

  const handleEditSongTitle = async (id: string, currentTitle: string) => {
    const newTitle = window.prompt(`Neuen Titel für "${currentTitle}" eingeben:`, currentTitle);
    if (!newTitle || newTitle.trim() === '' || newTitle === currentTitle) return;

    const { error } = await supabase.from('songs').update({ title: newTitle.trim() }).eq('id', id);
    if (!error) {
      setSongs(prev => prev.map(s => s.id === id ? { ...s, title: newTitle.trim() } : s));
    } else {
      alert('Fehler beim Ändern des Songtitels: ' + error.message);
    }
  };

  const handleChangeGenre = async (id: string, newGenre: string) => {
    if (!newGenre) return;
    const previous = songs;
    setSongs(prev => prev.map(s => s.id === id ? { ...s, genre: newGenre } : s));
    const { error } = await supabase.from('songs').update({ genre: newGenre }).eq('id', id);
    if (error) {
      setSongs(previous);
      alert('Fehler beim Ändern des Genres: ' + error.message);
    }
  };

  const handleEditSpotlightCopy = async (id: string, title: string, currentCopy: string | null) => {
    const next = window.prompt(
      `Spotlight-Text für "${title}" (leer lassen für Default-Text):`,
      currentCopy ?? '',
    );
    if (next === null) return;
    const trimmed = next.trim();
    const value = trimmed.length > 0 ? trimmed : null;

    const previousSongs = songs;
    setSongs(prev => prev.map(song => song.id === id ? { ...song, spotlight_copy: value } : song));

    const { error } = await supabase
      .from('songs')
      .update({ spotlight_copy: value })
      .eq('id', id);

    if (error) {
      setSongs(previousSongs);
      alert('Fehler beim Speichern des Spotlight-Texts: ' + error.message);
    }
  };

  const handleSetSpotlightArtist = async (artistName: string) => {
    setSpotlightSaving('artist');
    const previous = spotlightArtists;
    setSpotlightArtists((prev) => prev.map((a) => ({ ...a, is_spotlight: a.artist_name === artistName })));
    const { error: clearError } = await supabase.from('artist_profiles').update({ is_spotlight: false }).eq('is_spotlight', true);
    if (clearError) {
      setSpotlightArtists(previous);
      setSpotlightSaving(null);
      alert('Fehler beim Zurücksetzen des Artist-Spotlights: ' + clearError.message);
      return;
    }
    if (artistName) {
      const { error: setError } = await supabase.from('artist_profiles').update({ is_spotlight: true }).eq('artist_name', artistName);
      if (setError) {
        setSpotlightArtists(previous);
        setSpotlightSaving(null);
        alert('Fehler beim Setzen des Artist-Spotlights: ' + setError.message);
        return;
      }
    }
    setSpotlightSaving(null);
  };

  const handleSetSpotlightPlaylist = async (playlistId: string) => {
    setSpotlightSaving('playlist');
    const previous = spotlightPlaylists;
    setSpotlightPlaylists((prev) => prev.map((p) => ({ ...p, is_spotlight: p.id === playlistId })));
    const { error: clearError } = await supabase.from('playlists').update({ is_spotlight: false }).eq('is_spotlight', true);
    if (clearError) {
      setSpotlightPlaylists(previous);
      setSpotlightSaving(null);
      alert('Fehler beim Zurücksetzen des Playlist-Spotlights: ' + clearError.message);
      return;
    }
    if (playlistId) {
      const { error: setError } = await supabase.from('playlists').update({ is_spotlight: true }).eq('id', playlistId);
      if (setError) {
        setSpotlightPlaylists(previous);
        setSpotlightSaving(null);
        alert('Fehler beim Setzen des Playlist-Spotlights: ' + setError.message);
        return;
      }
    }
    setSpotlightSaving(null);
  };

  const moveOfficialPlaylist = (index: number, direction: -1 | 1) => {
    setOfficialOrder((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSaveOfficialOrder = async () => {
    setSavingOfficialOrder(true);
    try {
      const orderData = officialOrder.map((p, index) => ({ id: p.id, official_sort_order: index }));
      const { error } = await supabase.rpc('update_official_playlist_order', { order_data: orderData });
      if (error) throw error;
      alert('Reihenfolge der offiziellen Playlists gespeichert!');
    } catch (err: unknown) {
      alert('Fehler beim Speichern der Reihenfolge: ' + (err as Error).message);
    } finally {
      setSavingOfficialOrder(false);
    }
  };

  const addTrendingPick = (song: { id: string; title: string; artist_name: string }) => {
    setTrendingPicks((prev) => {
      if (prev.length >= 6 || prev.some((p) => p.id === song.id)) return prev;
      return [...prev, { id: song.id, title: song.title, artist_name: song.artist_name }];
    });
    setTrendingSearch('');
  };

  const removeTrendingPick = (id: string) => {
    setTrendingPicks((prev) => prev.filter((p) => p.id !== id));
  };

  const moveTrendingPick = (index: number, direction: -1 | 1) => {
    setTrendingPicks((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSaveTrending = async () => {
    setSavingTrending(true);
    try {
      const { error } = await supabase.rpc('set_trending_songs', { song_ids: trendingPicks.map((p) => p.id) });
      if (error) throw error;
      alert('Trending-Songs gespeichert!');
    } catch (err: unknown) {
      alert('Fehler beim Speichern der Trending-Songs: ' + (err as Error).message);
    } finally {
      setSavingTrending(false);
    }
  };

  const handleSaveHighlightNews = async () => {
    setSavingHighlightNews(true);
    try {
      const title = highlightNews.title.trim();
      if (!title) {
        alert('Bitte gib eine News-Headline ein.');
        return;
      }

      const slug = createSlug(highlightNews.slug || title);
      if (!slug) {
        alert('Bitte gib einen gültigen Artikel-Slug ein.');
        return;
      }

      const wasFeatured = Boolean(highlightNews.id && newsPosts.some((post) => post.id === highlightNews.id && post.is_featured));
      const hasOtherFeatured = newsPosts.some((post) => post.is_featured && post.id !== highlightNews.id);
      const existingPublishedAt = highlightNews.id
        ? newsPosts.find((post) => post.id === highlightNews.id)?.published_at
        : null;
      const payload = {
        slug,
        title,
        excerpt: highlightNews.body.trim() || null,
        body: highlightNews.body.trim() || null,
        image_url: highlightNews.imageUrl.trim() || null,
        cta_label: highlightNews.ctaLabel.trim() || null,
        cta_url: highlightNews.ctaUrl.trim() || null,
        is_published: true,
        published_at: existingPublishedAt ?? new Date().toISOString(),
      };

      const saveResult = highlightNews.id
        ? await supabase
            .from('news_posts')
            .update(payload)
            .eq('id', highlightNews.id)
            .select('id, slug, title, excerpt, body, image_url, cta_label, cta_url, is_published, is_featured, published_at, created_at')
            .single()
        : await supabase
            .from('news_posts')
            .insert(payload)
            .select('id, slug, title, excerpt, body, image_url, cta_label, cta_url, is_published, is_featured, published_at, created_at')
            .single();

      if (saveResult.error || !saveResult.data) throw saveResult.error || new Error('News-Post konnte nicht gespeichert werden.');
      const savedPost = saveResult.data as NewsPostData;

      if (highlightNews.enabled) {
        const { error: featuredError } = await supabase.rpc('set_featured_news_post', { post_id: savedPost.id });
        if (featuredError) throw featuredError;
        savedPost.is_featured = true;
      } else if (wasFeatured) {
        const { error: featuredError } = await supabase.rpc('set_featured_news_post', { post_id: null });
        if (featuredError) throw featuredError;
        savedPost.is_featured = false;
      }

      const shouldUpdateLegacyFallback = highlightNews.enabled || wasFeatured || !hasOtherFeatured;
      if (shouldUpdateLegacyFallback) {
        const { error } = await supabase
          .from('app_settings')
          .update({
            highlight_news_enabled: highlightNews.enabled,
            highlight_news_title: savedPost.title,
            highlight_news_body: savedPost.excerpt ?? savedPost.body ?? null,
            highlight_news_cta_label: savedPost.cta_label ?? null,
            highlight_news_cta_url: savedPost.cta_url ?? `/news/${savedPost.slug}`,
            highlight_news_image_url: savedPost.image_url ?? null,
            highlight_news_article_slug: savedPost.slug,
          })
          .eq('id', 'global');
        if (error) throw error;
      }

      setNewsPosts((prev) => {
        const updated = prev
          .map((post) => ({
            ...post,
            is_featured: highlightNews.enabled ? post.id === savedPost.id : (wasFeatured && post.id === savedPost.id ? false : post.is_featured),
          }))
          .filter((post) => post.id !== savedPost.id);
        return [{ ...savedPost, is_featured: highlightNews.enabled }, ...updated];
      });
      setHighlightNews({
        id: savedPost.id,
        enabled: highlightNews.enabled,
        slug: savedPost.slug,
        title: savedPost.title,
        body: savedPost.body ?? savedPost.excerpt ?? '',
        imageUrl: savedPost.image_url ?? '',
        ctaLabel: savedPost.cta_label ?? '',
        ctaUrl: savedPost.cta_url ?? `/news/${savedPost.slug}`,
      });
      alert('News-Slide gespeichert!');
    } catch (err: unknown) {
      alert('Fehler beim Speichern der News-Slide: ' + (err as Error).message);
    } finally {
      setSavingHighlightNews(false);
    }
  };

  const handleNewsImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Bitte lade ein gültiges Bild hoch.');
      event.target.value = '';
      return;
    }

    setIsUploadingNewsImage(true);
    setUploadNewsImageStatus('Bild wird hochgeladen…');
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const baseName = createSlug(highlightNews.slug || highlightNews.title || 'news') || 'news';
      const path = `news/${Date.now()}-${baseName}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(path, file, { cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('covers').getPublicUrl(path);
      setHighlightNews((prev) => ({ ...prev, imageUrl: data.publicUrl }));
      setUploadNewsImageStatus('Bild hochgeladen.');
      setTimeout(() => setUploadNewsImageStatus(null), 4000);
    } catch (err: unknown) {
      setUploadNewsImageStatus(null);
      alert('Fehler beim Hochladen des News-Bildes: ' + (err as Error).message);
    } finally {
      setIsUploadingNewsImage(false);
      event.target.value = '';
    }
  };

  const handleEditNewsPost = (post: NewsPostData) => {
    setHighlightNews({
      id: post.id,
      enabled: post.is_featured,
      slug: post.slug,
      title: post.title,
      body: post.body ?? post.excerpt ?? '',
      imageUrl: post.image_url ?? '',
      ctaLabel: post.cta_label ?? '',
      ctaUrl: post.cta_url ?? `/news/${post.slug}`,
    });
  };

  const handleSetFeaturedNewsPost = async (post: NewsPostData) => {
    setSavingHighlightNews(true);
    try {
      const { error: featuredError } = await supabase.rpc('set_featured_news_post', { post_id: post.id });
      if (featuredError) throw featuredError;

      const { error: settingsError } = await supabase
        .from('app_settings')
        .update({
          highlight_news_enabled: true,
          highlight_news_title: post.title,
          highlight_news_body: post.excerpt ?? post.body ?? null,
          highlight_news_cta_label: post.cta_label ?? null,
          highlight_news_cta_url: post.cta_url ?? `/news/${post.slug}`,
          highlight_news_image_url: post.image_url ?? null,
          highlight_news_article_slug: post.slug,
        })
        .eq('id', 'global');
      if (settingsError) throw settingsError;

      setNewsPosts((prev) => prev.map((item) => ({ ...item, is_featured: item.id === post.id, is_published: item.id === post.id ? true : item.is_published })));
      handleEditNewsPost({ ...post, is_featured: true, is_published: true });
      alert('News-Post ist jetzt der Home-Slide.');
    } catch (err: unknown) {
      alert('Fehler beim Setzen des News-Slides: ' + (err as Error).message);
    } finally {
      setSavingHighlightNews(false);
    }
  };

  const trendingSearchResults = trendingSearch.trim()
    ? songs
        .filter((s) =>
          !trendingPicks.some((p) => p.id === s.id) &&
          ((s.title || '').toLowerCase().includes(trendingSearch.toLowerCase()) ||
            (s.artist_name || '').toLowerCase().includes(trendingSearch.toLowerCase())),
        )
        .slice(0, 6)
    : [];

  const handleSetSpotlightSong = async (id: string, title: string) => {
    if (!window.confirm(`Möchtest du "${title}" als Home-Spotlight setzen? Das ersetzt das aktuelle Spotlight.`)) return;

    const previousSongs = songs;
    setSongs(prev => prev.map(song => ({ ...song, is_spotlight: song.id === id })));

    const { error: clearError } = await supabase
      .from('songs')
      .update({ is_spotlight: false })
      .eq('is_spotlight', true);

    if (clearError) {
      setSongs(previousSongs);
      alert('Fehler beim Zurücksetzen des Spotlights: ' + clearError.message);
      return;
    }

    const { error: setError } = await supabase
      .from('songs')
      .update({ is_spotlight: true })
      .eq('id', id);

    if (setError) {
      setSongs(previousSongs);
      alert('Fehler beim Setzen des Spotlights: ' + setError.message);
    }
  };

  const handleReplaceAudio = async (event: React.ChangeEvent<HTMLInputElement>, id: string, title: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Bitte lade eine gültige Audiodatei hoch (mp3, wav, m4a).');
      event.target.value = '';
      return;
    }

    if (!window.confirm(`Möchtest du die Audiodatei für den Song "${title}" wirklich durch die neue ersetzen?`)) {
      event.target.value = '';
      return;
    }

    setIsReplacingAudio(id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || 'admin';

      const audioExt = file.name.split('.').pop();
       
      const audioPath = `${userId}/replaced_${Date.now()}_song.${audioExt}`;

      const { error: uploadError } = await supabase.storage
        .from('songs')
        .upload(audioPath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl: audioUrl } } = supabase.storage
        .from('songs')
        .getPublicUrl(audioPath);

      // Capture the new file's real duration so the displayed length updates too
      // (previously only audio_url was changed, leaving a stale duration).
      const newDuration = await readAudioFileDuration(file);
      const updatePayload: { audio_url: string; duration?: number } =
        newDuration && newDuration > 0
          ? { audio_url: audioUrl, duration: newDuration }
          : { audio_url: audioUrl };

      const { error: updateError } = await supabase
        .from('songs')
        .update(updatePayload)
        .eq('id', id);

      if (updateError) throw updateError;

      alert(
        newDuration && newDuration > 0
          ? `Audiodatei erfolgreich ausgetauscht! Neue Länge: ${Math.floor(newDuration / 60)}:${String(newDuration % 60).padStart(2, '0')}`
          : 'Audiodatei erfolgreich ausgetauscht!',
      );
    } catch (err: unknown) {
      alert('Fehler beim Austauschen der Audiodatei: ' + (err as Error).message);
    } finally {
      setIsReplacingAudio(null);
      event.target.value = '';
    }
  };

  const handleToggleBan = async (id: string, currentStatus: boolean, username: string) => {
    if (!window.confirm(`Möchtest du den Nutzer "${username}" wirklich ${currentStatus ? 'entsperren' : 'sperren'}?`)) return;

    try {
      const { error } = await supabase.rpc('set_user_banned', {
        target_user_id: id,
        banned: !currentStatus,
      });
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, is_banned: !currentStatus } : p));
    } catch (err: unknown) {
      alert('Fehler beim Ändern des Status: ' + (err as Error).message);
    }
  };

  const handleRoleChange = async (id: string, newRole: string, username: string) => {
    if (!window.confirm(`Möchtest du die Rolle von "${username}" wirklich zu "${newRole.toUpperCase()}" ändern?`)) return;

    try {
      const { error } = await supabase.rpc('set_user_role', { target_user_id: id, new_role: newRole });
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, role: newRole } : p));
    } catch (err: unknown) {
      alert('Fehler beim Ändern der Rolle: ' + (err as Error).message);
    }
  };

  const loadAds = async () => {
    const { data: adsData } = await supabase.storage.from('ads').list();
    if (adsData) {
      setAdFiles(adsData.filter(f => f.name !== '.emptyFolderPlaceholder') as unknown as AdFile[]);
    }
  };

  const handleAdUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      alert('Bitte lade eine gültige Audiodatei hoch (mp3, m4a, wav).');
      return;
    }

    setIsUploadingAd(true);
    setUploadAdStatus('Lädt hoch...');

    try {
      const extension = file.name.split('.').pop();
      const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;

      const { error } = await supabase.storage
        .from('ads')
        .upload(uniqueFileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      setUploadAdStatus('Erfolgreich hochgeladen!');
      event.target.value = '';
      await loadAds();
      setTimeout(() => setUploadAdStatus(null), 5000);
    } catch (err: unknown) {
      setUploadAdStatus(null);
      alert('Fehler beim Hochladen der Werbung: ' + (err as Error).message);
    } finally {
      setIsUploadingAd(false);
    }
  };

  const handleAdDelete = async (fileName: string) => {
    if (!window.confirm(`Möchtest du die Werbung "${fileName}" wirklich löschen?`)) return;

    try {
      const { error } = await supabase.storage.from('ads').remove([fileName]);
      if (error) throw error;
      await loadAds();
    } catch (err: unknown) {
      alert('Fehler beim Löschen der Werbung: ' + (err as Error).message);
    }
  };

  const handleSaveAdFrequency = async () => {
    setIsSavingAdFreq(true);
    try {
      const { error } = await supabase.from('app_settings').update({ ad_frequency: adFrequency }).eq('id', 'global');
      if (error) throw error;
      alert('Werbe-Intervall erfolgreich gespeichert!');
    } catch (err: unknown) {
      alert('Fehler beim Speichern des Werbe-Intervalls: ' + (err as Error).message);
    } finally {
      setIsSavingAdFreq(false);
    }
  };

  // Approval goes through a guarded RPC so mods (not only admins) can
  // moderate; rejecting only ever deletes still-unapproved songs.
  const handleApproveSong = async (id: string, title: string) => {
    const { error } = await supabase.rpc('moderate_song_approval', { target_song_id: id, approve: true });
    if (!error) {
      setSongs(songs.map(s => s.id === id ? { ...s, is_approved: true } : s));
      alert(`Song "${title}" wurde freigegeben.`);
    } else {
      alert('Fehler beim Freigeben: ' + error.message);
    }
  };

  const handleRejectSong = async (id: string, title: string) => {
    if (confirm(`Möchtest du den Song "${title}" wirklich ablehnen und löschen?`)) {
      const { error } = await supabase.rpc('moderate_song_approval', { target_song_id: id, approve: false });
      if (!error) {
        setSongs(songs.filter(s => s.id !== id));
        alert(`Song "${title}" wurde gelöscht.`);
      } else {
        alert('Fehler beim Ablehnen: ' + error.message);
      }
    }
  };

  const handleResolveReport = async (reportId: string) => {
    await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
  };

  const filteredProfiles = profiles.filter(p => p.username?.toLowerCase().includes(searchTerm.toLowerCase()) || p.email?.toLowerCase().includes(searchTerm.toLowerCase()));
  const liveSongs = songs.filter(s => s.is_approved !== false);
  const pendingSongs = songs.filter(s => s.is_approved === false);
  const filteredSongs = liveSongs.filter(s => s.title?.toLowerCase().includes(searchTerm.toLowerCase()) || s.artist_name?.toLowerCase().includes(searchTerm.toLowerCase()));

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-500" />
                <h1 className="text-xl font-bold text-white">
                  {isFullAdmin ? 'Admin Dashboard' : 'Moderation Dashboard'}
                </h1>
              </div>
            </div>
            {isFullAdmin && (
              <div className="text-sm font-medium text-white/50">
                {profiles.length} Nutzer • {songs.length} Songs
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* KPI Cards */}
        {isFullAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                <Play className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/50">Total Streams</p>
                <p className="text-2xl font-bold text-white">{totalStreams.toLocaleString('de-DE')}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-500/20 text-pink-400 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/50">Gespeicherte Tracks</p>
                <p className="text-2xl font-bold text-white">{totalLikes.toLocaleString('de-DE')}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/50">Daily Active Users</p>
                <p className="text-2xl font-bold text-white">{dailyActiveUsers.toLocaleString('de-DE')}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center">
                <UserPlus className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/50">Total Users</p>
                <p className="text-2xl font-bold text-white">{profiles.length.toLocaleString('de-DE')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs & Search */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex flex-wrap whitespace-nowrap p-1 bg-white/5 rounded-xl border border-white/10">
            {isFullAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'users'
                      ? 'bg-indigo-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Nutzer
                </button>
                <button
                  onClick={() => setActiveTab('songs')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'songs'
                      ? 'bg-indigo-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Music className="w-4 h-4" />
                  Songs
                </button>
                <button
                  onClick={() => setActiveTab('ads')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'ads'
                      ? 'bg-indigo-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  Werbung
                </button>
                <button
                  onClick={() => setActiveTab('bot')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'bot'
                      ? 'bg-indigo-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  Bot Control
                </button>
                <button
                  onClick={() => setActiveTab('spotlight')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'spotlight'
                      ? 'bg-fuchsia-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Spotlight
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'analytics'
                      ? 'bg-teal-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Analytics
                </button>
                <button
                  onClick={() => setActiveTab('artists')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'artists'
                      ? 'bg-violet-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  Artists
                </button>
                <button
                  onClick={() => setActiveTab('push')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    activeTab === 'push'
                      ? 'bg-amber-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <BellRing className="w-4 h-4" />
                  Push
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('approvals')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'approvals'
                  ? 'bg-indigo-500 text-white shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Freigaben
              {pendingSongs.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-1">{pendingSongs.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('moderation')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'moderation'
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Moderation
              {reports.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-white text-red-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {reports.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          </div>

          <div className="relative w-full shrink-0 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
          {activeTab === 'users' && (
            <UsersTab
              profiles={filteredProfiles}
              onRoleChange={handleRoleChange}
              onToggleBan={handleToggleBan}
            />
          )}

          {activeTab === 'songs' && (
            <SongsTab
              songs={filteredSongs}
              expandedSongId={expandedSongId}
              isReplacingAudio={isReplacingAudio}
              onToggleExpanded={setExpandedSongId}
              onChangeGenre={handleChangeGenre}
              onReplaceAudio={handleReplaceAudio}
              onSetSpotlightSong={handleSetSpotlightSong}
              onEditSpotlightCopy={handleEditSpotlightCopy}
              onEditSongTitle={handleEditSongTitle}
              onDeleteSong={handleDeleteSong}
            />
          )}

          {activeTab === 'approvals' && (
            <ApprovalsTab
              pendingSongs={pendingSongs}
              onApprove={handleApproveSong}
              onReject={handleRejectSong}
            />
          )}

          {activeTab === 'moderation' && (
            <ModerationTab reports={reports} onResolve={handleResolveReport} />
          )}

          {activeTab === 'ads' && isFullAdmin && (
            <AdsTab
              isUploadingAd={isUploadingAd}
              uploadAdStatus={uploadAdStatus}
              adFiles={adFiles}
              adFrequency={adFrequency}
              isSavingAdFreq={isSavingAdFreq}
              onAdUpload={handleAdUpload}
              onAdDelete={handleAdDelete}
              onAdFrequencyChange={setAdFrequency}
              onSaveAdFrequency={handleSaveAdFrequency}
            />
          )}

          {activeTab === 'spotlight' && (
            <SpotlightTab
              highlightNews={highlightNews}
              setHighlightNews={setHighlightNews}
              savingHighlightNews={savingHighlightNews}
              newsPosts={newsPosts}
              isUploadingNewsImage={isUploadingNewsImage}
              uploadNewsImageStatus={uploadNewsImageStatus}
              spotlightArtists={spotlightArtists}
              spotlightPlaylists={spotlightPlaylists}
              spotlightSaving={spotlightSaving}
              officialOrder={officialOrder}
              savingOfficialOrder={savingOfficialOrder}
              trendingPicks={trendingPicks}
              trendingSearch={trendingSearch}
              trendingSearchResults={trendingSearchResults}
              savingTrending={savingTrending}
              onSaveHighlightNews={handleSaveHighlightNews}
              onNewsImageUpload={handleNewsImageUpload}
              onEditNewsPost={handleEditNewsPost}
              onSetFeaturedNewsPost={handleSetFeaturedNewsPost}
              onSetSpotlightArtist={handleSetSpotlightArtist}
              onSetSpotlightPlaylist={handleSetSpotlightPlaylist}
              onMoveOfficialPlaylist={moveOfficialPlaylist}
              onSaveOfficialOrder={handleSaveOfficialOrder}
              onTrendingSearchChange={setTrendingSearch}
              onAddTrendingPick={addTrendingPick}
              onRemoveTrendingPick={removeTrendingPick}
              onMoveTrendingPick={moveTrendingPick}
              onSaveTrending={handleSaveTrending}
            />
          )}

          {activeTab === 'bot' && (
            <BotTab mcpLogs={mcpLogs} liveConnected={liveConnected} />
          )}

          {activeTab === 'analytics' && isFullAdmin && (
            <AnalyticsTab metrics={dailyMetrics} dailyStarts={dailyStarts} profiles={profiles} songs={songs} retention={retentionCohorts} />
          )}

          {activeTab === 'push' && isFullAdmin && (
            <PushTab />
          )}

          {activeTab === 'artists' && isFullAdmin && (
            <ArtistsTab rows={artistPerformance} />
          )}
        </div>

      </div>
    </div>
  );
}
