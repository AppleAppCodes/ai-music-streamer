#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav', '.flac', '.aac', '.ogg']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const DEFAULT_PROJECT_REF = 'eiqelhjugiwckvxyixyh';
const DEFAULT_API_BASE = 'https://www.yoriax.com';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    if (['dry-run', 'skip-existing', 'allow-missing-covers', 'include-hidden', 'direct-supabase'].includes(name)) {
      args[name] = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
    args[name] = value;
    i += 1;
  }
  return args;
}

function loadEnvFile(file) {
  if (!file) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function requireCredentials() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL.');
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY. Direct Supabase mode requires service credentials.');
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ''), serviceKey };
}

function requireApiCredentials(args) {
  const apiBase = args['api-base'] || process.env.YORIAX_API_BASE || DEFAULT_API_BASE;
  const token = args['auth-token'] || process.env.YORIAX_ADMIN_TOKEN || process.env.SUPABASE_ACCESS_TOKEN;
  if (!apiBase) throw new Error('Missing --api-base or YORIAX_API_BASE.');
  if (!token) throw new Error('Missing YORIAX_ADMIN_TOKEN / --auth-token. Use an access token for a YORIAX admin user.');
  return { apiBase: apiBase.replace(/\/$/, ''), token };
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  }[ext] || 'application/octet-stream';
}

function encodeStoragePath(storagePath) {
  return storagePath.split('/').map(encodeURIComponent).join('/');
}

function publicUrl(supabaseUrl, bucket, storagePath) {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeStoragePath(storagePath)}`;
}

function baseName(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function isHiddenFile(filePath) {
  return path.basename(filePath).startsWith('.');
}

function normalizeName(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function toDisplayTitle(value) {
  const clean = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || value;
}

function parseTrackNumber(filePath) {
  const base = baseName(filePath).trim();
  const songMatch = base.match(/(?:song\s*)?(\d{1,3})\s*[-–—]\s*(.+)$/i);
  if (songMatch) return { number: Number(songMatch[1]), label: songMatch[2].trim() };
  const leadingMatch = base.match(/^(\d{1,3})\s*[-–— ]\s*(.+)$/);
  if (leadingMatch) return { number: Number(leadingMatch[1]), label: leadingMatch[2].trim() };
  return { number: null, label: base };
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function findBestCover(audio, covers, usedCovers) {
  const parsedAudio = parseTrackNumber(audio);
  const audioNorm = normalizeName(parsedAudio.label);

  if (parsedAudio.number != null) {
    const numbered = covers.find((cover) => !usedCovers.has(cover.path) && cover.number === parsedAudio.number);
    if (numbered) return { cover: numbered, matchType: 'number' };
  }

  const exact = covers.find((cover) => !usedCovers.has(cover.path) && cover.norm === audioNorm);
  if (exact) return { cover: exact, matchType: 'exact' };

  let best = null;
  for (const cover of covers) {
    if (usedCovers.has(cover.path)) continue;
    const distance = levenshtein(audioNorm, cover.norm);
    const threshold = Math.max(3, Math.floor(Math.max(audioNorm.length, cover.norm.length) * 0.22));
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { cover, distance };
    }
  }

  return best ? { cover: best.cover, matchType: `fuzzy:${best.distance}` } : { cover: null, matchType: 'missing' };
}

function getDurationSeconds(audioPath) {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    audioPath,
  ], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  const duration = Number.parseFloat(result.stdout.trim());
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null;
}

function discoverTracks(dir, { includeHidden = false } = {}) {
  const files = fs.readdirSync(dir).map((name) => path.join(dir, name));
  const visibleFiles = includeHidden ? files : files.filter((file) => !isHiddenFile(file));
  const audioFiles = visibleFiles.filter((file) => AUDIO_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const covers = visibleFiles
    .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .map((file) => {
      const parsed = parseTrackNumber(file);
      const title = toDisplayTitle(parsed.label);
      return {
        path: file,
        number: parsed.number,
        title,
        norm: normalizeName(title),
      };
    });

  const usedCovers = new Set();
  return audioFiles
    .map((audio) => {
      const parsed = parseTrackNumber(audio);
      const audioTitle = toDisplayTitle(parsed.label);
      const match = findBestCover(audio, covers, usedCovers);
      if (match.cover) usedCovers.add(match.cover.path);
      const title = match.matchType.startsWith('fuzzy') && match.cover?.title ? match.cover.title : audioTitle;
      return {
        number: parsed.number,
        title,
        audio,
        cover: match.cover?.path ?? null,
        matchType: match.matchType,
        duration: getDurationSeconds(audio),
      };
    })
    .sort((a, b) => (a.number ?? 9999) - (b.number ?? 9999) || a.title.localeCompare(b.title));
}

async function supabaseFetch(credentials, urlPath, init = {}) {
  const response = await fetch(`${credentials.supabaseUrl}${urlPath}`, {
    ...init,
    headers: {
      apikey: credentials.serviceKey,
      Authorization: `Bearer ${credentials.serviceKey}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw new Error(`Supabase request failed ${response.status}: ${detail}`);
  }
  return payload;
}

function escapePostgrestValue(value) {
  return value.replace(/"/g, '\\"');
}

async function listArtistSongs(credentials, artist) {
  const params = new URLSearchParams({
    select: 'id,title,artist_name',
    artist_name: `ilike.${escapePostgrestValue(artist)}`,
    limit: '500',
  });
  const rows = await supabaseFetch(credentials, `/rest/v1/songs?${params.toString()}`);
  return Array.isArray(rows) ? rows : [];
}

async function upsertArtistProfile(credentials, artist, { isOriginal = false } = {}) {
  const params = new URLSearchParams({ on_conflict: 'artist_name', select: 'artist_name' });
  const rows = await supabaseFetch(credentials, `/rest/v1/artist_profiles?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([{ artist_name: artist, is_original: isOriginal }]),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function uploadFile(credentials, bucket, storagePath, localPath) {
  const body = fs.readFileSync(localPath);
  await supabaseFetch(credentials, `/storage/v1/object/${bucket}/${encodeStoragePath(storagePath)}`, {
    method: 'POST',
    headers: {
      'Content-Type': getMimeType(localPath),
      'x-upsert': 'false',
    },
    body,
  });
  return publicUrl(credentials.supabaseUrl, bucket, storagePath);
}

async function insertSong(credentials, row) {
  const rows = await supabaseFetch(credentials, '/rest/v1/songs?select=id,title,artist_name', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function yoriaxApiFetch(credentials, urlPath, init = {}) {
  const response = await fetch(`${credentials.apiBase}${urlPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const detail = typeof payload === 'string' ? payload : JSON.stringify(payload);
    throw new Error(`YORIAX API request failed ${response.status}: ${detail}`);
  }
  return payload;
}

async function listArtistSongsViaApi(credentials, artist) {
  const params = new URLSearchParams({ artist, limit: '500' });
  const payload = await yoriaxApiFetch(credentials, `/api/admin/songs?${params.toString()}`);
  return Array.isArray(payload?.songs) ? payload.songs : [];
}

async function upsertArtistProfileViaApi(credentials, artist, { isOriginal = false } = {}) {
  const payload = await yoriaxApiFetch(credentials, '/api/admin/artists', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ artist_name: artist, is_original: isOriginal }),
  });
  return payload?.artist ?? null;
}

function appendString(formData, key, value) {
  if (value != null && value !== '') formData.append(key, String(value));
}

async function uploadSongViaApi(credentials, track, args, artist, index) {
  const formData = new FormData();
  appendString(formData, 'title', track.title);
  appendString(formData, 'artist_name', artist);
  appendString(formData, 'genre', args.genre || null);
  appendString(formData, 'mood', args.mood || null);
  appendString(formData, 'language', args.language || null);
  appendString(formData, 'description', args.description || null);
  appendString(formData, 'ai_tool', args['ai-tool'] || null);
  appendString(formData, 'creator_id', args['creator-id'] || null);
  appendString(formData, 'duration', track.duration);
  appendString(formData, 'track_number', track.number ?? index + 1);
  appendString(formData, 'skip_existing', args['skip-existing'] ? 'true' : 'false');
  appendString(formData, 'artist_is_original', args['is-original'] === 'true' ? 'true' : 'false');

  const audioBlob = new Blob([fs.readFileSync(track.audio)], { type: getMimeType(track.audio) });
  formData.append('audio', audioBlob, path.basename(track.audio));

  if (track.cover) {
    const coverBlob = new Blob([fs.readFileSync(track.cover)], { type: getMimeType(track.cover) });
    formData.append('cover', coverBlob, path.basename(track.cover));
  }

  const payload = await yoriaxApiFetch(credentials, '/api/admin/songs', {
    method: 'POST',
    body: formData,
  });

  return payload;
}

function printPlan(tracks, artist) {
  console.log(`Prepared ${tracks.length} track(s) for ${artist}:`);
  for (const [index, track] of tracks.entries()) {
    console.log(
      `- ${String(track.number ?? index + 1).padStart(2, '0')} ${track.title} | ${path.basename(track.audio)} | ${track.cover ? path.basename(track.cover) : 'NO COVER'} | ${track.matchType} | duration=${track.duration ?? 'unknown'}`,
    );
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.env) loadEnvFile(args.env);
  if (!args.dir) throw new Error('Missing --dir');
  if (!args.artist) throw new Error('Missing --artist');

  const dir = path.resolve(args.dir);
  const artist = args.artist.trim();
  const genre = args.genre || null;
  const mood = args.mood || null;
  const tracks = discoverTracks(dir, { includeHidden: Boolean(args['include-hidden']) });
  if (!tracks.length) throw new Error(`No audio files found in ${dir}`);

  const missingCovers = tracks.filter((track) => !track.cover);
  printPlan(tracks, artist);
  if (missingCovers.length && !args['allow-missing-covers']) {
    throw new Error(`Missing covers for: ${missingCovers.map((track) => track.title).join(', ')}`);
  }

  const useDirectSupabase = Boolean(args['direct-supabase']);
  const credentials = useDirectSupabase ? requireCredentials() : requireApiCredentials(args);
  if (useDirectSupabase && !credentials.supabaseUrl.includes(DEFAULT_PROJECT_REF)) {
    throw new Error(`Unexpected Supabase project URL. Expected project ref ${DEFAULT_PROJECT_REF}.`);
  }

  const existingRows = useDirectSupabase
    ? await listArtistSongs(credentials, artist)
    : await listArtistSongsViaApi(credentials, artist);
  const existingByTitle = new Map(existingRows.map((row) => [normalizeName(row.title || ''), row]));
  const duplicates = tracks.filter((track) => existingByTitle.has(normalizeName(track.title)));
  if (duplicates.length && !args['skip-existing']) {
    throw new Error(`Duplicate song(s) already exist for ${artist}: ${duplicates.map((track) => track.title).join(', ')}. Use --skip-existing to skip.`);
  }

  if (duplicates.length) {
    console.log(`Existing tracks that will be skipped: ${duplicates.map((track) => track.title).join(', ')}`);
  } else {
    console.log('Duplicate check: no existing matching tracks found.');
  }

  if (args['dry-run']) {
    console.log('Dry-run complete. No uploads or database writes performed.');
    return;
  }

  if (!useDirectSupabase) {
    await upsertArtistProfileViaApi(credentials, artist, { isOriginal: args['is-original'] === 'true' });
    console.log(`Artist profile ready: ${artist}`);

    const uploaded = [];
    for (const [index, track] of tracks.entries()) {
      if (existingByTitle.has(normalizeName(track.title)) && args['skip-existing']) continue;
      const payload = await uploadSongViaApi(credentials, track, args, artist, index);
      uploaded.push(payload?.song);
      const status = payload?.skipped ? 'Skipped existing' : 'Uploaded';
      console.log(`${status}: ${track.title} (${payload?.song?.id || 'unknown id'})`);
    }

    console.log(`Done. Uploaded ${uploaded.filter(Boolean).length} song(s) via YORIAX Admin API.`);
    return;
  }

  await upsertArtistProfile(credentials, artist, { isOriginal: args['is-original'] === 'true' });
  console.log(`Artist profile ready: ${artist}`);

  const batch = Date.now();
  const uploaded = [];
  for (const [index, track] of tracks.entries()) {
    if (existingByTitle.has(normalizeName(track.title)) && args['skip-existing']) continue;

    const safeNumber = String(track.number ?? index + 1).padStart(2, '0');
    const audioExt = path.extname(track.audio).toLowerCase();
    const coverExt = track.cover ? path.extname(track.cover).toLowerCase() : null;
    const prefix = `catalog-upload/${normalizeName(artist).replace(/\s+/g, '-')}/${batch}_${safeNumber}`;
    const audioUrl = await uploadFile(credentials, 'songs', `${prefix}_song${audioExt}`, track.audio);
    const coverUrl = track.cover
      ? await uploadFile(credentials, 'covers', `${prefix}_cover${coverExt}`, track.cover)
      : null;

    const song = await insertSong(credentials, {
      creator_id: args['creator-id'] || null,
      artist_name: artist,
      title: track.title,
      cover_url: coverUrl,
      audio_url: audioUrl,
      genre,
      mood,
      language: args.language || null,
      description: args.description || null,
      ai_tool: args['ai-tool'] || null,
      plays: 0,
      duration: track.duration,
      human_edit: 0,
      vocals_type: null,
      credits: [],
      track_number: track.number ?? index + 1,
      is_approved: true,
    });
    uploaded.push(song);
    console.log(`Uploaded: ${track.title} (${song?.id || 'unknown id'})`);
  }

  console.log(`Done. Uploaded ${uploaded.length} song(s).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
