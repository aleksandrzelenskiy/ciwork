// src/app/api/notifications/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import {
    countUnreadNotifications,
    fetchNotificationsForUser,
    markNotificationsAsRead,
    deleteNotifications,
    countNotificationsForUser,
} from '@/server/notifications/service';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const errorMessage = (err: unknown) =>
    err instanceof Error ? err.message : 'Server error';

const resolveStatus = (message?: string) => {
    if (!message) return 500;
    if (message.toLowerCase().includes('no user session')) return 401;
    if (message.toLowerCase().includes('not found')) return 404;
    return 400;
};

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const currentUserResponse = await GetCurrentUserFromMongoDB();
        if (!currentUserResponse.success) {
            return NextResponse.json(
                { error: currentUserResponse.message },
                { status: resolveStatus(currentUserResponse.message) }
            );
        }

        const { searchParams } = new URL(req.url);
        const limitParam = searchParams.get('limit');
        const pageParam = searchParams.get('page');
        const limit = Math.min(
            Math.max(Number.parseInt(limitParam ?? '20', 10) || 20, 1),
            100
        );
        const page = Math.max(Number.parseInt(pageParam ?? '1', 10) || 1, 1);
        const skip = (page - 1) * limit;

        const userId = currentUserResponse.data._id?.toString();
        if (!userId) {
            return NextResponse.json(
                { error: 'User identifier missing' },
                { status: 404 }
            );
        }

        const [notifications, unreadCount, totalCount] = await Promise.all([
            fetchNotificationsForUser(userId, limit, skip),
            countUnreadNotifications(userId),
            countNotificationsForUser(userId),
        ]);

        return NextResponse.json({
            ok: true,
            notifications,
            unreadCount,
            totalCount,
            page,
            limit,
            hasMore: skip + notifications.length < totalCount,
        });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        await dbConnect();
        const currentUserResponse = await GetCurrentUserFromMongoDB();
        if (!currentUserResponse.success) {
            return NextResponse.json(
                { error: currentUserResponse.message },
                { status: resolveStatus(currentUserResponse.message) }
            );
        }

        const userId = currentUserResponse.data._id?.toString();
        if (!userId) {
            return NextResponse.json(
                { error: 'User identifier missing' },
                { status: 404 }
            );
        }
        const body = (await req.json()) as {
            notificationIds?: string[];
            markAll?: boolean;
        };

        const notificationIds =
            body.markAll === true
                ? undefined
                : Array.isArray(body.notificationIds)
                ? body.notificationIds.filter((id) => id.length > 0)
                : undefined;

        const modifiedCount = await markNotificationsAsRead(
            userId,
            notificationIds
        );
        const unreadCount = await countUnreadNotifications(userId);

        return NextResponse.json({
            ok: true,
            modifiedCount,
            unreadCount,
        });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        await dbConnect();
        const currentUserResponse = await GetCurrentUserFromMongoDB();
        if (!currentUserResponse.success) {
            return NextResponse.json(
                { error: currentUserResponse.message },
                { status: resolveStatus(currentUserResponse.message) }
            );
        }

        const userId = currentUserResponse.data._id?.toString();
        if (!userId) {
            return NextResponse.json(
                { error: 'User identifier missing' },
                { status: 404 }
            );
        }

        const body = (await req.json().catch(() => null)) as
            | { notificationIds?: unknown; deleteAll?: boolean }
            | null;

        const deleteAll = body?.deleteAll === true;
        const notificationIds =
            deleteAll
                ? undefined
                : Array.isArray(body?.notificationIds)
                ? (body?.notificationIds ?? []).filter(
                      (id): id is string => typeof id === 'string' && id.length > 0
                  )
                : undefined;

        if (!deleteAll && (!notificationIds || notificationIds.length === 0)) {
            return NextResponse.json(
                { error: 'No notification IDs provided' },
                { status: 400 }
            );
        }

        const deletedCount = await deleteNotifications(userId, notificationIds);
        const unreadCount = await countUnreadNotifications(userId);

        return NextResponse.json({
            ok: true,
            deletedCount,
            unreadCount,
        });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
