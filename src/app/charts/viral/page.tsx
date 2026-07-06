import { redirect } from 'next/navigation';

// Charts wurden zugunsten von Playlists eingestellt (2026-07-06).
export default function ViralChartsRedirect() {
  redirect('/playlists');
}
