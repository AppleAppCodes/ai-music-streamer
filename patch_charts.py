import re

with open('src/app/charts/viral/page.tsx', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { ArrowLeft, CalendarDays, ChevronRight, Flame, Mic2, Pause, Play, TrendingUp, Edit2, Loader2, Trash2 } from 'lucide-react';",
    "import { ArrowLeft, CalendarDays, ChevronRight, Flame, Mic2, Pause, Play, TrendingUp, Edit2, Loader2, Trash2, Plus, Search, X } from 'lucide-react';"
)

# 2. ChartPanelProps
content = content.replace(
    """  isReorderable?: boolean;
  onReorder?: (songs: Song[]) => void;
}""",
    """  isReorderable?: boolean;
  onReorder?: (songs: Song[]) => void;
  onRemoveSong?: (songId: string) => void;
  onAddSongClick?: () => void;
}"""
)

# 3. ChartPanel args
content = content.replace(
    """  isReorderable,
  onReorder,
}: ChartPanelProps) {""",
    """  isReorderable,
  onReorder,
  onRemoveSong,
  onAddSongClick,
}: ChartPanelProps) {"""
)

# 4. Remove button in drag and drop
content = content.replace(
    """                    <div className="flex items-center justify-end pr-2 text-white/20">
                      <TrendingUp className="h-4 w-4" />
                    </div>""",
    """                    <div className="flex items-center justify-end pr-2 text-white/20 gap-2">
                      {onRemoveSong ? (
                        <button type="button" className="pointer-events-auto text-white/20 hover:text-red-400 p-1 transition-colors" onClick={(e) => { e.stopPropagation(); onRemoveSong(song.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                      <TrendingUp className="h-4 w-4" />
                    </div>"""
)

# 5. Add Song button below Reorder Group
content = content.replace(
    """              })}
            </Reorder.Group>
          ) : (""",
    """              })}
            </Reorder.Group>
            {onAddSongClick ? (
              <button
                onClick={onAddSongClick}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 p-3 text-sm font-bold text-white/50 transition-colors hover:border-white/40 hover:text-white"
              >
                <Plus className="h-4 w-4" />
                Song zu Charts hinzufügen
              </button>
            ) : null}
          </div>
        ) : ("""
)

# 6. Add Song button below normal list
content = content.replace(
    """              );
            })
          )}
        </div>""",
    """              );
            })
          )}
          {!isReorderable && onAddSongClick ? (
            <button
              onClick={onAddSongClick}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 p-3 text-sm font-bold text-white/50 transition-colors hover:border-white/40 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Song zu Charts hinzufügen
            </button>
          ) : null}
        </div>"""
)

# 7. States in ViralChartsPage
content = content.replace(
    """  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);""",
    """  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isAddSongModalOpen, setIsAddSongModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');"""
)

# 8. Handlers in ViralChartsPage
content = content.replace(
    """    } catch (err) {
      console.error('Failed to update viral order:', err);
    }
  };""",
    """    } catch (err) {
      console.error('Failed to update viral order:', err);
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return songs
      .filter(s => s.title.toLowerCase().includes(query) || s.artist_name?.toLowerCase().includes(query))
      .filter(s => !adminViralSongs.some(av => av.id === s.id))
      .slice(0, 5);
  }, [searchQuery, songs, adminViralSongs]);

  const handleAddSongToViral = async (song: Song) => {
    if (!isAdmin) return;
    const newOrder = [...adminViralSongs, song];
    setAdminViralSongs(newOrder);
    setIsAddSongModalOpen(false);
    setSearchQuery('');
    
    const orderData = newOrder.map((s, index) => ({
      id: s.id,
      viral_sort_order: index + 1
    }));
    
    try {
      await supabase.from('songs').update({ viral_sort_order: newOrder.length }).eq('id', song.id);
      await supabase.rpc('update_viral_song_order', { order_data: orderData });
      setSongs(prev => prev.map(s => s.id === song.id ? { ...s, viral_sort_order: newOrder.length } as Song : s));
    } catch (err) {
      console.error('Failed to add song to viral:', err);
    }
  };

  const handleRemoveSongFromViral = async (songId: string) => {
    if (!isAdmin) return;
    const newOrder = adminViralSongs.filter(s => s.id !== songId);
    setAdminViralSongs(newOrder);
    
    try {
      await supabase.from('songs').update({ viral_sort_order: null }).eq('id', songId);
      const orderData = newOrder.map((s, index) => ({
        id: s.id,
        viral_sort_order: index + 1
      }));
      await supabase.rpc('update_viral_song_order', { order_data: orderData });
      setSongs(prev => prev.map(s => s.id === songId ? { ...s, viral_sort_order: undefined } as Song : s));
    } catch (err) {
      console.error('Failed to remove song from viral:', err);
    }
  };"""
)

# 9. Pass props to ChartPanel
content = content.replace(
    """            onPlayChart={handlePlayChart}
            onPlaySong={handlePlaySong}
            isReorderable={isAdmin}
            onReorder={handleViralReorder}
          />""",
    """            onPlayChart={handlePlayChart}
            onPlaySong={handlePlaySong}
            isReorderable={isAdmin}
            onReorder={handleViralReorder}
            onRemoveSong={isAdmin ? handleRemoveSongFromViral : undefined}
            onAddSongClick={isAdmin ? () => setIsAddSongModalOpen(true) : undefined}
          />"""
)

# 10. Modal UI
content = content.replace(
    """      </div>
    </div>
  );
}""",
    """      </div>

      {isAdmin && isAddSongModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setIsAddSongModalOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#181818] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Viral Charts bearbeiten</p>
                <h2 className="mt-1 text-2xl font-black text-white">Neuen Song suchen</h2>
              </div>
              <button onClick={() => setIsAddSongModalOpen(false)} className="text-white/45 transition-colors hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Song oder Artist eingeben..." 
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-base text-white outline-none focus:border-orange-400/70"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map(song => (
                  <div key={song.id} className="flex items-center justify-between rounded-xl p-2 hover:bg-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={song.cover_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{song.title}</p>
                        <p className="truncate text-xs text-white/50">{song.artist_name || 'Creator'}</p>
                      </div>
                    </div>
                    <button onClick={() => handleAddSongToViral(song)} className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20">
                      <Plus className="h-3 w-3" />
                      Hinzufügen
                    </button>
                  </div>
                ))
              ) : searchQuery.trim() !== '' ? (
                <p className="text-center text-sm text-white/45 py-4">Keine passenden Songs gefunden.</p>
              ) : (
                <p className="text-center text-sm text-white/45 py-4">Tippe oben, um Katalog zu durchsuchen.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}"""
)

with open('src/app/charts/viral/page.tsx', 'w') as f:
    f.write(content)

