import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import HeaderClient from './HeaderClient';

export default async function Header() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
