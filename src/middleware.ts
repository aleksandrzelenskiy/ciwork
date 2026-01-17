import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/internal(.*)',
  '/api/socket(.*)',
  '/api/webhooks(.*)',
]);
const isReportPageRoute = createRouteMatcher(['/reports(.*)']);
const isReportApiRoute = createRouteMatcher(['/api/reports(.*)']);

const hasInitiatorToken = (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  return Boolean(searchParams.get('token')?.trim());
};

const isAllowedGuestReportApi = (request: NextRequest) => {
  if (!isReportApiRoute(request)) return false;
  if (!hasInitiatorToken(request)) return false;

  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'PATCH') return false;

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 2) {
    return method === 'GET';
  }
  if (parts.length === 3 && parts[2] === 'download') {
    return method === 'GET';
  }
  if (parts.length === 4 && parts[3] === 'download') {
    return method === 'GET';
  }
  if (parts.length === 5 && parts[4] === 'download') {
    return method === 'GET';
  }
  if (parts.length === 4) {
    return method === 'GET' || method === 'PATCH';
  }
  return false;
};

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return;
  if (isReportPageRoute(request) && hasInitiatorToken(request)) return;
  if (isAllowedGuestReportApi(request)) return;

  await auth.protect();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
