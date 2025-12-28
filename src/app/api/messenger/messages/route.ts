'use server';

import { NextResponse } from 'next/server';
import ChatMessageModel from '@/server/models/ChatMessageModel';
import ChatConversationModel from '@/server/models/ChatConversationModel';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import {
    chatMessageToDTO,
    findUserIdsByEmails,
    getRecipientEmailsForConversation,
    normalizeEmail,
    requireConversationAccess,
    type AccessContext,
    type ChatMessageLike,
} from '@/server/messenger/helpers';
import { notificationSocketGateway } from '@/server/socket/notificationSocket';

export async function POST(request: Request) {
    const currentUser = await GetCurrentUserFromMongoDB();
    if (!currentUser.success) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const senderEmail = normalizeEmail(currentUser.data.email);
    const senderName = currentUser.data.name;
    const senderId = currentUser.data._id?.toString() ?? '';

    if (!senderEmail) {
        return NextResponse.json({ error: 'Email отсутствует' }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as
        | { conversationId?: string; text?: string }
        | null;

    const conversationId = body?.conversationId;
    const text = body?.text?.trim();

    if (!conversationId) {
        return NextResponse.json({ error: 'conversationId обязателен' }, { status: 400 });
    }
    if (!text) {
        return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 });
    }

    let access: AccessContext;
    try {
        access = await requireConversationAccess(
            conversationId,
            senderEmail,
            senderId,
            currentUser.data.platformRole === 'super_admin'
        );
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }

    const message = await ChatMessageModel.create({
        conversationId,
        orgId: access.orgId,
        senderEmail,
        senderName,
        text,
        readBy: [senderEmail],
    });

    await ChatConversationModel.findByIdAndUpdate(conversationId, {
        $set: { updatedAt: new Date() },
    }).exec();

    const recipientEmails = await getRecipientEmailsForConversation(access);

    const uniqueRecipientEmails = Array.from(
        new Set(recipientEmails.map(normalizeEmail)).add(senderEmail)
    ).filter(Boolean);

    const recipientUserIds = await findUserIdsByEmails(uniqueRecipientEmails);

    const payload = chatMessageToDTO(message.toObject<ChatMessageLike>());
    notificationSocketGateway.emitChatMessage(conversationId, payload, recipientUserIds);

    return NextResponse.json({ ok: true, message: payload });
}
