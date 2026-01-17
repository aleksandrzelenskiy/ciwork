import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { withBasePath } from '@/utils/basePath';

const withOptionalBasePath = (path: string): string[] => [
  path,
  withBasePath(path),
];

const isPublicRoute = createRouteMatcher([
  ...withOptionalBasePath('/'),
  ...withOptionalBasePath('/sign-in(.*)'),
  ...withOptionalBasePath('/sign-up(.*)'),
  ...withOptionalBasePath('/api/internal(.*)'),
  ...withOptionalBasePath('/api/current-user(.*)'),
  ...withOptionalBasePath('/api/socket(.*)'),
  ...withOptionalBasePath('/api/webhooks(.*)'),
]);
const isReportPageRoute = createRouteMatcher([
  ...withOptionalBasePath('/reports(.*)'),
]);
const isReportApiRoute = createRouteMatcher([
  ...withOptionalBasePath('/api/reports(.*)'),
]);

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
    '/((?!_next|.*\\..*).*)',
    '/(api|trpc)(.*)',
  ],
};
