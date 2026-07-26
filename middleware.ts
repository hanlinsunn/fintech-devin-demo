import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, isAnalyst } from '@/lib/auth';

const SIGN_IN_PATH = '/sign-in';

/** Sends anyone without a signed-in analyst to the sign-in screen. */
export function middleware(request: NextRequest) {
  const signedIn = isAnalyst(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (!signedIn && pathname !== SIGN_IN_PATH) {
    return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
  }
  if (signedIn && pathname === SIGN_IN_PATH) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
