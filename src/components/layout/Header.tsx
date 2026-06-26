import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import HeaderClient from './HeaderClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export default function Header({ user, customLogoUrl }: { user: SupabaseUser | null; customLogoUrl?: string }) {
  async function signOutAction() {
    'use server';
    const sb = await createClient();
    await sb.auth.signOut();
    revalidatePath('/', 'layout');
    redirect('/login');
  }

  return (
    <HeaderClient user={user} signOutAction={signOutAction} customLogoUrl={customLogoUrl} />
  );
}
