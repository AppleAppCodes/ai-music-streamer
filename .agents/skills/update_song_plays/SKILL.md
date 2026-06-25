---
name: Update Song Plays
description: Instructions and scripts to modify, scale, or randomize song plays (stream counts) in the Yoriax database.
---

# Update Song Plays Skill

Use this skill to adjust play counts (stream metrics) for songs on the Yoriax platform.

## Script Location
The reusable Node.js script is located at:
[.agents/skills/update_song_plays/scripts/update_plays.mjs](file:///.agents/skills/update_song_plays/scripts/update_plays.mjs)

## Usage

Run the script using `node` from the root of the workspace.

```bash
node .agents/skills/update_song_plays/scripts/update_plays.mjs [options]
```

### Options
- `--all`                  Update all songs in the database.
- `--song "<title>"`       Update a specific song by its title (case-insensitive search).
- `--id "<uuid>"`          Update a specific song by its exact database ID.
- `--plays <number>`       Set plays to this exact number. If omitted, plays will be randomized.
- `--min <number>`         Minimum plays for random generation (default: 1).
- `--max <number>`         Maximum plays for random generation (default: 30000).

---

## Examples

### 1. Randomize all songs between 1 and 30k plays
```bash
node .agents/skills/update_song_plays/scripts/update_plays.mjs --all
```

### 2. Randomize all songs between 10k and 50k plays
```bash
node .agents/skills/update_song_plays/scripts/update_plays.mjs --all --min 10000 --max 50000
```

### 3. Set the plays of a specific song to an exact number
```bash
node .agents/skills/update_song_plays/scripts/update_plays.mjs --song "Tinder Luv" --plays 15000
```

### 4. Randomize a specific song's plays within a range
```bash
node .agents/skills/update_song_plays/scripts/update_plays.mjs --song "Come Closer" --min 1000 --max 5000
```
