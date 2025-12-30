'use server';

import { NextResponse } from 'next/server';
import ChatMessageModel from '@/server/models/ChatMessageModel';
import ChatConversationModel from '@/server/models/ChatConversationModel';
import OrganizationModel from '@/server/models/OrganizationModel';
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
import { optimizeImageFile, optimizeVideoFile } from '@/server/messenger/media';
import { assertWritableStorage, recordStorageBytes } from '@/utils/storageUsage';
import { buildMessengerMediaKey, uploadBuffer } from '@/utils/s3';

const MAX_MEDIA_COUNT = 6;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 60 * 1024 * 1024;

const parseMessagePayload = async (request: Request) => {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const conversationId = String(formData.get('conversationId') ?? '').trim();
        const text = String(formData.get('text') ?? '').trim();
        const files = formData
            .getAll('files')
            .filter((item): item is File => item instanceof File);
        return { conversationId, text, files };
    }

    const body = (await request.json().catch(() => null)) as
        | { conversationId?: string; text?: string }
        | null;
    return {
        conversationId: body?.conversationId?.trim() ?? '',
        text: body?.text?.trim() ?? '',
        files: [] as File[],
    };
};

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

    const payload = await parseMessagePayload(request);
    const conversationId = payload.conversationId;
    const text = payload.text;
    const files = payload.files ?? [];

    if (!conversationId) {
        return NextResponse.json({ error: 'conversationId обязателен' }, { status: 400 });
    }
    if (!text && files.length === 0) {
        return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 });
    }

    const invalidFiles = files.filter(
        (file) => !file.type.startsWith('image/') && !file.type.startsWith('video/')
    );
    if (invalidFiles.length > 0) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }
    if (files.length > MAX_MEDIA_COUNT) {
        return NextResponse.json({ error: 'Слишком много файлов' }, { status: 400 });
    }
    const totalBytes = files.reduce((sum, file) => sum + (file.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
        return NextResponse.json({ error: 'Суммарный размер файлов превышает лимит' }, { status: 400 });
    }
    const tooLarge = files.find((file) => {
        const limit = file.type.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        return file.size > limit;
    });
    if (tooLarge) {
        return NextResponse.json({ error: 'Файл превышает допустимый размер' }, { status: 400 });
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

    const attachments: Array<{
        url: string;
        kind: 'image' | 'video';
        contentType?: string;
        size?: number;
        width?: number;
        height?: number;
        posterUrl?: string;
        filename?: string;
    }> = [];
    let attachmentsBytes = 0;

    if (files.length > 0) {
        const storageCheck = await assertWritableStorage(access.orgId);
        if (!storageCheck.ok) {
            return NextResponse.json(
                {
                    error: storageCheck.error,
                    readOnly: true,
                    storage: storageCheck.access,
                },
                { status: 402 }
            );
        }
        const org = await OrganizationModel.findById(access.orgId).select('orgSlug').lean().exec();
        const orgSlug = org?.orgSlug ?? undefined;

        for (const file of files) {
            const optimized = file.type.startsWith('image/')
                ? await optimizeImageFile(file)
                : await optimizeVideoFile(file);
            const key = buildMessengerMediaKey({
                orgSlug,
                orgId: access.orgId.toString(),
                conversationId,
                filename: optimized.filename,
            });
            const url = await uploadBuffer(optimized.buffer, key, optimized.contentType);
            let posterUrl: string | undefined;
            if (optimized.kind === 'video' && optimized.poster) {
                const posterKey = buildMessengerMediaKey({
                    orgSlug,
                    orgId: access.orgId.toString(),
                    conversationId,
                    filename: optimized.poster.filename,
                });
                posterUrl = await uploadBuffer(
                    optimized.poster.buffer,
                    posterKey,
                    optimized.poster.contentType
                );
                attachmentsBytes += optimized.poster.size;
            }
            attachments.push({
                url,
                kind: optimized.kind,
                contentType: optimized.contentType,
                size: optimized.size,
                width: optimized.width,
                height: optimized.height,
                posterUrl,
                filename: optimized.filename,
            });
            attachmentsBytes += optimized.size;
        }

        if (attachmentsBytes > 0) {
            await recordStorageBytes(access.orgId, attachmentsBytes);
        }
    }

    const message = await ChatMessageModel.create({
        conversationId,
        orgId: access.orgId,
        senderEmail,
        senderName,
        text,
        readBy: [senderEmail],
        attachments,
        attachmentsBytes,
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
