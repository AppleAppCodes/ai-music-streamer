# YORIAX Admin API v1

Purpose: allow trusted automation agents to manage YORIAX catalog data without exposing the Supabase service-role key.

## Authentication

Send a Supabase access token for a YORIAX admin user:

```http
Authorization: Bearer <YORIAX_ADMIN_TOKEN>
```

The API rejects non-admin users. The service-role key is used only inside the Next.js server route.

## Endpoints

### Artists

`GET /api/admin/artists?search=<name>&limit=50`

Lists artist profiles.

`POST /api/admin/artists`

```json
{
  "artist_name": "Trumpet Twins",
  "is_original": false,
  "sort_order": 0,
  "instagram_url": "https://...",
  "tiktok_url": "https://...",
  "youtube_url": "https://..."
}
```

Upserts an artist profile by `artist_name`.

### Songs

`GET /api/admin/songs?artist=<artist>&limit=500`

Lists songs for duplicate checks and verification.

`POST /api/admin/songs`

Multipart form-data:

- `title` required
- `artist_name` required
- `audio` required file
- `cover` required file unless `cover_url` is provided
- `genre`, `mood`, `language`, `description`, `ai_tool`, `creator_id` optional
- `duration`, `track_number`, `human_edit` optional integers
- `skip_existing=true` returns the existing song instead of failing with `409`
- `artist_is_original=true|false` controls the auto-created artist profile

The route validates file types, uploads audio to the `songs` bucket, uploads covers to the `covers` bucket, inserts an approved `songs` row, and rolls back uploaded files if insertion fails.

### Playlists

`GET /api/admin/playlists?official=true`

Lists official playlists by default.

`POST /api/admin/playlists`

```json
{
  "title": "Chill Hop Mix",
  "description": "YORIAX Team · Entspannte Chillhop-Beats und Lo-Fi-Vibes.",
  "cover_url": "https://...",
  "video_url": "https://...",
  "video_storage_path": "playlist-videos/...",
  "is_public": true,
  "is_official": true,
  "song_ids": ["uuid-1", "uuid-2"]
}
```

Creates a playlist and optionally replaces its song list.

`GET /api/admin/playlists/:id`

Returns playlist metadata and songs.

`PATCH /api/admin/playlists/:id`

Updates playlist metadata. If `song_ids` is present, the playlist song list is replaced.

`DELETE /api/admin/playlists/:id`

Deletes playlist song mappings and the playlist.

## Agent upload runner

Use:

```bash
node .agents/skills/yoriax-bulk-upload/scripts/upload-yoriax-folder.mjs \
  --env /absolute/path/yoriax-upload.env \
  --api-base https://www.yoriax.com \
  --dir "/absolute/path/UPLOAD_FOLDER" \
  --artist "Artist Name" \
  --genre "Genre" \
  --mood "Mood" \
  --description "Description" \
  --skip-existing
```

The env file should contain:

```bash
YORIAX_ADMIN_TOKEN=ey...
```
