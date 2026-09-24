import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  // Derive from the live request rather than trusting NEXTAUTH_URL to be
  // correctly set to an https:// value - a wrong/stale NEXTAUTH_URL (e.g.
  // still pointing at localhost) makes getToken look for the unprefixed
  // cookie name while the app actually issues the __Secure- prefixed one,
  // so every authenticated request silently reads back no token at all.
  const secureCookie = request.nextUrl.protocol === 'https:';
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, secureCookie });

  if (token) {
    return NextResponse.next();
  }

  const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const registerUrl = new URL('/register', request.url);
  registerUrl.searchParams.set('callbackUrl', callbackUrl);

  return NextResponse.redirect(registerUrl);
}

export const config = {
  matcher: [
    '/',
    '/projects/:path*',
    '/admin/:path*',
    '/account/:path*',
    '/guide',
    '/solutions',
  ],
};
