import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import { GetUserContext } from '@/server-actions/user-context';
import UserModel from '@/server/models/UserModel';
import { createNotification } from '@/server/notifications/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ModerationStatus = 'pending' | 'approved' | 'rejected';

type ModerationPayload = {
    status?: ModerationStatus;
    comment?: string;
};

type ModerationResponse =
    | { ok: true; status: ModerationStatus; comment: string }
    | { error: string };

const normalizeComment = (value?: string) => (value ?? '').trim().slice(0, 1000);

export async function PATCH(
    request: Request,
    ctx: { params: Promise<{ userId: string }> }
): Promise<NextResponse<ModerationResponse>> {
    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId: userRaw } = await ctx.params;
    const clerkUserId = userRaw?.trim();
    if (!clerkUserId) {
        return NextResponse.json({ error: 'User not specified' }, { status: 400 });
    }

    const body = (await request.json()) as ModerationPayload;
    const status = body.status;
    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
        return NextResponse.json(
            { error: 'Некорректный статус модерации' },
            { status: 400 }
        );
    }

    const comment = normalizeComment(body.comment);
    if (status === 'rejected' && !comment) {
        return NextResponse.json(
            { error: 'Укажите комментарий для отказа' },
            { status: 400 }
        );
    }

    await dbConnect();
    const user = await UserModel.findOneAndUpdate(
        { clerkUserId },
        { portfolioStatus: status, moderationComment: comment },
        { new: true }
    ).lean();

    if (!user?._id) {
        return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    if (status === 'approved' || status === 'rejected') {
        const message =
            status === 'approved'
                ? 'Ваш профиль успешно прошел модерацию.'
                : `Профиль отклонен. ${comment}`;

        try {
            await createNotification({
                recipientUserId: user._id,
                type: 'profile_moderation',
                title: status === 'approved' ? 'Профиль подтвержден' : 'Профиль отклонен',
                message,
                link: '/profile',
            });
        } catch (error) {
            console.error('Failed to notify about profile moderation', error);
        }
    }

    return NextResponse.json({
        ok: true,
        status,
        comment,
    });
}
