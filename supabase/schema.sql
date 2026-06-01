-- Create users table (Profiles)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  bio text,
  avatar_url text,
  followers_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create songs table
CREATE TABLE public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  cover_url text,
  audio_url text,
  genre text,
  mood text,
  language text,
  description text,
  ai_tool text,
  plays integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (Security best practice)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- Create Policies to allow everyone to read data
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Public songs are viewable by everyone." ON public.songs FOR SELECT USING (true);

-- Insert Dummy Data for immediate testing
WITH creator1 AS (
  INSERT INTO public.profiles (username, bio, followers_count) VALUES ('SynthwaveQueen', 'AI Synthwave Producer', 12000) RETURNING id
),
creator2 AS (
  INSERT INTO public.profiles (username, bio, followers_count) VALUES ('NeuralBeats', 'Lofi Hip Hop Generator', 8500) RETURNING id
)
INSERT INTO public.songs (creator_id, title, genre, mood, plays, cover_url) 
SELECT id, 'Neon Horizon', 'Synthwave', 'Energetic', 1250000, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80' FROM creator1 UNION ALL
SELECT id, 'Midnight Rain', 'Lofi', 'Chill', 890000, 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&q=80' FROM creator2 UNION ALL
SELECT id, 'Cybernetic Dreams', 'Cyberpunk', 'Dark', 245000, 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&q=80' FROM creator1 UNION ALL
SELECT id, 'Coffee Shop Vibes', 'Jazz', 'Relaxing', 45000, 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80' FROM creator2;

-- Create albums table
CREATE TABLE IF NOT EXISTS public.albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    cover_url TEXT NOT NULL,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'album',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on albums
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

-- Create policies for albums
CREATE POLICY "Albums are viewable by everyone" ON public.albums FOR SELECT USING (true);
CREATE POLICY "Users can insert their own albums" ON public.albums FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update their own albums" ON public.albums FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Users can delete their own albums" ON public.albums FOR DELETE USING (auth.uid() = creator_id);

-- Alter songs table
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES public.albums(id) ON DELETE SET NULL;
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS track_number INTEGER;
