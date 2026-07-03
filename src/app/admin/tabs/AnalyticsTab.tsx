import { formatAdminNumber, type MetricsDailyRow } from '../types';

function formatDayLabel(day: string) {
  const date = new Date(day);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

/** Lightweight bar chart (pure SVG, no dependency) for one metric per day. */
function MetricBarChart({
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
  const values = rows.map((row) => getValue(row));
  const max = Math.max(1, ...values.map((value) => value ?? 0));
  const barWidth = 100 / Math.max(1, rows.length);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-xs text-white/40">{subtitle}</span>
      </div>
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

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-xs text-white/40">{subtitle}</span>
      </div>
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

export function AnalyticsTab({ metrics }: { metrics: MetricsDailyRow[] }) {
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

  const kpis: Array<[string, string, string]> = [
    ['Nutzer gesamt', formatAdminNumber(latest.total_users), `Stand ${formatDayLabel(latest.day)}`],
    ['Neue Nutzer (7 Tage)', formatAdminNumber(newUsers7d), 'Summe der letzten 7 Snapshots'],
    ['Plays (7 Tage)', formatAdminNumber(plays7d), 'echte Wiedergaben via Tracking'],
    ['DAU (gestern)', latest.dau === null ? '—' : formatAdminNumber(latest.dau), 'aktive Nutzer, erfasst seit 03.07.'],
    ['Hörzeit (7 Tage)', `${formatAdminNumber(Math.round(minutes7d / 60))} h`, 'echte Wiedergabezeit, erfasst seit 03.07.'],
  ];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h2 className="mb-1 text-2xl font-bold text-white">Analytics</h2>
          <p className="text-sm text-white/60">
            Tägliche Snapshots (02:15 UTC) aus <code className="text-white/50">metrics_daily</code>. Die
            Plays-Kurve zeigt ausschließlich echte, getrackte Wiedergaben.
          </p>
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
