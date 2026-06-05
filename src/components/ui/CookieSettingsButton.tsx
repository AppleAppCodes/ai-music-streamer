'use client';

import { openCookieSettings } from '@/lib/cookie-consent';

export default function CookieSettingsButton({
  children = 'Cookie-Einstellungen',
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {children}
    </button>
  );
}
