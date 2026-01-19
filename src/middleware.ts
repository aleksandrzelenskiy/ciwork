import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
    // "/" чтобы любые входы без авторизации редиректились на sign-in
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
    // /api/reports/:id
    if (parts.length === 2) return method === "GET";
    // /api/reports/:id/download or deeper download paths that you listed
    if (parts.length >= 3 && parts.includes("download")) return method === "GET";
    // /api/reports/:id/photos/:photoId (пример твоей логики по длине)
    if (parts.length === 4) return method === "GET" || method === "PATCH";

    return false;
};

export default clerkMiddleware(
    async (auth, request) => {
        // 1) Публичные маршруты пропускаем
        if (isPublicRoute(request)) return NextResponse.next();

        // 2) Гостевой доступ к отчёту по token (страница)
        if (isReportPageRoute(request) && hasInitiatorToken(request)) {
            return NextResponse.next();
        }

        // 3) Гостевой доступ к API отчёта по token
        if (isAllowedGuestReportApi(request)) {
            return NextResponse.next();
        }

        // 4) Всё остальное — строго под авторизацию => редирект на /sign-in
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
