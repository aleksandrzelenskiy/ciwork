'use server';

import { NextResponse } from 'next/server';
import ChatMessageModel from '@/server/models/ChatMessageModel';
import ChatConversationModel from '@/server/models/ChatConversationModel';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import {
    findUserIdsByEmails,
    getRecipientEmailsForConversation,
    normalizeEmail,
    requireConversationAccess,
    type AccessContext,
} from '@/server/messenger/helpers';
import { notificationSocketGateway } from '@/server/socket/notificationSocket';

const CAN_DELETE_ROLES = new Set(['owner', 'org_admin']);

export async function DELETE(
    _request: Request,
    { params }: { params: { messageId?: string } }
) {
    const currentUser = await GetCurrentUserFromMongoDB();
    if (!currentUser.success) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userEmail = normalizeEmail(currentUser.data.email);
    const userId = currentUser.data._id?.toString() ?? '';
    if (!userEmail) {
        return NextResponse.json({ error: 'Email отсутствует' }, { status: 400 });
    }

    const messageId = params?.messageId?.trim() ?? '';
    if (!messageId) {
        return NextResponse.json({ error: 'messageId обязателен' }, { status: 400 });
    }

    const message = await ChatMessageModel.findById(messageId).lean().exec();
    if (!message) {
        return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 });
    }

    let access: AccessContext;
    try {
        access = await requireConversationAccess(
            message.conversationId?.toString?.() ?? '',
            userEmail,
            userId,
            currentUser.data.platformRole === 'super_admin'
        );
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }

    const isSender = normalizeEmail(message.senderEmail) === userEmail;
    const canModerate = currentUser.data.platformRole === 'super_admin' || CAN_DELETE_ROLES.has(access.userRole ?? '');

    if (!isSender && !canModerate) {
        return NextResponse.json({ error: 'Недостаточно прав для удаления' }, { status: 403 });
    }

    await ChatMessageModel.deleteOne({ _id: messageId }).exec();

    await ChatConversationModel.findByIdAndUpdate(access.conversationId, {
        $set: { updatedAt: new Date() },
    }).exec();

    const recipientEmails = await getRecipientEmailsForConversation(access);
    const uniqueRecipientEmails = Array.from(
        new Set(recipientEmails.map(normalizeEmail)).add(userEmail)
    ).filter(Boolean);
    const recipientUserIds = await findUserIdsByEmails(uniqueRecipientEmails);

    notificationSocketGateway.emitChatMessageDeleted(
        access.conversationId,
        {
            conversationId: access.conversationId,
            messageId,
            readBy: Array.isArray(message.readBy) ? message.readBy : [],
            deletedBy: userEmail,
        },
        recipientUserIds
    );

    return NextResponse.json({
        ok: true,
        conversationId: access.conversationId,
        messageId,
        readBy: Array.isArray(message.readBy) ? message.readBy : [],
    });
}
