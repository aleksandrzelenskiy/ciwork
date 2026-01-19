import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/internal(.*)",
  "/api/current-user(.*)",
  "/api/socket(.*)",
  "/api/webhooks(.*)",
]);

const isReportPageRoute = createRouteMatcher(["/reports(.*)"]);

const isReportApiRoute = createRouteMatcher(["/api/reports(.*)"]);

const hasInitiatorToken = (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  return Boolean(searchParams.get("token")?.trim());
};

const isAllowedGuestReportApi = (request: NextRequest) => {
  if (!isReportApiRoute(request)) return false;
  if (!hasInitiatorToken(request)) return false;

  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "PATCH") return false;

  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 2) return method === "GET";
  if (parts.length === 3 && parts[2] === "download") return method === "GET";
  if (parts.length === 4 && parts[3] === "download") return method === "GET";
  if (parts.length === 5 && parts[4] === "download") return method === "GET";
  if (parts.length === 4) return method === "GET" || method === "PATCH";
  return false;
};

export default clerkMiddleware(
  async (auth, request) => {
    // Инициализируем auth для всех запросов, чтобы auth()/currentUser()
    // в Server Components/Route Handlers всегда находили middleware.
    await auth();

    // Публичные/гостевые маршруты — просто пропускаем
    if (isPublicRoute(request)) return NextResponse.next();
    if (isReportPageRoute(request) && hasInitiatorToken(request)) return NextResponse.next();
    if (isAllowedGuestReportApi(request)) return NextResponse.next();

    // Защищаем всё остальное
    await auth.protect();
    return NextResponse.next();
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
