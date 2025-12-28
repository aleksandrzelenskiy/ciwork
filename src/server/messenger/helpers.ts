import 'server-only';

import dbConnect from '@/server/db/mongoose';
import ChatConversationModel, { type ChatConversation } from '@/server/models/ChatConversationModel';
import MembershipModel, { type OrgRole } from '@/server/models/MembershipModel';
import UserModel from '@/server/models/UserModel';
import type { ChatMessage } from '@/server/models/ChatMessageModel';
import type { MessengerMessageDTO } from '@/app/types/messenger';
import { Types } from 'mongoose';

export type AccessContext = {
    conversationId: string;
    conversation: ChatConversation;
    orgId: string;
    userEmail: string;
    userId: string;
    userRole: OrgRole | 'super_admin' | null;
};

export const normalizeEmail = (value?: string | null) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';

export type ChatMessageLike = Partial<
    Pick<ChatMessage, 'conversationId' | 'orgId' | 'senderEmail' | 'senderName' | 'text' | 'readBy'>
> & {
    _id?: unknown;
    createdAt?: unknown;
};

export const chatMessageToDTO = (message: ChatMessageLike): MessengerMessageDTO => ({
    id: (typeof message._id === 'string' ? message._id : (message._id as Types.ObjectId | undefined)?.toString?.()) ?? '',
    conversationId: message.conversationId?.toString?.() ?? '',
    orgId: message.orgId?.toString?.() ?? '',
    senderEmail: message.senderEmail ?? '',
    senderName: message.senderName,
    text: message.text ?? '',
    readBy: Array.isArray(message.readBy) ? message.readBy : [],
    createdAt: message.createdAt ? new Date(message.createdAt as string | number | Date).toISOString() : new Date().toISOString(),
});

export async function requireConversationAccess(
    conversationId: string,
    userEmail: string,
    userId: string,
    isSuperAdmin = false
): Promise<AccessContext> {
    await dbConnect();

    const conversation = await ChatConversationModel.findById(conversationId).exec();
    if (!conversation) {
        throw new Error('Чат не найден');
    }

    const orgId = conversation.orgId?.toString();
    if (!orgId) {
        throw new Error('Организация не найдена');
    }

    const membership = isSuperAdmin
        ? null
        : await MembershipModel.findOne({
              orgId,
              userEmail,
              status: 'active',
          })
              .lean()
              .exec();

    if (!membership && !isSuperAdmin && conversation.type !== 'direct') {
        throw new Error('Нет доступа к организации');
    }

    if (conversation.type === 'direct') {
        const participants = conversation.participants?.map((p) => normalizeEmail(p)) ?? [];
        if (!participants.includes(userEmail)) {
            throw new Error('Нет доступа к чату');
        }
    }

    return {
        conversationId,
        conversation,
        orgId,
        userEmail,
        userId,
        userRole: (membership?.role as OrgRole | undefined) ?? null,
    };
}

export async function findUserIdsByEmails(emails: string[]): Promise<string[]> {
    if (!emails.length) return [];
    const docs = await UserModel.find({ email: { $in: emails } }, { _id: 1 })
        .lean()
        .exec();
    return docs.map((doc) => doc._id?.toString?.() ?? '').filter(Boolean);
}

export async function getRecipientEmailsForConversation(access: AccessContext): Promise<string[]> {
    if (access.conversation.type === 'direct') {
        return (access.conversation.participants ?? []).map(normalizeEmail);
    }

    const members = await MembershipModel.find({
        orgId: access.orgId,
        status: 'active',
    })
        .lean()
        .exec();

    return members.map((m) => normalizeEmail(m.userEmail));
}
