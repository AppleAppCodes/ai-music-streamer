import { headers } from 'next/headers';
import { getLocaleFromAcceptLanguage } from '@/lib/locale';
import LoginPageClient from './LoginPageClient';

export default async function LoginPage() {
  const headerStore = await headers();

  return (
    <LoginPageClient locale={getLocaleFromAcceptLanguage(headerStore.get('accept-language'))} />
  );
}
