/**
 * Platform analytics for the YORIAX MCP server.
 *
 * Read-only tools so MCP agents (Hermes, OpenClaw etc.) can answer
 * "wie läuft die Plattform?" with real numbers: live KPIs, daily metric
 * snapshots (metrics_daily) and top songs by honestly tracked plays.
 *
 * All queries run with the service-role client (RLS bypass); the data
 * sources are the tracking layer (song_daily_plays, user_activity_days,
 * metrics_daily) — NOT the display play counters shown in the app.
 * These tools only read, so they are not written to mcp_logs (the
 * Bot-Control log is for database changes).
 */
import { z } from 'zod';
const fmt = (value) => (value ?? 0).toLocaleString('de-DE');
function isoDaysAgo(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
function dateDaysAgo(days) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function registerAnalyticsTools(server, supabase) {
    // ── Tool: get_analytics_overview ──────────────────────────────────────────
    server.tool('get_analytics_overview', 'Aktueller Gesamtüberblick über Davids YORIAX-Plattform: Nutzerzahlen (gesamt/neu/aktiv), Akquisition (Apple Ads vs. organisch), Länder, echte Plays, Hörzeit, Katalog. Führe dieses Tool IMMER aus, wenn David nach den aktuellen Zahlen, Entwicklungen, dem Wachstum oder "wie läuft es" fragt. Alle Play-Zahlen stammen aus dem ehrlichen serverseitigen Tracking.', {}, async () => {
        try {
            const today = dateDaysAgo(0);
            const [profilesRes, songsRes, plays7Res, listen7Res, metricsRes] = await Promise.all([
                supabase.from('profiles').select('created_at, last_active_at, subscription_tier, country, acquisition_source'),
                supabase.from('songs').select('id, is_approved'),
                supabase.from('song_daily_plays').select('plays, play_date').gte('play_date', dateDaysAgo(6)),
                supabase.from('user_activity_days').select('listened_seconds, day').gte('day', dateDaysAgo(6)),
                supabase.from('metrics_daily').select('*').order('day', { ascending: false }).limit(1),
            ]);
            for (const res of [profilesRes, songsRes, plays7Res, listen7Res, metricsRes]) {
                if (res.error)
                    throw new Error(res.error.message);
            }
            const profiles = profilesRes.data ?? [];
            const songs = songsRes.data ?? [];
            const latestSnapshot = metricsRes.data?.[0];
            const activeSince = (iso) => profiles.filter((p) => p.last_active_at && p.last_active_at >= iso).length;
            const createdSince = (iso) => profiles.filter((p) => p.created_at >= iso).length;
            const sources = { apple_ads: 0, organic: 0, unknown: 0 };
            const countries = new Map();
            for (const p of profiles) {
                if (p.acquisition_source === 'apple_ads')
                    sources.apple_ads += 1;
                else if (p.acquisition_source === 'organic')
                    sources.organic += 1;
                else
                    sources.unknown += 1;
                const key = p.country || 'unbekannt';
                countries.set(key, (countries.get(key) ?? 0) + 1);
            }
            const topCountries = [...countries.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([c, n]) => `${c} ${n}`)
                .join(' · ');
            const plays7d = (plays7Res.data ?? []).reduce((sum, row) => sum + Number(row.plays ?? 0), 0);
            const playsToday = (plays7Res.data ?? [])
                .filter((row) => row.play_date === today)
                .reduce((sum, row) => sum + Number(row.plays ?? 0), 0);
            const listenHours7d = (listen7Res.data ?? []).reduce((sum, row) => sum + (row.listened_seconds ?? 0), 0) / 3600;
            const text = [
                `📊 YORIAX Live-Überblick (${new Date().toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })})`,
                '',
                `👥 Nutzer: ${fmt(profiles.length)} gesamt · ${fmt(profiles.filter((p) => p.subscription_tier === 'pro').length)} Pro`,
                `   Neu: heute ${fmt(createdSince(today))} · 7 Tage ${fmt(createdSince(isoDaysAgo(7)))} · 30 Tage ${fmt(createdSince(isoDaysAgo(30)))}`,
                `   Aktiv: 24 h ${fmt(activeSince(isoDaysAgo(1)))} · 7 Tage ${fmt(activeSince(isoDaysAgo(7)))}` +
                    (latestSnapshot?.dau != null ? ` · DAU lt. Snapshot (${latestSnapshot.day}): ${fmt(latestSnapshot.dau)}` : ''),
                `   Herkunft: Apple Ads ${fmt(sources.apple_ads)} · organisch ${fmt(sources.organic)} · unbekannt ${fmt(sources.unknown)}`,
                `   Top-Länder: ${topCountries || '–'}`,
                '',
                `▶️ Echte Plays (getrackt): heute ${fmt(playsToday)} · letzte 7 Tage ${fmt(plays7d)}`,
                `🎧 Hörzeit letzte 7 Tage: ${listenHours7d.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h (erfasst seit 03.07.2026, App ≥ 1.0.9)`,
                `🎵 Katalog: ${fmt(songs.filter((s) => s.is_approved !== false).length)} freigegebene Songs (${fmt(songs.length)} gesamt)`,
                '',
                `Hinweis: Anzeige-Zähler in der App sind Marketing-Werte; diese Zahlen hier sind die ehrliche Tracking-Ebene. Tagesverläufe: get_daily_metrics, Song-Ranking: get_top_songs_analytics.`,
            ].join('\n');
            return { content: [{ type: 'text', text }] };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ Analytics-Fehler: ${err.message}` }] };
        }
    });
    // ── Tool: get_daily_metrics ───────────────────────────────────────────────
    server.tool('get_daily_metrics', 'Tägliche Kennzahlen-Snapshots der YORIAX-Plattform (Nutzer gesamt, neue Nutzer, DAU, echte Plays, Hörminuten, neue Songs, neue Likes) — eine Zeile pro Tag, neueste zuerst. Nutze dieses Tool, wenn David Verläufe, Trends oder die Entwicklung über Zeit sehen will. Snapshots laufen nächtlich um 02:15 UTC; DAU und Hörminuten werden seit 03.07.2026 erfasst.', {
        days: z.number().int().min(1).max(120).optional().describe('Wie viele Tage zurück (Standard 30)'),
    }, async ({ days }) => {
        try {
            const { data, error } = await supabase
                .from('metrics_daily')
                .select('day, total_users, new_users, dau, plays, minutes_streamed, new_songs, new_likes')
                .order('day', { ascending: false })
                .limit(days ?? 30);
            if (error)
                throw new Error(error.message);
            if (!data?.length)
                return { content: [{ type: 'text', text: 'Noch keine Snapshots vorhanden.' }] };
            const header = 'Tag         | Nutzer | Neu | DAU | Plays | Hörmin | Songs+ | Likes+';
            const lines = data.map((r) => [
                r.day,
                String(r.total_users ?? '–').padStart(6),
                String(r.new_users ?? '–').padStart(3),
                String(r.dau ?? '–').padStart(3),
                String(r.plays ?? '–').padStart(5),
                String(r.minutes_streamed ?? '–').padStart(6),
                String(r.new_songs ?? '–').padStart(6),
                String(r.new_likes ?? '–').padStart(6),
            ].join(' | '));
            return {
                content: [{ type: 'text', text: `📈 Tages-Snapshots (neueste zuerst):\n\n${header}\n${lines.join('\n')}` }],
            };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ Analytics-Fehler: ${err.message}` }] };
        }
    });
    // ── Tool: get_top_songs_analytics ─────────────────────────────────────────
    server.tool('get_top_songs_analytics', 'Top-Songs der YORIAX-Plattform nach ECHTEN, getrackten Wiedergaben in einem Zeitfenster (nicht nach den Anzeige-Zählern). Nutze dieses Tool, wenn David wissen will, welche Songs gerade laufen oder am besten performen.', {
        days: z.number().int().min(1).max(90).optional().describe('Zeitfenster in Tagen (Standard 7)'),
        limit: z.number().int().min(1).max(50).optional().describe('Wie viele Songs (Standard 10)'),
    }, async ({ days, limit }) => {
        try {
            const windowDays = days ?? 7;
            const { data: playRows, error } = await supabase
                .from('song_daily_plays')
                .select('song_id, plays')
                .gte('play_date', dateDaysAgo(windowDays - 1));
            if (error)
                throw new Error(error.message);
            const bySong = new Map();
            for (const row of playRows ?? []) {
                bySong.set(row.song_id, (bySong.get(row.song_id) ?? 0) + Number(row.plays ?? 0));
            }
            const top = [...bySong.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit ?? 10);
            if (top.length === 0) {
                return { content: [{ type: 'text', text: `Keine getrackten Wiedergaben in den letzten ${windowDays} Tagen.` }] };
            }
            const { data: songRows, error: songsError } = await supabase
                .from('songs')
                .select('id, title, artist_name, genre')
                .in('id', top.map(([id]) => id));
            if (songsError)
                throw new Error(songsError.message);
            const songById = new Map((songRows ?? []).map((s) => [s.id, s]));
            const lines = top.map(([id, plays], index) => {
                const song = songById.get(id);
                const label = song ? `${song.title} — ${song.artist_name}${song.genre ? ` (${song.genre})` : ''}` : id;
                return `${String(index + 1).padStart(2)}. ${label}: ${fmt(plays)} Plays`;
            });
            return {
                content: [{ type: 'text', text: `🏆 Top-Songs nach echten Plays (letzte ${windowDays} Tage):\n\n${lines.join('\n')}` }],
            };
        }
        catch (err) {
            return { content: [{ type: 'text', text: `❌ Analytics-Fehler: ${err.message}` }] };
        }
    });
}
