'use server';

import { NextRequest, NextResponse } from 'next/server';
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
} from '@/server/messenger/helpers';
import { notificationSocketGateway } from '@/server/socket/notificationSocket';
import { deleteTaskFile } from '@/utils/s3';
import { adjustStorageBytes } from '@/utils/storageUsage';

const CAN_MODERATE_ROLES = new Set(['owner', 'org_admin']);

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ messageId: string }> }
) {
    const { messageId } = await params;
    const currentUser = await GetCurrentUserFromMongoDB();
    if (!currentUser.success) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userEmail = normalizeEmail(currentUser.data.email);
    const userId = currentUser.data._id?.toString() ?? '';
    if (!userEmail) {
        return NextResponse.json({ error: 'Email отсутствует' }, { status: 400 });
    }

    const normalizedMessageId = messageId?.trim() ?? '';
    if (!normalizedMessageId) {
        return NextResponse.json({ error: 'messageId обязателен' }, { status: 400 });
    }

    const message = await ChatMessageModel.findById(normalizedMessageId).lean().exec();
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
    const canModerate = currentUser.data.platformRole === 'super_admin' || CAN_MODERATE_ROLES.has(access.userRole ?? '');

    if (!isSender && !canModerate) {
        return NextResponse.json({ error: 'Недостаточно прав для удаления' }, { status: 403 });
    }

    const urlsToDelete = new Set<string>();
    if (Array.isArray(message.attachments)) {
        for (const attachment of message.attachments) {
            if (typeof attachment?.url === 'string' && attachment.url.trim()) {
                urlsToDelete.add(attachment.url);
            }
            if (typeof attachment?.posterUrl === 'string' && attachment.posterUrl.trim()) {
                urlsToDelete.add(attachment.posterUrl);
            }
        }
    }

    const fallbackBytes = Array.isArray(message.attachments)
        ? message.attachments.reduce((sum, attachment) => {
              const size = typeof attachment?.size === 'number' ? attachment.size : 0;
              return sum + Math.max(0, size);
          }, 0)
        : 0;
    const bytesToAdjust =
        typeof message.attachmentsBytes === 'number' && message.attachmentsBytes > 0
            ? message.attachmentsBytes
            : fallbackBytes;

    await ChatMessageModel.deleteOne({ _id: normalizedMessageId }).exec();
    if (urlsToDelete.size > 0) {
        await Promise.allSettled(Array.from(urlsToDelete).map((url) => deleteTaskFile(url)));
    }
    if (bytesToAdjust > 0) {
        await adjustStorageBytes(access.orgId, -Math.abs(bytesToAdjust));
    }

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
            messageId: normalizedMessageId,
            readBy: Array.isArray(message.readBy) ? message.readBy : [],
            deletedBy: userEmail,
        },
        recipientUserIds
    );

    return NextResponse.json({
        ok: true,
        conversationId: access.conversationId,
        messageId: normalizedMessageId,
        readBy: Array.isArray(message.readBy) ? message.readBy : [],
    });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ messageId: string }> }
) {
    const { messageId } = await params;
    const currentUser = await GetCurrentUserFromMongoDB();
    if (!currentUser.success) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userEmail = normalizeEmail(currentUser.data.email);
    const userId = currentUser.data._id?.toString() ?? '';
    if (!userEmail) {
        return NextResponse.json({ error: 'Email отсутствует' }, { status: 400 });
    }

    const normalizedMessageId = messageId?.trim() ?? '';
    if (!normalizedMessageId) {
        return NextResponse.json({ error: 'messageId обязателен' }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as { text?: string } | null;
    const nextText = body?.text?.trim() ?? '';
    if (!nextText) {
        return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 });
    }

    const message = await ChatMessageModel.findById(normalizedMessageId).lean().exec();
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
    const canModerate = currentUser.data.platformRole === 'super_admin' || CAN_MODERATE_ROLES.has(access.userRole ?? '');

    if (!isSender && !canModerate) {
        return NextResponse.json({ error: 'Недостаточно прав для редактирования' }, { status: 403 });
    }

    const updatedMessage = await ChatMessageModel.findByIdAndUpdate(
        normalizedMessageId,
        { $set: { text: nextText, updatedAt: new Date() } },
        { new: true }
    ).lean().exec();

    if (!updatedMessage) {
        return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 });
    }

    await ChatConversationModel.findByIdAndUpdate(access.conversationId, {
        $set: { updatedAt: new Date() },
    }).exec();

    const recipientEmails = await getRecipientEmailsForConversation(access);
    const uniqueRecipientEmails = Array.from(
        new Set(recipientEmails.map(normalizeEmail)).add(userEmail)
    ).filter(Boolean);
    const recipientUserIds = await findUserIdsByEmails(uniqueRecipientEmails);

    const messagePayload = chatMessageToDTO(updatedMessage);
    notificationSocketGateway.emitChatMessageUpdated(access.conversationId, messagePayload, recipientUserIds);

    return NextResponse.json({
        ok: true,
        message: messagePayload,
    });
}
