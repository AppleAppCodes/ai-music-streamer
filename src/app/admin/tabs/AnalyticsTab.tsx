import { useMemo } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { formatAdminNumber, type MetricsDailyRow, type ProfileData, type SongData } from '../types';

function formatDayLabel(day: string) {
  const date = new Date(day);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function formatDayFull(day: string) {
  return new Date(day).toLocaleDateString('de-DE');
}

function formatAverage(value: number) {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

/** Lightweight bar chart (pure SVG, no dependency) for one metric per day. */
function MetricBarChart({
  title,
  subtitle,
  rows,
  getValue,
  color,
  showSum = true,
}: {
  title: string;
  subtitle: string;
  rows: MetricsDailyRow[];
  getValue: (row: MetricsDailyRow) => number | null;
  color: string;
  /** Hide the Σ stat where summing days makes no sense (e.g. DAU). */
  showSum?: boolean;
}) {
  const values = rows.map((row) => getValue(row));
  const tracked = values.filter((value): value is number => value !== null && value !== undefined);
  const sum = tracked.reduce((acc, value) => acc + value, 0);
  const peak = tracked.length > 0 ? Math.max(...tracked) : 0;
  const average = tracked.length > 0 ? sum / tracked.length : 0;
  const max = Math.max(1, peak);
  const barWidth = 100 / Math.max(1, rows.length);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-xs text-white/40">{subtitle}</span>
      </div>
      <p className="text-xs font-medium text-white/50">
        {tracked.length > 0 ? (
          <>
            Ø {formatAverage(average)}/Tag · Peak {formatAdminNumber(peak)}
            {showSum ? <> · Σ {formatAdminNumber(sum)}</> : null}
          </>
        ) : (
          'noch keine Daten erfasst'
        )}
      </p>
      <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="mt-3 h-28 w-full">
        {rows.map((row, index) => {
          const value = getValue(row);
          if (value === null || value === undefined) return null;
          const height = (value / max) * 30;
          return (
            <rect
              key={row.day}
              x={index * barWidth + barWidth * 0.15}
              y={34 - height}
              width={barWidth * 0.7}
              height={Math.max(height, value > 0 ? 0.6 : 0)}
              rx={0.6}
              fill={color}
            >
              <title>{`${formatDayLabel(row.day)}: ${formatAdminNumber(value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-white/30">
        <span>{rows.length > 0 ? formatDayLabel(rows[0].day) : ''}</span>
        <span>{rows.length > 0 ? formatDayLabel(rows[rows.length - 1].day) : ''}</span>
      </div>
    </div>
  );
}

/** Cumulative line chart (total users over time). */
function MetricLineChart({
  title,
  subtitle,
  rows,
  getValue,
  color,
}: {
  title: string;
  subtitle: string;
  rows: MetricsDailyRow[];
  getValue: (row: MetricsDailyRow) => number | null;
  color: string;
}) {
  const values = rows.map((row) => getValue(row) ?? 0);
  const max = Math.max(1, ...values);
  const stepX = 100 / Math.max(1, rows.length - 1);
  const points = values.map((value, index) => `${index * stepX},${34 - (value / max) * 30}`).join(' ');
  const first = values.length > 0 ? values[0] : 0;
  const latest = values.length > 0 ? values[values.length - 1] : 0;
  const growth = latest - first;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-xs text-white/40">{subtitle}</span>
      </div>
      <p className="text-xs font-medium text-white/50">
        {rows.length > 0 ? (
          <>
            Aktuell {formatAdminNumber(latest)} · {growth >= 0 ? '+' : ''}
            {formatAdminNumber(growth)} seit {formatDayLabel(rows[0].day)}
          </>
        ) : (
          'noch keine Daten erfasst'
        )}
      </p>
      <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="mt-3 h-28 w-full">
        <polyline points={points} fill="none" stroke={color} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-white/30">
        <span>{rows.length > 0 ? formatDayLabel(rows[0].day) : ''}</span>
        <span>{rows.length > 0 ? formatDayLabel(rows[rows.length - 1].day) : ''}</span>
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string),
  );
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Raw daily snapshots as semicolon-CSV (German Excel opens it directly). */
function buildMetricsCsv(metrics: MetricsDailyRow[]) {
  const header = [
    'Tag', 'Nutzer gesamt', 'Neue Nutzer', 'DAU', 'Plays (getrackt)', 'Hörminuten',
    'Neue Songs', 'Songs gesamt', 'Neue Likes', 'Likes gesamt', 'Aktive Creator', 'Pro-Nutzer',
  ];
  const lines = metrics.map((row) =>
    [
      row.day,
      row.total_users ?? '', row.new_users ?? '', row.dau ?? '', row.plays ?? '',
      row.minutes_streamed ?? '', row.new_songs ?? '', row.total_songs ?? '',
      row.new_likes ?? '', row.total_likes ?? '', row.active_creators ?? '', row.pro_users ?? '',
    ].join(';'),
  );
  // BOM so Excel detects UTF-8 (umlauts in the header).
  return `﻿${[header.join(';'), ...lines].join('\r\n')}`;
}

/** Self-contained, print-friendly HTML report with every relevant number. */
function buildReportHtml(metrics: MetricsDailyRow[], profiles: ProfileData[], songs: SongData[]) {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();
  const isActiveSince = (profile: ProfileData, sinceMs: number) =>
    (profile.last_active_at && new Date(profile.last_active_at).getTime() >= sinceMs) ||
    (profile.last_played_at && new Date(profile.last_played_at).getTime() >= sinceMs);

  const totalUsers = profiles.length;
  const proUsers = profiles.filter((p) => p.subscription_tier === 'pro').length;
  const newUsers7 = profiles.filter((p) => nowMs - new Date(p.created_at).getTime() <= 7 * dayMs).length;
  const newUsers30 = profiles.filter((p) => nowMs - new Date(p.created_at).getTime() <= 30 * dayMs).length;
  const active24h = profiles.filter((p) => isActiveSince(p, nowMs - dayMs)).length;
  const active7d = profiles.filter((p) => isActiveSince(p, nowMs - 7 * dayMs)).length;
  const active30d = profiles.filter((p) => isActiveSince(p, nowMs - 30 * dayMs)).length;

  const approvedSongs = songs.filter((s) => s.is_approved !== false).length;
  const artistCount = new Set(songs.map((s) => s.artist_name).filter(Boolean)).size;
  const totalLikes = songs.reduce((acc, s) => acc + (s.likes_count ?? 0), 0);

  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const last7 = metrics.slice(-7);
  const plays7d = last7.reduce((acc, row) => acc + (row.plays ?? 0), 0);
  const minutes7d = last7.reduce((acc, row) => acc + (row.minutes_streamed ?? 0), 0);
  const trackedPlaysTotal = latest?.total_plays ?? 0;

  const sourceCounts = { apple_ads: 0, organic: 0, unknown: 0 };
  for (const profile of profiles) {
    if (profile.acquisition_source === 'apple_ads') sourceCounts.apple_ads += 1;
    else if (profile.acquisition_source === 'organic') sourceCounts.organic += 1;
    else sourceCounts.unknown += 1;
  }
  const sourcePercent = (count: number) =>
    totalUsers > 0 ? `${((count / totalUsers) * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %` : '–';

  const countryCounts = new Map<string, number>();
  for (const profile of profiles) {
    const key = profile.country || 'Unbekannt';
    countryCounts.set(key, (countryCounts.get(key) ?? 0) + 1);
  }
  const countries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]);

  const versionCounts = new Map<string, number>();
  let withoutVersion = 0;
  for (const profile of profiles) {
    if (profile.app_version) versionCounts.set(profile.app_version, (versionCounts.get(profile.app_version) ?? 0) + 1);
    else withoutVersion += 1;
  }
  const versions = [...versionCounts.entries()].sort((a, b) => b[1] - a[1]);

  const topSongs = songs
    .filter((s) => (s.plays_30d ?? 0) > 0)
    .sort((a, b) => (b.plays_30d ?? 0) - (a.plays_30d ?? 0))
    .slice(0, 10);

  const num = (value?: number | null) => formatAdminNumber(value ?? 0);
  const kpiCard = (label: string, value: string, hint = '') =>
    `<div class="kpi"><span class="muted">${label}</span><b>${value}</b>${hint ? `<span class="muted">${hint}</span>` : ''}</div>`;

  const kpis = [
    kpiCard('Nutzer gesamt', num(totalUsers), 'Live-Stand'),
    kpiCard('Pro-Abonnenten', num(proUsers)),
    kpiCard('Neue Nutzer (7 Tage)', num(newUsers7)),
    kpiCard('Neue Nutzer (30 Tage)', num(newUsers30)),
    kpiCard('Aktiv (letzte 24 h)', num(active24h)),
    kpiCard('Aktiv (letzte 7 Tage)', num(active7d)),
    kpiCard('MAU (letzte 30 Tage)', num(active30d), 'Messung seit 03.07.2026'),
    kpiCard('Songs (freigegeben)', num(approvedSongs), `von ${num(songs.length)} gesamt`),
    kpiCard('Künstler im Katalog', num(artistCount)),
    kpiCard('Likes gesamt', num(totalLikes)),
    kpiCard('Getrackte Plays gesamt', num(Number(trackedPlaysTotal))),
    kpiCard('Plays (letzte 7 Tage)', num(plays7d)),
    kpiCard('Hörzeit (letzte 7 Tage)', `${num(Math.round(minutes7d / 60))} h`, 'erfasst seit 03.07.2026'),
  ].join('');

  const metricsRows = [...metrics]
    .reverse()
    .map(
      (row) => `<tr>
        <td>${formatDayFull(row.day)}</td>
        <td>${row.total_users === null ? '–' : num(row.total_users)}</td>
        <td>${row.new_users === null ? '–' : num(row.new_users)}</td>
        <td>${row.dau === null || row.dau === undefined ? '–' : num(row.dau)}</td>
        <td>${row.plays === null ? '–' : num(row.plays)}</td>
        <td>${row.minutes_streamed === null || row.minutes_streamed === undefined ? '–' : num(row.minutes_streamed)}</td>
        <td>${row.new_songs === null ? '–' : num(row.new_songs)}</td>
        <td>${row.new_likes === null ? '–' : num(row.new_likes)}</td>
      </tr>`,
    )
    .join('');

  const topSongRows = topSongs
    .map(
      (song, index) => `<tr>
        <td>${index + 1}. ${escapeHtml(song.title)}</td>
        <td style="text-align:left">${escapeHtml(song.artist_name || '–')}</td>
        <td>${num(song.plays_30d)}</td>
        <td>${num(song.plays_7d)}</td>
        <td>${num(song.unique_listeners)}</td>
        <td>${num(song.likes_count)}</td>
      </tr>`,
    )
    .join('');

  const countryRows = countries
    .map(([country, count]) => `<tr><td>${escapeHtml(country)}</td><td>${num(count)}</td><td>${sourcePercent(count)}</td></tr>`)
    .join('');

  const versionRows = [
    ...versions.map(([version, count]) => `<tr><td>${escapeHtml(version)}</td><td>${num(count)}</td></tr>`),
    withoutVersion > 0 ? `<tr><td>ohne Angabe (Web / ältere App)</td><td>${num(withoutVersion)}</td></tr>` : '',
  ].join('');

  const rangeLabel =
    metrics.length > 0 ? `${formatDayFull(metrics[0].day)} bis ${formatDayFull(metrics[metrics.length - 1].day)}` : '–';

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>YORIAX Kennzahlen-Report</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #14141c; max-width: 920px; margin: 40px auto; padding: 0 24px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 17px; margin: 36px 0 8px; border-bottom: 2px solid #ececf2; padding-bottom: 6px; }
  .muted { color: #6b6b78; font-size: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 16px; }
  .kpi { border: 1px solid #e4e4ec; border-radius: 10px; padding: 12px 14px; }
  .kpi b { display: block; font-size: 22px; margin: 4px 0 2px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
  th, td { border: 1px solid #e4e4ec; padding: 6px 9px; text-align: right; white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; }
  th { background: #f7f7fa; font-size: 12px; }
  tr:nth-child(even) td { background: #fbfbfd; }
  .note { background: #f5f5f8; border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #55555f; margin-top: 36px; line-height: 1.6; }
  @media print { body { margin: 12px auto; } .kpi b { font-size: 18px; } }
</style>
</head>
<body>
<h1>YORIAX — Kennzahlen-Report</h1>
<p class="muted">Erstellt am ${now.toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' })} Uhr · Snapshot-Zeitraum: ${rangeLabel} · Quelle: Live-Datenbank + tägliche Snapshots (02:15 UTC)</p>

<h2>Kennzahlen im Überblick (Live-Stand)</h2>
<div class="kpis">${kpis}</div>

<h2>Nutzerherkunft (Akquisition)</h2>
<table>
  <tr><th>Quelle</th><th>Nutzer</th><th>Anteil</th></tr>
  <tr><td>Apple Search Ads</td><td>${num(sourceCounts.apple_ads)}</td><td>${sourcePercent(sourceCounts.apple_ads)}</td></tr>
  <tr><td>Organisch</td><td>${num(sourceCounts.organic)}</td><td>${sourcePercent(sourceCounts.organic)}</td></tr>
  <tr><td>Unbekannt (vor Tracking-Start / Web)</td><td>${num(sourceCounts.unknown)}</td><td>${sourcePercent(sourceCounts.unknown)}</td></tr>
</table>

<h2>Nutzer nach Land</h2>
<table>
  <tr><th>Land</th><th>Nutzer</th><th>Anteil</th></tr>
  ${countryRows}
</table>

<h2>Tagesdaten (neueste zuerst)</h2>
<table>
  <tr><th>Tag</th><th>Nutzer gesamt</th><th>Neue Nutzer</th><th>DAU</th><th>Plays</th><th>Hörminuten</th><th>Neue Songs</th><th>Neue Likes</th></tr>
  ${metricsRows}
</table>

<h2>Top-Songs (getrackte Wiedergaben, letzte 30 Tage)</h2>
${topSongs.length > 0
    ? `<table>
  <tr><th>Song</th><th>Künstler</th><th>Plays 30 T</th><th>Plays 7 T</th><th>Hörer</th><th>Likes</th></tr>
  ${topSongRows}
</table>`
    : '<p class="muted">Noch keine getrackten Wiedergaben im Zeitraum.</p>'}

<h2>App-Versionen im Einsatz</h2>
<table>
  <tr><th>Version</th><th>Nutzer</th></tr>
  ${versionRows}
</table>

<div class="note">
  <b>Methodik:</b> Alle Wiedergabezahlen in diesem Report stammen ausschließlich aus dem serverseitigen Tracking
  (nicht aus den in der App angezeigten kumulativen Zählern). Plays werden pro Nutzer und Song höchstens alle
  30 Minuten gewertet; ab App-Version 1.0.9 zählt ein Play erst nach 25 Sekunden tatsächlicher Hörzeit.
  DAU und Hörzeit werden seit 03.07.2026 erfasst (davor „–&#8203;"). Tages-Snapshots laufen automatisch um
  02:15 UTC; die Historie ab 31.05.2026 wurde rückwirkend aus den Tracking-Rohdaten berechnet.
  Zum Weitergeben: Diese Datei kann direkt im Browser geöffnet und über „Drucken“ als PDF gespeichert werden.
</div>
</body>
</html>`;
}

export function AnalyticsTab({
  metrics,
  profiles,
  songs,
}: {
  metrics: MetricsDailyRow[];
  profiles: ProfileData[];
  songs: SongData[];
}) {
  // MAU live from the loaded user list: anyone active (app/web open or play)
  // within the last 30 days. Activity tracking started 2026-07-03, so early
  // on this undercounts users who were only active before that.
  // (Hook stays above the early return — rules of hooks.)
  const mau = useMemo(() => {
    const nowMs = new Date().getTime();
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    return profiles.filter(
      (p) =>
        (p.last_active_at && nowMs - new Date(p.last_active_at).getTime() <= monthMs) ||
        (p.last_played_at && nowMs - new Date(p.last_played_at).getTime() <= monthMs),
    ).length;
  }, [profiles]);

  if (metrics.length === 0) {
    return (
      <div className="p-12 text-center text-white/50">
        Noch keine Kennzahlen erfasst. Der nächtliche Snapshot-Job füllt diese Ansicht automatisch.
      </div>
    );
  }

  const latest = metrics[metrics.length - 1];
  const last7 = metrics.slice(-7);
  const plays7d = last7.reduce((sum, row) => sum + (row.plays ?? 0), 0);
  const newUsers7d = last7.reduce((sum, row) => sum + (row.new_users ?? 0), 0);
  const minutes7d = last7.reduce((sum, row) => sum + (row.minutes_streamed ?? 0), 0);

  const todayIso = new Date().toISOString().slice(0, 10);
  const handleDownloadReport = () =>
    downloadFile(`yoriax-report-${todayIso}.html`, buildReportHtml(metrics, profiles, songs), 'text/html;charset=utf-8');
  const handleDownloadCsv = () =>
    downloadFile(`yoriax-metriken-${todayIso}.csv`, buildMetricsCsv(metrics), 'text/csv;charset=utf-8');

  const kpis: Array<[string, string, string]> = [
    ['Nutzer gesamt', formatAdminNumber(latest.total_users), `Stand ${formatDayLabel(latest.day)}`],
    ['Neue Nutzer (7 Tage)', formatAdminNumber(newUsers7d), 'Summe der letzten 7 Snapshots'],
    ['Plays (7 Tage)', formatAdminNumber(plays7d), 'echte Wiedergaben via Tracking'],
    ['DAU (gestern)', latest.dau === null ? '—' : formatAdminNumber(latest.dau), 'aktive Nutzer, erfasst seit 03.07.'],
    ['MAU (30 Tage)', formatAdminNumber(mau), 'aktive Nutzer der letzten 30 Tage, Messung seit 03.07.'],
    ['Hörzeit (7 Tage)', `${formatAdminNumber(Math.round(minutes7d / 60))} h`, 'echte Wiedergabezeit, erfasst seit 03.07.'],
  ];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="mb-1 text-2xl font-bold text-white">Analytics</h2>
            <p className="text-sm text-white/60">
              Tägliche Snapshots (02:15 UTC) aus <code className="text-white/50">metrics_daily</code>. Die
              Plays-Kurve zeigt ausschließlich echte, getrackte Wiedergaben.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 rounded-xl border border-teal-400/25 bg-teal-400/10 px-4 py-2 text-sm font-bold text-teal-300 transition-colors hover:bg-teal-400/20"
              title="Vollständiger Kennzahlen-Report als HTML — im Browser öffnen und bei Bedarf als PDF drucken"
            >
              <Download className="h-4 w-4" /> Report
            </button>
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 transition-colors hover:bg-white/10"
              title="Tagesdaten als CSV für Excel/Numbers"
            >
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(([label, value, hint]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">{label}</p>
              <p className="mt-1 text-3xl font-black text-white">{value}</p>
              <p className="mt-1 text-[11px] text-white/35">{hint}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <MetricLineChart
            title="Nutzer gesamt"
            subtitle="kumuliert"
            rows={metrics}
            getValue={(row) => row.total_users}
            color="#818cf8"
          />
          <MetricBarChart
            title="Neue Nutzer pro Tag"
            subtitle="Anmeldungen"
            rows={metrics}
            getValue={(row) => row.new_users}
            color="#34d399"
          />
          <MetricBarChart
            title="Plays pro Tag"
            subtitle="echte Wiedergaben"
            rows={metrics}
            getValue={(row) => row.plays}
            color="#a78bfa"
          />
          <MetricBarChart
            title="DAU pro Tag"
            subtitle="seit 03.07. erfasst"
            rows={metrics}
            getValue={(row) => row.dau}
            color="#2dd4bf"
            showSum={false}
          />
          <MetricBarChart
            title="Neue Songs pro Tag"
            subtitle="Uploads"
            rows={metrics}
            getValue={(row) => row.new_songs}
            color="#f472b6"
          />
          <MetricBarChart
            title="Neue Likes pro Tag"
            subtitle="Engagement"
            rows={metrics}
            getValue={(row) => row.new_likes}
            color="#fbbf24"
          />
          <MetricBarChart
            title="Hörminuten pro Tag"
            subtitle="seit 03.07. erfasst"
            rows={metrics}
            getValue={(row) => row.minutes_streamed ?? null}
            color="#38bdf8"
          />
        </div>
      </div>
    </div>
  );
}
