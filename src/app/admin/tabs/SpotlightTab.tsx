import type { Dispatch, SetStateAction } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Megaphone, UploadCloud } from 'lucide-react';
import { createSlug, type HighlightNewsForm, type NewsPostData, type SongData } from '../types';

export function SpotlightTab({
  highlightNews,
  setHighlightNews,
  savingHighlightNews,
  newsPosts,
  isUploadingNewsImage,
  uploadNewsImageStatus,
  spotlightArtists,
  spotlightPlaylists,
  spotlightSaving,
  officialOrder,
  savingOfficialOrder,
  trendingPicks,
  trendingSearch,
  trendingSearchResults,
  savingTrending,
  onSaveHighlightNews,
  onNewsImageUpload,
  onEditNewsPost,
  onSetFeaturedNewsPost,
  onSetSpotlightArtist,
  onSetSpotlightPlaylist,
  onMoveOfficialPlaylist,
  onSaveOfficialOrder,
  onTrendingSearchChange,
  onAddTrendingPick,
  onRemoveTrendingPick,
  onMoveTrendingPick,
  onSaveTrending,
}: {
  highlightNews: HighlightNewsForm;
  setHighlightNews: Dispatch<SetStateAction<HighlightNewsForm>>;
  savingHighlightNews: boolean;
  newsPosts: NewsPostData[];
  isUploadingNewsImage: boolean;
  uploadNewsImageStatus: string | null;
  spotlightArtists: Array<{ artist_name: string; is_spotlight: boolean }>;
  spotlightPlaylists: Array<{ id: string; title: string; is_spotlight: boolean }>;
  spotlightSaving: 'artist' | 'playlist' | null;
  officialOrder: Array<{ id: string; title: string }>;
  savingOfficialOrder: boolean;
  trendingPicks: Array<{ id: string; title: string; artist_name: string }>;
  trendingSearch: string;
  trendingSearchResults: SongData[];
  savingTrending: boolean;
  onSaveHighlightNews: () => void;
  onNewsImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEditNewsPost: (post: NewsPostData) => void;
  onSetFeaturedNewsPost: (post: NewsPostData) => void;
  onSetSpotlightArtist: (artistName: string) => void;
  onSetSpotlightPlaylist: (playlistId: string) => void;
  onMoveOfficialPlaylist: (index: number, direction: -1 | 1) => void;
  onSaveOfficialOrder: () => void;
  onTrendingSearchChange: (value: string) => void;
  onAddTrendingPick: (song: { id: string; title: string; artist_name: string }) => void;
  onRemoveTrendingPick: (id: string) => void;
  onMoveTrendingPick: (index: number, direction: -1 | 1) => void;
  onSaveTrending: () => void;
}) {
  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Home Spotlight Slider</h2>
          <p className="text-white/60 text-sm">
            Wähle, welcher Song, Künstler, welche Playlist und welche News im rotierenden Spotlight-Slider auf der Home erscheinen. Song-Spotlight setzt du wie gewohnt im Songs-Tab über das Funkel-Icon.
          </p>
        </div>

        <div className="rounded-2xl border border-accent/20 bg-accent/[0.055] p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <label className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-accent/90">
                <Megaphone className="h-4 w-4" />
                News Slide
              </label>
              <p className="mt-2 text-sm text-white/55">Vierter Highlight-Slide für Ankündigungen. Veröffentlichte Beiträge bleiben unter /news erreichbar.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold text-white/70">
              <input
                type="checkbox"
                checked={highlightNews.enabled}
                onChange={(e) => setHighlightNews((prev) => ({ ...prev, enabled: e.target.checked }))}
                className="accent-primary"
              />
              Aktiv
            </label>
          </div>

          <div className="grid gap-3">
            <input
              type="text"
              value={highlightNews.title}
              onChange={(e) => setHighlightNews((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Headline, z.B. Neue App-Version ist live"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-accent/55 focus:outline-none"
            />
            <input
              type="text"
              value={highlightNews.slug}
              onChange={(e) => setHighlightNews((prev) => ({ ...prev, slug: createSlug(e.target.value) }))}
              onBlur={() => setHighlightNews((prev) => ({ ...prev, slug: createSlug(prev.slug || prev.title) }))}
              placeholder="artikel-slug, z.B. app-version-1-0-9"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-accent/55 focus:outline-none"
            />
            <textarea
              value={highlightNews.body}
              onChange={(e) => setHighlightNews((prev) => ({ ...prev, body: e.target.value }))}
              placeholder="Kurzer News-Text oder Ankündigung…"
              rows={4}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-accent/55 focus:outline-none"
            />
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                  {highlightNews.imageUrl ? (
                    <Image src={highlightNews.imageUrl} alt="News Bild" fill sizes="96px" className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/35">
                      <Megaphone className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/45">Artikelbild</p>
                  <p className="mt-1 text-sm text-white/55">Wird im Home-Slide, News-Archiv und Artikel-Header genutzt.</p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-bold text-white hover:bg-white/12">
                    {isUploadingNewsImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {isUploadingNewsImage ? 'Lädt…' : 'Bild wählen'}
                    <input type="file" accept="image/*" onChange={onNewsImageUpload} className="hidden" disabled={isUploadingNewsImage} />
                  </label>
                  {uploadNewsImageStatus ? <p className="mt-2 text-xs text-emerald-300">{uploadNewsImageStatus}</p> : null}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={highlightNews.ctaLabel}
                onChange={(e) => setHighlightNews((prev) => ({ ...prev, ctaLabel: e.target.value }))}
                placeholder="Button-Text optional"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-accent/55 focus:outline-none"
              />
              <input
                type="text"
                value={highlightNews.ctaUrl}
                onChange={(e) => setHighlightNews((prev) => ({ ...prev, ctaUrl: e.target.value }))}
                placeholder="Button-Link optional, z.B. /playlists"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-accent/55 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={onSaveHighlightNews}
              disabled={savingHighlightNews}
              className="rounded-full bg-primary px-5 py-2 text-xs font-bold text-white transition-transform hover:scale-105 disabled:opacity-50"
            >
              {savingHighlightNews ? 'Speichert…' : 'News speichern'}
            </button>
          </div>

          {newsPosts.length > 0 ? (
            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-white/45">News-Historie</p>
              <div className="space-y-2">
                {newsPosts.map((post) => (
                  <div key={post.id} className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-white">{post.title}</p>
                        {post.is_featured ? (
                          <span className="rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-accent">Aktiver Slide</span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-white/40">/news/{post.slug}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onEditNewsPost(post)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10"
                      >
                        Bearbeiten
                      </button>
                      {!post.is_featured ? (
                        <button
                          type="button"
                          onClick={() => onSetFeaturedNewsPost(post)}
                          disabled={savingHighlightNews}
                          className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/15 disabled:opacity-50"
                        >
                          Als Slide setzen
                        </button>
                      ) : null}
                      <Link
                        href={`/news/${post.slug}`}
                        target="_blank"
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10"
                      >
                        Öffnen
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-6">
          <label className="block text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300/80 mb-2">Artist Spotlight</label>
          <p className="text-sm text-white/55 mb-3">Der hervorgehobene Künstler in der zweiten Slide.</p>
          <select
            value={spotlightArtists.find((a) => a.is_spotlight)?.artist_name ?? ''}
            onChange={(e) => onSetSpotlightArtist(e.target.value)}
            disabled={spotlightSaving === 'artist'}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:outline-none focus:border-fuchsia-400/55 disabled:opacity-60"
          >
            <option value="">— Kein Artist-Spotlight —</option>
            {spotlightArtists.map((a) => (
              <option key={a.artist_name} value={a.artist_name}>{a.artist_name}</option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-6">
          <label className="block text-xs font-black uppercase tracking-[0.22em] text-teal-300/80 mb-2">Playlist Spotlight</label>
          <p className="text-sm text-white/55 mb-3">Die hervorgehobene Playlist (z.B. {'„Playlist der Woche"'}) in der dritten Slide.</p>
          <select
            value={spotlightPlaylists.find((p) => p.is_spotlight)?.id ?? ''}
            onChange={(e) => onSetSpotlightPlaylist(e.target.value)}
            disabled={spotlightSaving === 'playlist'}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white focus:outline-none focus:border-teal-300/55 disabled:opacity-60"
          >
            <option value="">— Kein Playlist-Spotlight —</option>
            {spotlightPlaylists.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-white/40">
          Sobald ein Slot leer ist, wird die entsprechende Slide einfach weggelassen — der Slider zeigt dann nur die übrigen Slides.
        </p>

        <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.035] p-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="block text-xs font-black uppercase tracking-[0.22em] text-teal-300/80">Reihenfolge: Offizielle Playlists</label>
            <button
              onClick={onSaveOfficialOrder}
              disabled={savingOfficialOrder || officialOrder.length === 0}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white transition-transform hover:scale-105 disabled:opacity-50"
            >
              {savingOfficialOrder ? 'Speichert…' : 'Reihenfolge speichern'}
            </button>
          </div>
          <p className="mb-3 text-sm text-white/55">Bestimmt die Reihenfolge der {'„Official YORIAX Playlists"'} auf der Startseite (oben in der Liste = ganz links).</p>
          <ul className="space-y-2">
            {officialOrder.map((p, index) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5">
                <span className="w-6 text-center text-sm font-bold text-white/40">{index + 1}</span>
                <span className="flex-1 truncate text-sm font-semibold text-white">{p.title}</span>
                <button
                  onClick={() => onMoveOfficialPlaylist(index, -1)}
                  disabled={index === 0}
                  aria-label="Nach oben"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-lg leading-none text-white/70 transition-colors hover:bg-white/10 disabled:opacity-30"
                >↑</button>
                <button
                  onClick={() => onMoveOfficialPlaylist(index, 1)}
                  disabled={index === officialOrder.length - 1}
                  aria-label="Nach unten"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-lg leading-none text-white/70 transition-colors hover:bg-white/10 disabled:opacity-30"
                >↓</button>
              </li>
            ))}
            {officialOrder.length === 0 && (
              <li className="px-1 text-sm text-white/40">Keine offiziellen Playlists gefunden.</li>
            )}
          </ul>
        </div>

        <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.035] p-6">
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="block text-xs font-black uppercase tracking-[0.22em] text-teal-300/80">Trending · 6 Plätze</label>
            <button
              onClick={onSaveTrending}
              disabled={savingTrending}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white transition-transform hover:scale-105 disabled:opacity-50"
            >
              {savingTrending ? 'Speichert…' : 'Trending speichern'}
            </button>
          </div>
          <p className="mb-3 text-sm text-white/55">
            Lege exakt die Songs für die {'„Trending"'}-Reihe auf Web und App fest (oben = erster). Maximal 6 Plätze; wenn die Liste leer ist, bleibt die Reihe leer.
          </p>

          <ul className="space-y-2">
            {trendingPicks.map((p, index) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5">
                <span className="w-6 text-center text-sm font-bold text-white/40">{index + 1}</span>
                <span className="flex-1 truncate text-sm font-semibold text-white">
                  {p.title} <span className="font-normal text-white/45">· {p.artist_name}</span>
                </span>
                <button
                  onClick={() => onMoveTrendingPick(index, -1)}
                  disabled={index === 0}
                  aria-label="Nach oben"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-lg leading-none text-white/70 transition-colors hover:bg-white/10 disabled:opacity-30"
                >↑</button>
                <button
                  onClick={() => onMoveTrendingPick(index, 1)}
                  disabled={index === trendingPicks.length - 1}
                  aria-label="Nach unten"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-lg leading-none text-white/70 transition-colors hover:bg-white/10 disabled:opacity-30"
                >↓</button>
                <button
                  onClick={() => onRemoveTrendingPick(p.id)}
                  aria-label="Entfernen"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20"
                >×</button>
              </li>
            ))}
            {trendingPicks.length === 0 && (
              <li className="px-1 text-sm text-white/40">Noch keine Trending-Songs gewählt.</li>
            )}
          </ul>

          {trendingPicks.length < 6 && (
            <div className="mt-4">
              <input
                type="text"
                value={trendingSearch}
                onChange={(e) => onTrendingSearchChange(e.target.value)}
                placeholder="Song suchen, um ihn hinzuzufügen…"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-teal-300/55 focus:outline-none"
              />
              {trendingSearchResults.length > 0 && (
                <ul className="mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-black/50">
                  {trendingSearchResults.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => onAddTrendingPick(s)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
                      >
                        <span className="truncate">{s.title} <span className="text-white/45">· {s.artist_name}</span></span>
                        <span className="shrink-0 text-teal-300">+ Hinzufügen</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
