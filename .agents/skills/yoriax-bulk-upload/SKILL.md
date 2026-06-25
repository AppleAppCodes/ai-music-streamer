---
name: yoriax-bulk-upload
description: Upload local folders of YORIAX songs to the production Supabase project, including audio files, matching cover images, artist profile creation, duplicate checks, dry-runs, and approved song inserts. Use when asked to add artists, upload local MP3/M4A/WAV/FLAC/AAC/OGG tracks with PNG/JPG/WEBP covers, or prepare reusable upload instructions for OpenClaw, Hermes, Codex, or similar agents.
---

# YORIAX Bulk Upload

Use this skill for production YORIAX catalog imports from local folders.

## Production target

- Supabase project ref: `eiqelhjugiwckvxyixyh`
- Preferred API base: `https://www.yoriax.com`
- Preferred credential: `YORIAX_ADMIN_TOKEN` or `--auth-token` containing a Supabase access token for a YORIAX admin user.
- Legacy direct credential: `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_KEY`, only when `--direct-supabase` is intentionally used.
- Never print service keys, admin tokens, or full `.env` contents.

## Workflow

1. Inspect the source folder.
2. Run a dry-run first.
3. Confirm every non-hidden audio file has a cover.
4. Check duplicates by normalized `title + artist_name`.
5. Upsert `artist_profiles.artist_name` through `/api/admin/artists`.
6. Upload each song through `/api/admin/songs`.
7. Verify inserted songs through `/api/admin/songs?artist=...`.
8. Use legacy direct Supabase mode only when the API is unavailable and the user explicitly allows it.

## Runner

Use `scripts/upload-yoriax-folder.mjs`.

Example dry-run:

```bash
node .agents/skills/yoriax-bulk-upload/scripts/upload-yoriax-folder.mjs \
  --env /absolute/path/yoriax-upload.env \
  --api-base https://www.yoriax.com \
  --dir "/absolute/path/DRUM N BASS" \
  --artist "Trumpet Twins" \
  --genre "Drum 'n' Bass" \
  --mood Energetic \
  --dry-run
```

Example upload:

```bash
node .agents/skills/yoriax-bulk-upload/scripts/upload-yoriax-folder.mjs \
  --env /absolute/path/yoriax-upload.env \
  --api-base https://www.yoriax.com \
  --dir "/absolute/path/DRUM N BASS" \
  --artist "Trumpet Twins" \
  --genre "Drum 'n' Bass" \
  --mood Energetic \
  --description "Drum 'n' Bass on YORIAX." \
  --skip-existing
```

The env file for API mode should contain only:

```bash
YORIAX_ADMIN_TOKEN=ey...
```

If `--api-base` is omitted, the runner uses `YORIAX_API_BASE` and falls back to `https://www.yoriax.com`.

Legacy direct mode requires:

`SUPABASE_URL` and a redacted `SUPABASE_SERVICE_ROLE_KEY`.

and must be invoked with `--direct-supabase`.

## Matching rules

- Hidden files such as `.mp3` are ignored by default.
- Exact normalized name matches are preferred: `Afterglow.mp3` ↔ `afterglow.png`.
- Track-number matches are supported: `01 - Afterglow.mp3` ↔ `1-Afterglow.png`.
- Fuzzy name matches are allowed for small typos, e.g. `Flighing High.mp3` ↔ `Flying High.png`.
- If a fuzzy match has a cleaner cover title, use the cover title as the public song title.

## Insert defaults

Unless the user explicitly says otherwise:

- `creator_id`: `null`
- `plays`: `0`
- `is_approved`: `true`
- `human_edit`: `0`
- `vocals_type`: `null`
- `credits`: `[]`

Use explicit flags for artist, genre, mood, language, description, AI tool, creator ID, and track numbers.
