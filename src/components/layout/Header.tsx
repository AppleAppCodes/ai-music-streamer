import Link from 'next/link';
import { Search, Bell, LogIn, LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="h-16 w-full flex items-center justify-between px-6 sticky top-0 z-10 glass-panel border-b border-white/5">
      <div className="flex items-center flex-1">
        {/* Search Bar */}
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-full leading-5 bg-white/5 text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white/10 sm:text-sm transition-all"
            placeholder="Search for AI tracks, creators, genres..."
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full text-muted hover:text-white hover:bg-white/10 transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        {user ? (
          <div className="flex items-center gap-4 border-l border-white/10 pl-4">
            <Link href="#" className="w-8 h-8 rounded-full overflow-hidden border border-white/20">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80" alt="User Avatar" className="w-full h-full object-cover" />
            </Link>
            
            <form action={async () => {
              'use server';
              const sb = await createClient();
              await sb.auth.signOut();
              revalidatePath('/', 'layout');
            }}>
              <button type="submit" className="text-white/60 hover:text-white transition-colors" title="Abmelden">
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <Link 
            href="/login" 
            className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform"
          >
            <LogIn className="w-4 h-4" />
            Anmelden
          </Link>
        )}
      </div>
    </header>
  );
}
