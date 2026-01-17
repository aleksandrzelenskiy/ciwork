import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { withBasePath } from '@/utils/basePath';

const isPublicRoute = createRouteMatcher([
  withBasePath('/sign-in(.*)'),
  withBasePath('/sign-up(.*)'),
  withBasePath('/api/internal(.*)'),
  withBasePath('/api/socket(.*)'),
  withBasePath('/api/webhooks(.*)'),
]);
const isReportPageRoute = createRouteMatcher([withBasePath('/reports(.*)')]);
const isReportApiRoute = createRouteMatcher([withBasePath('/api/reports(.*)')]);

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
    '/ws/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/ws/(api|trpc)(.*)',
  ],
};
