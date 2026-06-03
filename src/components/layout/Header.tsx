import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import HeaderClient from './HeaderClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function Header({ user }: { user: SupabaseUser | null }) {
  async function signOutAction() {
    'use server';
    const sb = await createClient();
    await sb.auth.signOut();
    revalidatePath('/', 'layout');
  }

  return (
    <HeaderClient user={user} signOutAction={signOutAction} />
  );
}
