import Image from 'next/image';
import type { ProfileData } from '../types';

export function UsersTab({
  profiles,
  onRoleChange,
  onToggleBan,
}: {
  profiles: ProfileData[];
  onRoleChange: (id: string, newRole: string, username: string) => void;
  onToggleBan: (id: string, currentStatus: boolean, username: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-white/70">
        <thead className="text-xs uppercase bg-black/40 text-white/50">
          <tr>
            <th className="px-6 py-4 font-semibold">Nutzername</th>
            <th className="px-6 py-4 font-semibold">E-Mail</th>
            <th className="px-6 py-4 font-semibold">Tarif (Plan)</th>
            <th className="px-6 py-4 font-semibold">Land</th>
            <th className="px-6 py-4 font-semibold">Zuletzt aktiv</th>
            <th className="px-6 py-4 font-semibold">Aktivität</th>
            <th className="px-6 py-4 font-semibold">Zuletzt gehört</th>
            <th className="px-6 py-4 font-semibold">Beigetreten am</th>
            <th className="px-6 py-4 font-semibold text-right">Aktion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {profiles.length > 0 ? profiles.map((profile) => (
            <tr key={profile.id} className="hover:bg-white/5 transition-colors">
              <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                {profile.avatar_url ? (
                  <Image src={profile.avatar_url} alt={profile.username} width={32} height={32} className="rounded-full object-cover shadow-md" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
                    {profile.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="flex items-center gap-2">
                  {profile.username || 'Unbekannt'}
                  {profile.role === 'admin' && <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase">Admin</span>}
                  {profile.role === 'mod' && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold uppercase">Mod</span>}
                  {profile.role === 'creator' && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">Creator</span>}
                  {profile.is_banned && <span className="text-[10px] bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full font-bold uppercase">Gesperrt</span>}
                </span>
              </td>
              <td className="px-6 py-4">{profile.email || '-'}</td>
              <td className="px-6 py-4">
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider ${
                  profile.subscription_tier === 'pro' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                  profile.subscription_tier === 'premium' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                  'bg-white/10 text-white/60'
                }`}>
                  {(profile.subscription_tier || 'Free').toUpperCase()}
                </span>
              </td>
              <td className="px-6 py-4">{profile.country || '-'}</td>
              <td className="px-6 py-4">{profile.last_active_at ? new Date(profile.last_active_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-0.5 whitespace-nowrap">
                  <span className="text-white/80">▶ {(profile.total_plays ?? 0).toLocaleString('de-DE')} <span className="text-white/40">({profile.songs_played ?? 0} Songs)</span></span>
                  <span className="text-xs text-white/40">❤ {profile.likes ?? 0} · ✚ {profile.follows ?? 0} · ☰ {profile.playlists ?? 0}</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">{profile.last_played_at ? new Date(profile.last_played_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
              <td className="px-6 py-4">{new Date(profile.created_at).toLocaleDateString('de-DE')}</td>
              <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                <select
                  className="bg-white/5 border border-white/10 rounded-md text-xs px-2 py-1.5 text-white/80 focus:outline-none focus:border-indigo-500"
                  value={profile.role || 'user'}
                  onChange={(e) => onRoleChange(profile.id, e.target.value, profile.username)}
                >
                  <option value="user">User</option>
                  <option value="creator">Creator</option>
                  <option value="mod">MOD</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={() => onToggleBan(profile.id, !!profile.is_banned, profile.username)}
                  className={`text-xs px-3 py-1.5 rounded-md font-bold transition-colors ${
                    profile.is_banned
                      ? 'bg-white/10 hover:bg-white/20 text-white'
                      : 'bg-red-500/10 hover:bg-red-500/20 text-red-500'
                  }`}
                >
                  {profile.is_banned ? 'Entsperren' : 'Sperren'}
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={9} className="px-6 py-12 text-center text-white/40">Keine Nutzer gefunden.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
