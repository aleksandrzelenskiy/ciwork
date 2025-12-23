// src/app/utils/notificationService.ts

import { Types } from 'mongoose';
import NotificationModel, { type NotificationDoc } from '@/app/models/NotificationModel';
import type {
    NotificationDTO,
    NotificationKind,
    NotificationStatus,
} from '@/app/types/notifications';
import { notificationSocketGateway } from '@/server/socket/notificationSocket';
import UserModel from '@/app/models/UserModel';
import { sendEmail } from '@/utils/mailer';

const FRONTEND_URL =
    process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://ws.ciwork.pro';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const toAbsoluteLink = (link?: string): string | undefined => {
    if (!link) return undefined;
    const trimmed = link.trim();
    if (!trimmed) return undefined;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    const base = normalizeBaseUrl(FRONTEND_URL);
    if (trimmed.startsWith('/')) return `${base}${trimmed}`;
    return `${base}/${trimmed}`;
};

type ObjectIdLike = Types.ObjectId | string;

const toObjectId = (value: ObjectIdLike): Types.ObjectId => {
    if (value instanceof Types.ObjectId) {
        return value;
    }
    return new Types.ObjectId(value);
};

export interface CreateNotificationParams {
    recipientUserId: ObjectIdLike;
    type: NotificationKind;
    title: string;
    message: string;
    link?: string;
    status?: NotificationStatus;
    orgId?: ObjectIdLike;
    orgSlug?: string;
    orgName?: string;
    senderName?: string;
    senderEmail?: string;
    metadata?: Record<string, unknown>;
}

type NotificationLeanDoc = Pick<
    NotificationDoc,
    | '_id'
    | 'type'
    | 'title'
    | 'message'
    | 'link'
    | 'createdAt'
    | 'status'
    | 'orgId'
    | 'orgSlug'
    | 'orgName'
    | 'senderName'
    | 'senderEmail'
    | 'metadata'
>;

export const mapNotificationToDTO = (doc: NotificationLeanDoc): NotificationDTO => ({
    id: doc._id.toString(),
    type: doc.type,
    title: doc.title,
    message: doc.message,
    link: doc.link,
    createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
    status: doc.status,
    orgId: doc.orgId ? doc.orgId.toString() : undefined,
    orgSlug: doc.orgSlug,
    orgName: doc.orgName,
    senderName: doc.senderName,
    senderEmail: doc.senderEmail,
    metadata: doc.metadata ?? undefined,
});

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const buildEmailHtml = (message: string, link?: string, orgName?: string) => {
    const parts = [`<p style="margin:0 0 12px 0;">${escapeHtml(message)}</p>`];

    if (orgName) {
        parts.push(
            `<p style="margin:0 0 12px 0;"><strong>Организация:</strong> ${escapeHtml(orgName)}</p>`
        );
    }

    const absoluteLink = toAbsoluteLink(link);
    if (absoluteLink) {
        parts.push(
            `<p style="margin:0;"><a href="${escapeHtml(absoluteLink)}" target="_blank" rel="noopener noreferrer">Открыть в CI Work</a></p>`
        );
    }

    return parts.join('');
};

async function sendNotificationEmail(params: {
    recipientUserId: Types.ObjectId;
    title: string;
    message: string;
    link?: string;
    orgName?: string;
}) {
    try {
        const recipient = await UserModel.findById(params.recipientUserId)
            .select('email name')
            .lean();
        const recipientEmail = recipient?.email;

        if (!recipientEmail) {
            console.warn(
                'notifications email: recipient email not found',
                params.recipientUserId.toString()
            );
            return;
        }

        const textLines = [params.message];

        if (params.orgName) {
            textLines.push(`Организация: ${params.orgName}`);
        }

        const absoluteLink = toAbsoluteLink(params.link);
        if (absoluteLink) {
            textLines.push(`Открыть: ${absoluteLink}`);
        }

        await sendEmail({
            to: recipientEmail,
            subject: params.title,
            text: textLines.join('\n\n'),
            html: buildEmailHtml(params.message, params.link, params.orgName),
        });
    } catch (error) {
        console.error('notifications email: failed to deliver', error);
    }
}

export async function createNotification({
    recipientUserId,
    type,
    title,
    message,
    link,
    status,
    orgId,
    orgSlug,
    orgName,
    senderName,
    senderEmail,
    metadata,
}: CreateNotificationParams) {
    const created = await NotificationModel.create({
        recipientUserId: toObjectId(recipientUserId),
        type,
        title,
        message,
        link,
        status: status ?? 'unread',
        orgId: orgId ? toObjectId(orgId) : undefined,
        orgSlug,
        orgName,
        senderName,
        senderEmail,
        metadata,
    });

    await sendNotificationEmail({
        recipientUserId: created.recipientUserId,
        title,
        message,
        link,
        orgName,
    });

    const recipientId = created.recipientUserId.toString();
    try {
        const dto = mapNotificationToDTO(created.toObject() as NotificationLeanDoc);
        const unreadCount = await countUnreadNotifications(created.recipientUserId);
        notificationSocketGateway.emitNewNotification(recipientId, {
            notification: dto,
            unreadCount,
        });
    } catch (error) {
        console.error('notifications realtime:createNotification', error);
    }

    return created;
}

export async function fetchNotificationsForUser(
    recipientUserId: ObjectIdLike,
    limit = 20,
    skip = 0
): Promise<NotificationDTO[]> {
    const docs = (await NotificationModel.find({
        recipientUserId: toObjectId(recipientUserId),
    })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()) as NotificationLeanDoc[];

    return docs.map((doc) => mapNotificationToDTO(doc));
}

export async function countUnreadNotifications(recipientUserId: ObjectIdLike) {
    return NotificationModel.countDocuments({
        recipientUserId: toObjectId(recipientUserId),
        status: 'unread',
    });
}

export async function countNotificationsForUser(recipientUserId: ObjectIdLike) {
    return NotificationModel.countDocuments({
        recipientUserId: toObjectId(recipientUserId),
    });
}

export async function markNotificationsAsRead(
    recipientUserId: ObjectIdLike,
    notificationIds?: string[]
) {
    const targetUserId = toObjectId(recipientUserId);
    const filter: Record<string, unknown> = {
        recipientUserId: targetUserId,
        status: 'unread',
    };

    if (notificationIds && notificationIds.length > 0) {
        filter._id = {
            $in: notificationIds.map((id) => new Types.ObjectId(id)),
        };
    }

    const res = await NotificationModel.updateMany(filter, {
        $set: { status: 'read', readAt: new Date() },
    });

    if (res.modifiedCount > 0) {
        try {
            const unreadCount = await countUnreadNotifications(targetUserId);
            notificationSocketGateway.emitNotificationsMarkedAsRead(targetUserId.toString(), {
                notificationIds,
                unreadCount,
            });
        } catch (error) {
            console.error('notifications realtime:markAsRead', error);
        }
    }

    return res.modifiedCount;
}

export async function deleteNotifications(
    recipientUserId: ObjectIdLike,
    notificationIds?: string[]
) {
    const targetUserId = toObjectId(recipientUserId);
    const filter: Record<string, unknown> = {
        recipientUserId: targetUserId,
    };

    if (notificationIds && notificationIds.length > 0) {
        filter._id = {
            $in: notificationIds.map((id) => new Types.ObjectId(id)),
        };
    }

    const res = await NotificationModel.deleteMany(filter);

    if (res.deletedCount > 0) {
        try {
            const unreadCount = await countUnreadNotifications(targetUserId);
            notificationSocketGateway.emitNotificationsDeleted(targetUserId.toString(), {
                notificationIds,
                unreadCount,
            });
        } catch (error) {
            console.error('notifications realtime:delete', error);
        }
    }

    return res.deletedCount;
}
