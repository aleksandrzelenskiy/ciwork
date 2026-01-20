import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const normalizedBasePath = rawBasePath.replace(/\/+$/, "");
const BASE_PATH = normalizedBasePath
    ? normalizedBasePath.startsWith("/")
        ? normalizedBasePath
        : `/${normalizedBasePath}`
    : "";

const withBasePath = (path: string) => {
    if (!BASE_PATH) return path;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (normalizedPath === BASE_PATH || normalizedPath.startsWith(`${BASE_PATH}/`)) {
        return normalizedPath;
    }
    return `${BASE_PATH}${normalizedPath}`;
};

const addBasePath = (routes: string[]) => {
    if (!BASE_PATH) return routes;
    return Array.from(
        new Set(
            routes.flatMap((route) => {
                const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
                return [normalizedRoute, withBasePath(normalizedRoute)];
            })
        )
    );
};

const isPublicRoute = createRouteMatcher(addBasePath([
    // "/" чтобы любые входы без авторизации редиректились на sign-in
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/api/internal(.*)",
    "/api/current-user(.*)",
    "/api/socket(.*)",
    "/api/webhooks(.*)",
]));

const isReportPageRoute = createRouteMatcher(addBasePath(["/reports(.*)"]));
const isReportApiRoute = createRouteMatcher(addBasePath(["/api/reports(.*)"]));

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
        signInUrl: withBasePath("/sign-in"),
        signUpUrl: withBasePath("/sign-up"),
    }
);

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
        "/(api|trpc)(.*)",
    ],
};
