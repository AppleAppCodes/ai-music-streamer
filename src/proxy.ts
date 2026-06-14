import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isAdminUser } from './lib/admin';
import { isPrelaunchLockEnabled } from './lib/prelaunch';

function isPublicPath(pathname: string) {
  return pathname === '/'
    || pathname === '/site.webmanifest'
    || pathname.startsWith('/login')
    || pathname.startsWith('/search')
    || pathname.startsWith('/impressum')
    || pathname.startsWith('/datenschutz')
    || pathname.startsWith('/agb')
    || pathname.startsWith('/auth');
}

function isPrelaunchAllowedPath(pathname: string) {
  return pathname === '/'
    || pathname === '/site.webmanifest'
    || pathname === '/robots.txt'
    || pathname.startsWith('/login')
    || pathname.startsWith('/auth')
    || pathname.startsWith('/api/auth')
    || pathname.startsWith('/impressum')
    || pathname.startsWith('/datenschutz')
    || pathname.startsWith('/agb');
}

function getSafeSignedInRedirect(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get('next');
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//') || nextPath.startsWith('/login')) {
    return '/';
  }

  return nextPath;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isAdmin = isAdminUser(user);

  if (isPrelaunchLockEnabled() && !isAdmin && !isPrelaunchAllowedPath(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (user && pathname.startsWith('/login')) {
    const redirectPath = getSafeSignedInRedirect(request);
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)',
  ],
};
