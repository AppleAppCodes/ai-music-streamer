export function formatPlays(value: number | null | undefined): string {
  const plays = value || 0;

  if (plays >= 1_000_000) {
    return `${(plays / 1_000_000).toFixed(plays >= 10_000_000 ? 0 : 1)}M`;
  }

  if (plays >= 1_000) {
    return `${(plays / 1_000).toFixed(plays >= 10_000 ? 0 : 1)}K`;
  }

  return String(plays);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '--:--';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}
