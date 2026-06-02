create index if not exists feed_comments_user_id_idx
  on public.feed_comments (user_id);

create index if not exists liked_songs_song_id_idx
  on public.liked_songs (song_id);
