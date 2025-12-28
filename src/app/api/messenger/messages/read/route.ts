'use server';

import { NextResponse } from 'next/server';
import ChatMessageModel from '@/server/models/ChatMessageModel';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import {
    findUserIdsByEmails,
    getRecipientEmailsForConversation,
    normalizeEmail,
    requireConversationAccess,
    type AccessContext,
} from '@/server/messenger/helpers';
import { notificationSocketGateway } from '@/server/socket/notificationSocket';

export async function POST(request: Request) {
    const currentUser = await GetCurrentUserFromMongoDB();
    if (!currentUser.success) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userEmail = normalizeEmail(currentUser.data.email);
    const userId = currentUser.data._id?.toString() ?? '';
    if (!userEmail) {
        return NextResponse.json({ error: 'Email отсутствует' }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as
        | { conversationId?: string }
        | null;
    const conversationId = body?.conversationId;
    if (!conversationId) {
        return NextResponse.json({ error: 'conversationId обязателен' }, { status: 400 });
    }

    let access: AccessContext;
    try {
        access = await requireConversationAccess(
            conversationId,
            userEmail,
            userId,
            currentUser.data.platformRole === 'super_admin'
        );
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }

    const unreadMessages = await ChatMessageModel.find({
        conversationId,
        readBy: { $ne: userEmail },
    })
        .select({ _id: 1 })
        .lean()
        .exec();

    const messageIds = unreadMessages.map((m) => m._id?.toString?.()).filter(Boolean) as string[];

    if (messageIds.length) {
        await ChatMessageModel.updateMany(
            { _id: { $in: messageIds } },
            { $addToSet: { readBy: userEmail } }
        ).exec();
    }

    const unreadCount = await ChatMessageModel.countDocuments({
        conversationId,
        readBy: { $ne: userEmail },
    }).exec();

    const recipientEmails = await getRecipientEmailsForConversation(access);
    const uniqueRecipientEmails = Array.from(new Set(recipientEmails.map(normalizeEmail)).add(userEmail)).filter(Boolean);
    const recipientUserIds = await findUserIdsByEmails(uniqueRecipientEmails);

    if (messageIds.length > 0) {
        notificationSocketGateway.emitChatRead(
            conversationId,
            { conversationId, userEmail, messageIds },
            recipientUserIds
        );
    }
    notificationSocketGateway.emitChatUnread(conversationId, { conversationId, unreadCount, userEmail }, recipientUserIds);

    return NextResponse.json({ ok: true, unreadCount });
}
