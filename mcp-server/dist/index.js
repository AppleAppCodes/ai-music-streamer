#!/usr/bin/env node
/**
 * MCP Server for AI Music Streamer
 *
 * Allows any MCP-compatible AI agent (Claude Desktop, Cursor, etc.)
 * to upload songs, manage playlists, and interact with the platform.
 *
 * Environment variables required:
 *   SUPABASE_URL        – Your Supabase project URL
 *   SUPABASE_SERVICE_KEY – Your Supabase service role key (bypasses RLS)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
// ── Supabase Setup ──────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
    process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// ── Helpers ─────────────────────────────────────────────────────────────────
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimes = {
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
        '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.webp': 'image/webp', '.gif': 'image/gif',
    };
    return mimes[ext] || 'application/octet-stream';
}
async function uploadFile(bucket, storagePath, localPath) {
    const fileBuffer = fs.readFileSync(localPath);
    const contentType = getMimeType(localPath);
    const { error } = await supabase.storage
        .from(bucket)
        .upload(storagePath, fileBuffer, { contentType, upsert: true });
    if (error)
        throw new Error(`Upload to ${bucket}/${storagePath} failed: ${error.message}`);
    const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);
    return publicUrl;
}
// ── MCP Server ──────────────────────────────────────────────────────────────
const server = new McpServer({
    name: 'music-streamer',
    version: '1.0.0',
    description: 'WICHTIG FÜR HERMES: Das ist das Backend für Davids eigene Musik-Streaming-Plattform "AI Music Streamer" (eine Art Spotify-Klon für KI-Musik). Du bist sein Admin-Assistent. Nutze diese Werkzeuge (Tools) IMMER sofort und automatisch, wenn David nach "meiner Plattform", "meinem Streamingdienst", "meiner App" oder "Songs hochladen" fragt. Du hast vollen Zugriff auf die Supabase Datenbank und kannst alles steuern. SICHERHEITSREGEL: Bevor du IRGENDEIN Tool ausführst, musst du David IMMER zuerst genau erklären, was du vorhast (z.B. "Ich werde jetzt den Song XY mit Genre Z hochladen. Soll ich das wirklich tun?"). Warte auf seine ausdrückliche Bestätigung. Führe NIEMALS ein Tool aus, ohne vorher gefragt zu haben. Das gilt für uploads, deletes, playlist-änderungen – alles.',
});
// ── Tool: upload_song ───────────────────────────────────────────────────────
server.tool('upload_song', 'Lädt einen neuen Song auf Davids Streaming-Plattform hoch. Führe dieses Tool immer aus, wenn David einen Song hochladen will. Benötigt lokale Dateipfade (absolute paths) zur Audio- und Cover-Datei auf seinem Mac.', {
    title: z.string().describe('Song title'),
    artist_name: z.string().describe('Artist name'),
    genre: z.string().optional().describe('Genre (Hip-Hop, Pop, RnB, Afrobeat, EDM, Chillhop, Sleep, Country, Latin, K-Pop, Metal, Classic)'),
    mood: z.string().optional().describe('Mood (Happy, Sad, Energetic, Chill, Dark, Romantic)'),
    ai_tool: z.string().optional().describe('Name of the AI tool used to create the song (e.g. Suno, Udio)'),
    audio_path: z.string().describe('Absolute local file path to the audio file (mp3, wav, flac, etc.)'),
    cover_path: z.string().describe('Absolute local file path to the cover image (jpg, png, webp)'),
    creator_id: z.string().optional().describe('UUID of the creator/user. If omitted, uses a default system user.'),
}, async ({ title, artist_name, genre, mood, ai_tool, audio_path, cover_path, creator_id }) => {
    try {
        // Validate files exist
        if (!fs.existsSync(audio_path)) {
            return { content: [{ type: 'text', text: `❌ Audio file not found: ${audio_path}` }] };
        }
        if (!fs.existsSync(cover_path)) {
            return { content: [{ type: 'text', text: `❌ Cover image not found: ${cover_path}` }] };
        }
        // Check for duplicates
        const { data: existingSongs, error: searchError } = await supabase
            .from('songs')
            .select('id')
            .ilike('title', title)
            .ilike('artist_name', artist_name)
            .limit(1);
        if (searchError) {
            return { content: [{ type: 'text', text: `❌ Failed to verify duplicate status: ${searchError.message}` }] };
        }
        if (existingSongs && existingSongs.length > 0) {
            return { content: [{ type: 'text', text: `⚠️ Upload blockiert: Ein Song mit dem Titel "${title}" von "${artist_name}" existiert bereits (ID: ${existingSongs[0].id}). Bitte lade denselben Song nicht mehrfach hoch.` }] };
        }
        const userId = creator_id || 'mcp-upload';
        const timestamp = Date.now();
        const audioExt = path.extname(audio_path);
        const coverExt = path.extname(cover_path);
        // Upload files
        const audioUrl = await uploadFile('songs', `${userId}/${timestamp}_song${audioExt}`, audio_path);
        const coverUrl = await uploadFile('covers', `${userId}/${timestamp}_cover${coverExt}`, cover_path);
        // Insert into database
        const { data, error } = await supabase
            .from('songs')
            .insert({
            creator_id: creator_id || null,
            artist_name,
            title,
            genre: genre || null,
            mood: mood || null,
            ai_tool: ai_tool || null,
            audio_url: audioUrl,
            cover_url: coverUrl,
            plays: 0,
        })
            .select()
            .single();
        if (error)
            throw error;
        return {
            content: [{ type: 'text', text: `✅ Song "${title}" by ${artist_name} uploaded successfully!\n\nID: ${data.id}\nAudio: ${audioUrl}\nCover: ${coverUrl}` }]
        };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `❌ Upload failed: ${err.message}` }] };
    }
});
// ── Tool: list_songs ────────────────────────────────────────────────────────
server.tool('list_songs', 'List songs on the platform. Optionally filter by artist name or genre.', {
    artist: z.string().optional().describe('Filter by artist name (partial match)'),
    genre: z.string().optional().describe('Filter by genre'),
    limit: z.number().optional().default(20).describe('Max number of results (default 20)'),
    offset: z.number().optional().default(0).describe('Offset for pagination'),
}, async ({ artist, genre, limit, offset }) => {
    try {
        let query = supabase
            .from('songs')
            .select('id, title, artist_name, genre, mood, plays, created_at, cover_url, audio_url')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (artist)
            query = query.ilike('artist_name', `%${artist}%`);
        if (genre)
            query = query.eq('genre', genre);
        const { data, error } = await query;
        if (error)
            throw error;
        const formatted = (data || []).map((s) => `• "${s.title}" by ${s.artist_name} [${s.genre || 'N/A'}] – ${s.plays} plays (ID: ${s.id})`).join('\n');
        return {
            content: [{ type: 'text', text: data?.length ? `🎵 ${data.length} song(s) found:\n\n${formatted}` : '🔇 No songs found.' }]
        };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
    }
});
// ── Tool: get_song ──────────────────────────────────────────────────────────
server.tool('get_song', 'Get detailed information about a specific song by its ID.', {
    song_id: z.string().describe('The UUID of the song'),
}, async ({ song_id }) => {
    try {
        const { data, error } = await supabase
            .from('songs')
            .select('*, profiles(username)')
            .eq('id', song_id)
            .single();
        if (error)
            throw error;
        const info = [
            `🎵 ${data.title}`,
            `🎤 Artist: ${data.artist_name || data.profiles?.username || 'Unknown'}`,
            `🎸 Genre: ${data.genre || 'N/A'}`,
            `🎭 Mood: ${data.mood || 'N/A'}`,
            `🤖 AI Tool: ${data.ai_tool || 'N/A'}`,
            `▶️ Plays: ${data.plays}`,
            `📅 Created: ${data.created_at}`,
            `🔗 Audio: ${data.audio_url}`,
            `🖼️ Cover: ${data.cover_url}`,
        ].join('\n');
        return { content: [{ type: 'text', text: info }] };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `❌ Song not found: ${err.message}` }] };
    }
});
// ── Tool: delete_song ───────────────────────────────────────────────────────
server.tool('delete_song', 'Delete a song from the platform by its ID.', {
    song_id: z.string().describe('The UUID of the song to delete'),
}, async ({ song_id }) => {
    try {
        const { data: song, error: fetchErr } = await supabase
            .from('songs')
            .select('title, artist_name, audio_url, cover_url')
            .eq('id', song_id)
            .single();
        if (fetchErr)
            throw fetchErr;
        const { error } = await supabase.from('songs').delete().eq('id', song_id);
        if (error)
            throw error;
        return {
            content: [{ type: 'text', text: `🗑️ Song "${song.title}" by ${song.artist_name} has been deleted.` }]
        };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `❌ Delete failed: ${err.message}` }] };
    }
});
// ── Tool: list_artists ──────────────────────────────────────────────────────
server.tool('list_artists', 'List all artists on the platform with their song count and total plays.', {}, async () => {
    try {
        const { data, error } = await supabase
            .from('songs')
            .select('artist_name, plays');
        if (error)
            throw error;
        const artistMap = new Map();
        for (const song of data || []) {
            const name = song.artist_name || 'Unknown';
            const existing = artistMap.get(name) || { songs: 0, plays: 0 };
            artistMap.set(name, {
                songs: existing.songs + 1,
                plays: existing.plays + (song.plays || 0),
            });
        }
        const sorted = [...artistMap.entries()].sort((a, b) => b[1].plays - a[1].plays);
        const formatted = sorted.map(([name, stats]) => `• ${name} – ${stats.songs} song(s), ${stats.plays} plays`).join('\n');
        return {
            content: [{ type: 'text', text: sorted.length ? `🎤 ${sorted.length} artist(s):\n\n${formatted}` : '🔇 No artists found.' }]
        };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
    }
});
// ── Tool: create_playlist ───────────────────────────────────────────────────
server.tool('create_playlist', 'Create a new playlist.', {
    title: z.string().describe('Playlist title'),
    user_id: z.string().describe('UUID of the user creating the playlist'),
    is_public: z.boolean().optional().default(true).describe('Whether the playlist is public'),
}, async ({ title, user_id, is_public }) => {
    try {
        const { data, error } = await supabase
            .from('playlists')
            .insert({ title, user_id, is_public })
            .select()
            .single();
        if (error)
            throw error;
        return {
            content: [{ type: 'text', text: `📋 Playlist "${title}" created!\nID: ${data.id}` }]
        };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
    }
});
// ── Tool: add_song_to_playlist ──────────────────────────────────────────────
server.tool('add_song_to_playlist', 'Add a song to an existing playlist.', {
    playlist_id: z.string().describe('UUID of the playlist'),
    song_id: z.string().describe('UUID of the song to add'),
}, async ({ playlist_id, song_id }) => {
    try {
        const { error } = await supabase
            .from('playlist_songs')
            .insert({ playlist_id, song_id });
        if (error)
            throw error;
        return {
            content: [{ type: 'text', text: `✅ Song added to playlist successfully.` }]
        };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
    }
});
// ── Tool: remove_song_from_playlist ─────────────────────────────────────────
server.tool('remove_song_from_playlist', 'Remove a song from a playlist.', {
    playlist_id: z.string().describe('UUID of the playlist'),
    song_id: z.string().describe('UUID of the song to remove'),
}, async ({ playlist_id, song_id }) => {
    try {
        const { error } = await supabase
            .from('playlist_songs')
            .delete()
            .eq('playlist_id', playlist_id)
            .eq('song_id', song_id);
        if (error)
            throw error;
        return {
            content: [{ type: 'text', text: `🗑️ Song removed from playlist.` }]
        };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
    }
});
// ── Tool: list_playlists ────────────────────────────────────────────────────
server.tool('list_playlists', 'List all playlists, optionally filtered by user.', {
    user_id: z.string().optional().describe('Filter by user UUID'),
}, async ({ user_id }) => {
    try {
        let query = supabase
            .from('playlists')
            .select('id, title, user_id, is_public, created_at')
            .order('created_at', { ascending: false });
        if (user_id)
            query = query.eq('user_id', user_id);
        const { data, error } = await query;
        if (error)
            throw error;
        const formatted = (data || []).map((p) => `• "${p.title}" ${p.is_public ? '🌍' : '🔒'} (ID: ${p.id})`).join('\n');
        return {
            content: [{ type: 'text', text: data?.length ? `📋 ${data.length} playlist(s):\n\n${formatted}` : '📋 No playlists found.' }]
        };
    }
    catch (err) {
        return { content: [{ type: 'text', text: `❌ Error: ${err.message}` }] };
    }
});
// ── Start Server ────────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🎵 Music Streamer MCP Server is running.');
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
