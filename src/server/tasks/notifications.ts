// src/server/tasks/notifications.ts

import 'server-only';

import { Types } from 'mongoose';
import UserModel, { type IUser } from '@/server/models/UserModel';
import type { ApplicationStatus } from '@/server/models/ApplicationModel';
import { createNotification } from '@/server/notifications/service';
import { getStatusLabel, normalizeStatusTitle } from '@/utils/statusLabels';

type ObjectIdLike = Types.ObjectId | string | null | undefined;

export interface TaskAssignmentNotificationInput {
    executorClerkId?: string | null;
    taskId?: string;
    taskName: string;
    bsNumber?: string;
    orgId?: Types.ObjectId | string | null;
    orgSlug?: string;
    orgName?: string;
    projectRef?: string;
    projectKey?: string;
    projectName?: string;
    triggeredByName?: string;
    triggeredByEmail?: string;
    link?: string;
    title?: string;
    message?: string;
}

interface TaskNotificationContext extends TaskAssignmentNotificationInput {
    link?: string;
}

const normalizeObjectId = (value: ObjectIdLike): string | undefined => {
    if (!value) return undefined;
    if (value instanceof Types.ObjectId) return value.toString();
    const trimmed = String(value).trim();
    return trimmed || undefined;
};

const buildTaskLink = (input: TaskNotificationContext): string | undefined => {
    if (input.link) return input.link;
    if (input.orgSlug && input.projectRef && input.taskId) {
        return `/org/${encodeURIComponent(input.orgSlug)}/projects/${encodeURIComponent(
            input.projectRef
        )}/tasks/${encodeURIComponent(input.taskId.toLowerCase())}`;
    }
    if (input.taskId) {
        return `/tasks/${encodeURIComponent(input.taskId.toLowerCase())}`;
    }
    return undefined;
};

const buildTaskMetadata = (
    input: TaskNotificationContext,
    extra?: Record<string, unknown>
) => {
    const metadataEntries = Object.entries({
        taskId: input.taskId,
        bsNumber: input.bsNumber,
        projectRef: input.projectRef,
        projectKey: input.projectKey,
        projectName: input.projectName,
        ...extra,
    }).filter(([, value]) => typeof value !== 'undefined' && value !== null);

    return metadataEntries.length > 0 ? Object.fromEntries(metadataEntries) : undefined;
};

export async function notifyTaskAssignment(input: TaskAssignmentNotificationInput) {
    if (!input.executorClerkId) {
        return;
    }

    const executor = await UserModel.findOne({ clerkUserId: input.executorClerkId })
        .select('_id name email')
        .lean();

    if (!executor?._id) {
        console.warn('notifyTaskAssignment: executor not found', input.executorClerkId);
        return;
    }

    const link = buildTaskLink(input);
    const bsInfo = input.bsNumber ? ` (БС ${input.bsNumber})` : '';
    const title = input.title ?? 'Вам назначена задача';
    const message =
        input.message ??
        `Вы назначены исполнителем по задаче «${input.taskName}»${bsInfo}.`;

    const metadata = buildTaskMetadata(input);

    await createNotification({
        recipientUserId: executor._id,
        type: 'task_assigned',
        title,
        message,
        link,
        orgId: input.orgId ?? undefined,
        orgSlug: input.orgSlug ?? undefined,
        orgName: input.orgName ?? undefined,
        senderName: input.triggeredByName,
        senderEmail: input.triggeredByEmail,
        metadata,
    });
}

export async function notifyTaskUnassignment(input: TaskNotificationContext) {
    if (!input.executorClerkId) return;

    const executor = await UserModel.findOne({ clerkUserId: input.executorClerkId })
        .select('_id name email')
        .lean();

    if (!executor?._id) {
        console.warn('notifyTaskUnassignment: executor not found', input.executorClerkId);
        return;
    }

    const bsInfo = input.bsNumber ? ` (БС ${input.bsNumber})` : '';
    const link = buildTaskLink(input);
    const metadata = buildTaskMetadata(input);

    await createNotification({
        recipientUserId: executor._id,
        type: 'task_unassigned',
        title: 'Вы больше не исполнитель задачи',
        message: `Вас сняли с задачи «${input.taskName}»${bsInfo}.`,
        link,
        orgId: input.orgId ?? undefined,
        orgSlug: input.orgSlug ?? undefined,
        orgName: input.orgName ?? undefined,
        senderName: input.triggeredByName,
        senderEmail: input.triggeredByEmail,
        metadata,
    });
}

export async function notifyTaskStatusChange(input: {
    taskId?: string;
    taskName: string;
    bsNumber?: string;
    previousStatus?: string;
    newStatus: string;
    authorClerkId?: string | null;
    executorClerkId?: string | null;
    triggeredByClerkId?: string | null;
    triggeredByName?: string;
    triggeredByEmail?: string;
    orgId?: Types.ObjectId | string | null;
    orgSlug?: string;
    orgName?: string;
    projectRef?: string;
    projectKey?: string;
    projectName?: string;
    link?: string;
}) {
    const formatStatusLabel = (status?: string) => {
        if (!status) return 'не указан';
        return getStatusLabel(normalizeStatusTitle(status)) || status;
    };

    const targets = Array.from(
        new Set(
            [input.authorClerkId, input.executorClerkId]
                .map((v) => (typeof v === 'string' ? v.trim() : ''))
                .filter((v) => v && v !== input.triggeredByClerkId)
        )
    );

    if (targets.length === 0) return;

    const users = await UserModel.find({ clerkUserId: { $in: targets } })
        .select('_id name email clerkUserId')
        .lean();

    if (!users || users.length === 0) return;

    const bsInfo = input.bsNumber ? ` (БС ${input.bsNumber})` : '';
    const link = buildTaskLink(input);
    const metadata = buildTaskMetadata(input, {
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
    });

    await Promise.all(
        users.map((user) =>
            createNotification({
                recipientUserId: user._id,
                type: 'task_status_change',
                title: 'Статус задачи обновлён',
                message: `Статус задачи «${input.taskName}»${bsInfo} изменён с ${formatStatusLabel(
                    input.previousStatus
                )} на ${formatStatusLabel(input.newStatus)}.`,
                link,
                orgId: input.orgId ?? undefined,
                orgSlug: input.orgSlug ?? undefined,
                orgName: input.orgName ?? undefined,
                senderName: input.triggeredByName,
                senderEmail: input.triggeredByEmail,
                metadata,
            })
        )
    );
}

export async function notifyTaskPublished(input: {
    taskId?: string;
    taskName: string;
    bsNumber?: string;
    budget?: number | null;
    currency?: string;
    orgId?: Types.ObjectId | string | null;
    orgSlug?: string;
    orgName?: string;
    projectKey?: string;
    projectName?: string;
}) {
    const contractors = await UserModel.find({
        profileType: 'contractor',
        profileSetupCompleted: true,
    })
        .select('_id name email')
        .lean();

    if (!contractors || contractors.length === 0) return;

    const budgetInfo =
        typeof input.budget === 'number' && input.budget > 0
            ? ` Бюджет: ${Math.round(input.budget)} ${input.currency ?? 'RUB'}.`
            : '';
    const bsInfo = input.bsNumber ? ` (БС ${input.bsNumber})` : '';
    const metadata = buildTaskMetadata(input, {
        budget: input.budget,
        currency: input.currency,
        public: true,
    });

    await Promise.all(
        contractors.map((contractor) =>
            createNotification({
                recipientUserId: contractor._id,
                type: 'task_published',
                title: 'Новая задача на маркетплейсе',
                message: `Опубликована задача «${input.taskName}»${bsInfo}.${budgetInfo}`,
                link: '/market',
                orgId: input.orgId ?? undefined,
                orgSlug: input.orgSlug ?? undefined,
                orgName: input.orgName ?? undefined,
                senderName: input.orgName,
                metadata,
            })
        )
    );
}

export async function notifyApplicationSubmitted(input: {
    taskId?: string;
    taskName: string;
    bsNumber?: string;
    applicationId: Types.ObjectId | string;
    contractor: Pick<IUser, '_id' | 'name' | 'email'>;
    proposedBudget?: number;
    orgId?: Types.ObjectId | string | null;
    orgSlug?: string;
    orgName?: string;
    managerClerkIds?: string[];
    projectRef?: string;
    projectKey?: string;
    projectName?: string;
    triggeredByName?: string;
    triggeredByEmail?: string;
}) {
    const targets = Array.from(
        new Set(
            (input.managerClerkIds ?? [])
                .map((v) => v?.trim?.())
                .filter((v): v is string => Boolean(v))
        )
    );

    if (targets.length === 0) return;

    const managers = await UserModel.find({ clerkUserId: { $in: targets } })
        .select('_id name email')
        .lean();

    if (!managers || managers.length === 0) return;

    const link = buildTaskLink(input);
    const budgetInfo =
        typeof input.proposedBudget === 'number' && input.proposedBudget > 0
            ? ` Бюджет: ${Math.round(input.proposedBudget)}.`
            : '';
    const bsInfo = input.bsNumber ? ` (БС ${input.bsNumber})` : '';

    const metadata = buildTaskMetadata(input, {
        applicationId: normalizeObjectId(input.applicationId),
        contractorId: normalizeObjectId(input.contractor._id),
        proposedBudget: input.proposedBudget,
    });

    await Promise.all(
        managers.map((manager) =>
            createNotification({
                recipientUserId: manager._id,
                type: 'task_application_submitted',
                title: 'Новый отклик на задачу',
                message: `${input.contractor.name || 'Подрядчик'} откликнулся на задачу «${input.taskName}»${bsInfo}.${budgetInfo}`,
                link,
                orgId: input.orgId ?? undefined,
                orgSlug: input.orgSlug ?? undefined,
                orgName: input.orgName ?? undefined,
                senderName: input.triggeredByName ?? input.contractor.name,
                senderEmail: input.triggeredByEmail ?? input.contractor.email,
                metadata,
            })
        )
    );
}

export async function notifyApplicationStatusChanged(input: {
    contractor: Pick<IUser, '_id' | 'name' | 'email'>;
    status: ApplicationStatus;
    previousStatus?: ApplicationStatus;
    taskId?: string;
    taskName: string;
    bsNumber?: string;
    orgId?: Types.ObjectId | string | null;
    orgSlug?: string;
    orgName?: string;
    projectRef?: string;
    projectKey?: string;
    projectName?: string;
    triggeredByName?: string;
    triggeredByEmail?: string;
    link?: string;
}) {
    const bsInfo = input.bsNumber ? ` (БС ${input.bsNumber})` : '';
    const link = buildTaskLink(input) ?? '/market';
    const metadata = buildTaskMetadata(input, {
        applicationStatus: input.status,
        previousStatus: input.previousStatus,
    });

    let message = `Статус вашего отклика на задачу «${input.taskName}»${bsInfo} обновлён: ${input.status}.`;
    if (input.status === 'accepted') {
        message = `Ваш отклик на задачу «${input.taskName}»${bsInfo} принят. Вас назначили исполнителем.`;
    } else if (input.status === 'shortlisted') {
        message = `Ваш отклик на задачу «${input.taskName}»${bsInfo} попал в шорт-лист.`;
    } else if (input.status === 'rejected') {
        message = `Ваш отклик на задачу «${input.taskName}»${bsInfo} отклонён.`;
    } else if (input.status === 'withdrawn') {
        message = `Вы отозвали отклик на задачу «${input.taskName}»${bsInfo}.`;
    }

    await createNotification({
        recipientUserId: input.contractor._id,
        type: 'task_application_status',
        title: 'Статус отклика обновлён',
        message,
        link,
        orgId: input.orgId ?? undefined,
        orgSlug: input.orgSlug ?? undefined,
        orgName: input.orgName ?? undefined,
        senderName: input.triggeredByName,
        senderEmail: input.triggeredByEmail,
        metadata,
    });
}
