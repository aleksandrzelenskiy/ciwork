'use server';

import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import ChatConversationModel from '@/server/models/ChatConversationModel';
import ChatMessageModel from '@/server/models/ChatMessageModel';
import MembershipModel from '@/server/models/MembershipModel';
import ProjectModel from '@/server/models/ProjectModel';
import UserModel from '@/server/models/UserModel';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import type { MessengerConversationDTO, ConversationType } from '@/app/types/messenger';
import type { OrgRole } from '@/server/models/MembershipModel';
import { notificationSocketGateway } from '@/server/socket/notificationSocket';
import { formatNameFromEmail, normalizeEmail } from '@/utils/email';

type UserContext = {
    userId: string;
    email: string;
    activeOrgId: string;
    activeRole: OrgRole | 'super_admin' | null;
};

const MANAGE_PROJECT_ROLES: OrgRole[] = ['owner', 'org_admin', 'manager'];

async function resolveUserContext(): Promise<
    | { ok: true; context: UserContext }
    | { ok: false; response: NextResponse }
> {
    const currentUser = await GetCurrentUserFromMongoDB();
    if (!currentUser.success) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: currentUser.message || 'Unauthorized' },
                { status: 401 }
            ),
        };
    }
    const email = normalizeEmail(currentUser.data.email);
    if (!email) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Email отсутствует' }, { status: 400 }),
        };
    }

    await dbConnect();

    const memberships = await MembershipModel.find({
        userEmail: email,
        status: 'active',
    })
        .lean()
        .exec();

    const activeOrgId =
        currentUser.data.activeOrgId?.toString() ?? memberships[0]?.orgId?.toString() ?? '';

    if (!activeOrgId) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'Нет активной организации для мессенджера' },
                { status: 400 }
            ),
        };
    }

    const activeMembership = memberships.find(
        (m) => m.orgId?.toString() === activeOrgId
    );

    const activeRole =
        currentUser.data.platformRole === 'super_admin'
            ? 'super_admin'
            : activeMembership?.role ?? null;

    return {
        ok: true,
        context: {
            userId: currentUser.data._id?.toString() ?? '',
            email,
            activeOrgId,
            activeRole,
        },
    };
}

const toDTO = (
    doc: {
        _id: unknown;
        orgId: unknown;
        type: ConversationType;
        title: string;
        projectKey?: string | null;
        participants?: string[];
        updatedAt?: Date;
    },
    unreadCount: number,
    extras?: {
        counterpartEmail?: string;
        counterpartName?: string;
        counterpartAvatar?: string;
        counterpartIsOnline?: boolean;
        counterpartLastActive?: Date | null;
    }
): MessengerConversationDTO => ({
    id: doc._id?.toString?.() ?? '',
    orgId: doc.orgId?.toString?.() ?? '',
    type: doc.type,
    title: doc.title,
    projectKey: doc.projectKey ?? null,
    participants: Array.isArray(doc.participants)
        ? doc.participants.map((p) => normalizeEmail(p))
        : [],
    unreadCount,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
    counterpartEmail: extras?.counterpartEmail,
    counterpartName: extras?.counterpartName,
    counterpartAvatar: extras?.counterpartAvatar,
    counterpartIsOnline: extras?.counterpartIsOnline,
    counterpartLastActive: extras?.counterpartLastActive
        ? extras.counterpartLastActive.toISOString()
        : undefined,
});

async function ensureOrgConversation(orgId: string, creatorEmail: string) {
    const existing = await ChatConversationModel.findOne({
        orgId,
        type: 'org',
    }).exec();
    if (existing) return existing;

    return ChatConversationModel.create({
        orgId,
        type: 'org',
        title: 'Общий чат организации',
        createdByEmail: creatorEmail,
        participants: [],
    });
}

async function getUnreadCount(conversationId: string, userEmail: string) {
    return ChatMessageModel.countDocuments({
        conversationId,
        readBy: { $ne: userEmail },
    }).exec();
}

export async function GET() {
    const resolved = await resolveUserContext();
    if (!resolved.ok) return resolved.response;
    const { email, activeOrgId } = resolved.context;

    await ensureOrgConversation(activeOrgId, email);

    const conversations = await ChatConversationModel.find({
        orgId: activeOrgId,
        $or: [{ type: { $ne: 'direct' } }, { participants: email }],
    })
        .sort({ updatedAt: -1 })
        .lean()
        .exec();

    const directCounterparts = conversations
        .filter((conversation) => conversation.type === 'direct')
        .map((conversation) =>
            (conversation.participants ?? []).find((participant) => normalizeEmail(participant) !== email)
        )
        .filter((participantEmail): participantEmail is string => Boolean(participantEmail))
        .map((participantEmail) => normalizeEmail(participantEmail));

    const directUsers = directCounterparts.length
        ? await UserModel.find(
              { email: { $in: directCounterparts } },
              { email: 1, name: 1, profilePic: 1, lastActive: 1 }
          )
              .lean()
              .exec()
        : [];

    const directUserMap = new Map(
        directUsers.map((user) => [normalizeEmail(user.email), user])
    );

    const items = await Promise.all(
        conversations.map(async (conversation) => {
            const unreadCount = await getUnreadCount(conversation._id.toString(), email);
            const counterpartRaw =
                conversation.type === 'direct'
                    ? (conversation.participants ?? []).find(
                          (participant) => normalizeEmail(participant) !== email
                      )
                    : undefined;
            const counterpartEmail = counterpartRaw ? normalizeEmail(counterpartRaw) : undefined;
        const counterpartUser = counterpartEmail ? directUserMap.get(counterpartEmail) : null;
        const presence = counterpartUser?._id
            ? await notificationSocketGateway.getPresence(counterpartUser._id.toString())
            : null;
        return toDTO(conversation, unreadCount, {
            counterpartEmail,
            counterpartName:
                counterpartUser?.name ||
                (counterpartEmail ? formatNameFromEmail(counterpartEmail) : undefined),
            counterpartAvatar: counterpartUser?.profilePic || undefined,
            counterpartIsOnline: presence?.isOnline ?? undefined,
            counterpartLastActive: presence?.lastActive ?? (counterpartUser?.lastActive ?? null),
        });
        })
    );

    return NextResponse.json({
        ok: true,
        conversations: items,
        userEmail: email,
    });
}

export async function POST(request: Request) {
    const resolved = await resolveUserContext();
    if (!resolved.ok) return resolved.response;
    const { email, activeOrgId, activeRole } = resolved.context;

    const body = (await request.json().catch(() => null)) as
        | {
              type?: ConversationType;
              projectKey?: string;
              targetEmail?: string;
              title?: string;
          }
        | null;

    const type = body?.type;
    if (!type) {
        return NextResponse.json({ error: 'type обязателен' }, { status: 400 });
    }

    if (type === 'org') {
        const conversation = await ensureOrgConversation(activeOrgId, email);
        const unreadCount = await getUnreadCount(String(conversation._id), email);
        return NextResponse.json({
            ok: true,
            conversation: toDTO(conversation.toObject(), unreadCount),
        });
    }

    if (type === 'project') {
        const projectKey = body?.projectKey?.trim().toUpperCase();
        if (!projectKey) {
            return NextResponse.json({ error: 'projectKey обязателен' }, { status: 400 });
        }
        if (activeRole !== 'super_admin' && (!activeRole || !MANAGE_PROJECT_ROLES.includes(activeRole))) {
            return NextResponse.json({ error: 'Недостаточно прав для создания проектного чата' }, { status: 403 });
        }

        const project = await ProjectModel.findOne({
            orgId: activeOrgId,
            key: projectKey,
        })
            .lean()
            .exec();

        if (!project) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        const existing = await ChatConversationModel.findOne({
            orgId: activeOrgId,
            type: 'project',
            projectKey,
        }).exec();

        const conversation =
            existing ||
            (await ChatConversationModel.create({
                orgId: activeOrgId,
                type: 'project',
                projectKey,
                title: `Проект ${projectKey}`,
                createdByEmail: email,
                participants: [],
            }));

        const unreadCount = await getUnreadCount(String(conversation._id), email);
        return NextResponse.json({
            ok: true,
            conversation: toDTO(conversation.toObject(), unreadCount),
        });
    }

    if (type === 'direct') {
        const targetEmail = normalizeEmail(body?.targetEmail);
        if (!targetEmail) {
            return NextResponse.json({ error: 'targetEmail обязателен' }, { status: 400 });
        }
        if (targetEmail === email) {
            return NextResponse.json({ error: 'Нельзя создать чат с самим собой' }, { status: 400 });
        }

        const targetMembership = await MembershipModel.findOne({
            orgId: activeOrgId,
            userEmail: targetEmail,
            status: 'active',
        })
            .lean()
            .exec();

        if (!targetMembership) {
            return NextResponse.json({ error: 'Пользователь не состоит в организации' }, { status: 404 });
        }

        const participants = [email, targetEmail].sort();

        const existing = await ChatConversationModel.findOne({
            orgId: activeOrgId,
            type: 'direct',
            participants: { $all: participants },
        }).exec();

        const conversation =
            existing ||
            (await ChatConversationModel.create({
                orgId: activeOrgId,
                type: 'direct',
                title: body?.title || 'Личный чат',
                participants,
                createdByEmail: email,
            }));

        const unreadCount = await getUnreadCount(String(conversation._id), email);
        const targetUser = await UserModel.findOne(
            { email: targetEmail },
            { email: 1, name: 1, profilePic: 1 }
        )
            .lean()
            .exec();

        return NextResponse.json({
            ok: true,
            conversation: toDTO(conversation.toObject(), unreadCount, {
                counterpartEmail: targetEmail,
                counterpartName: targetUser?.name || formatNameFromEmail(targetEmail),
                counterpartAvatar: targetUser?.profilePic || undefined,
            }),
        });
    }

    return NextResponse.json({ error: 'Неподдерживаемый тип чата' }, { status: 400 });
}
