import Link from 'next/link';
import { Home, Compass, Library, PlusCircle, Heart, TrendingUp, Mic2, ListMusic, Radio } from 'lucide-react';

export default function Sidebar() {
  return (
    <div className="w-64 bg-black h-full flex flex-col pt-6 pb-24 border-r border-white/5">
      <div className="px-6 mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center">
            <div className="w-3 h-3 bg-black rounded-full" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">AI Stream</span>
        </Link>
      </div>

      <div className="px-3 mb-6">
        <p className="px-3 text-xs font-semibold text-muted tracking-wider uppercase mb-3">Discover</p>
        <nav className="space-y-1">
          <Link href="/" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Home className="w-5 h-5" />
            Home
          </Link>
          <Link href="#" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <TrendingUp className="w-5 h-5" />
            Viral Charts
          </Link>
          <Link href="#" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Mic2 className="w-5 h-5" />
            Künstler Entdecken
          </Link>
          <Link href="#" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <ListMusic className="w-5 h-5" />
            Playlists
          </Link>
          <Link href="#" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Radio className="w-5 h-5" />
            Radio
          </Link>
        </nav>
      </div>

      <div className="px-3 mb-6">
        <p className="px-3 text-xs font-semibold text-muted tracking-wider uppercase mb-3">Library</p>
        <nav className="space-y-1">
          <Link href="#" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Library className="w-5 h-5" />
            Your Library
          </Link>
          <Link href="#" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
            <Heart className="w-5 h-5" />
            Liked Songs
          </Link>
        </nav>
      </div>

      <div className="px-3 mt-auto">
        <Link href="/upload" className="flex items-center gap-4 px-3 py-2.5 mb-2 text-sm font-bold text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors border border-white/10">
          <PlusCircle className="w-5 h-5" />
          Upload Song
        </Link>
        <Link href="#" className="flex items-center gap-4 px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-md transition-colors">
          <ListMusic className="w-5 h-5" />
          New Playlist
        </Link>
      </div>
    </div>
  );
}
