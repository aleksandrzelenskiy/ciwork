import 'server-only';

import path from 'path';
import { currentUser } from '@clerk/nextjs/server';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import UserModel from '@/server/models/UserModel';
import DocumentReviewModel from '@/server/models/DocumentReviewModel';
import { GetUserContext } from '@/server-actions/user-context';
import { MANAGER_ROLES } from '@/app/types/roles';
import { verifyInitiatorAccessToken, signInitiatorAccessToken } from '@/utils/initiatorAccessToken';
import { createNotification } from '@/server/notifications/service';
import { sendEmail } from '@/server/email/mailer';
import { getServerEnv } from '@/config/env';
import { assertWritableStorage, adjustStorageBytes, recordStorageBytes } from '@/utils/storageUsage';
import { uploadTaskFile, deleteTaskFile } from '@/utils/s3';
import { resolveStorageScope } from '@/app/api/reports/_shared';
import { getStatusLabel } from '@/utils/statusLabels';
import {
    addDocumentIssue,
    addDocumentIssueComment,
    appendDocumentVersion,
    resolveDocumentIssue,
    syncTaskStatusFromDocument,
    updateDocumentStatus,
    upsertDocumentReview,
} from '@/server-actions/documentReviewService';
import type {
    DocumentReviewStatus,
    DocumentIssue,
    DocumentIssueComment,
    DocumentReviewClient,
    IssueSnapshot,
    VersionFileMeta,
} from '@/app/types/documentReviewTypes';
import { extractFileNameFromUrl } from '@/utils/taskFiles';
import crypto from 'crypto';

const ALLOWED_UPLOAD_STATUSES = new Set<DocumentReviewStatus>(['Draft', 'Issues', 'Fixed']);

const normalizeTaskId = (value: string) => value.trim().toUpperCase();

const buildActorName = (user: Awaited<ReturnType<typeof currentUser>>) => {
    if (!user) return 'Исполнитель';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.username || user.id;
};

const resolveActorNameFromDb = async (clerkUserId?: string | null, fallback?: string) => {
    const resolvedFallback = fallback?.trim() || 'Исполнитель';
    if (!clerkUserId) return resolvedFallback;
    const dbUser = await UserModel.findOne({ clerkUserId }).select('name').lean();
    const dbName = typeof dbUser?.name === 'string' ? dbUser.name.trim() : '';
    return dbName || resolvedFallback;
};

const normalizeUserName = (value?: string | null) => (value || '').trim();

const looksLikeUserId = (value?: string | null) => {
    const raw = normalizeUserName(value);
    return raw.startsWith('user_');
};

const resolveNamesForReview = async (review?: InstanceType<typeof DocumentReviewModel> | null) => {
    if (!review) return;
    const clerkIds = new Set<string>();

    review.issues?.forEach((issue: DocumentIssue) => {
        if (issue?.createdById) clerkIds.add(issue.createdById);
        issue?.comments?.forEach((comment) => {
            if (comment?.authorId) clerkIds.add(comment.authorId);
        });
    });

    review.versions?.forEach((version) => {
        if (version?.createdById) clerkIds.add(version.createdById);
    });

    if (!clerkIds.size) return;

    const users = await UserModel.find({ clerkUserId: { $in: Array.from(clerkIds) } })
        .select('clerkUserId name')
        .lean();
    const nameMap = new Map(users.map((user) => [user.clerkUserId, user.name?.trim() || '']));

    review.issues?.forEach((issue) => {
        const createdName = nameMap.get(issue.createdById) || '';
        if (!normalizeUserName(issue.createdByName) || looksLikeUserId(issue.createdByName)) {
            if (createdName) issue.createdByName = createdName;
        }
        issue.comments?.forEach((comment) => {
            const commentName = nameMap.get(comment.authorId) || '';
            if (!normalizeUserName(comment.authorName) || looksLikeUserId(comment.authorName)) {
                if (commentName) comment.authorName = commentName;
            }
        });
    });

    review.versions?.forEach((version) => {
        const authorName = nameMap.get(version.createdById) || '';
        if (!normalizeUserName(version.createdByName) || looksLikeUserId(version.createdByName)) {
            if (authorName) version.createdByName = authorName;
        }
    });
};

const resolveProjectEmailContext = async (projectId?: unknown) => {
    if (!projectId) {
        return {
            projectLabel: '—',
            managerName: '—',
            managerEmail: '—',
        };
    }

    const project = await ProjectModel.findById(projectId)
        .select('name key managers')
        .lean();
    const projectName = typeof project?.name === 'string' ? project.name.trim() : '';
    const projectKey = typeof project?.key === 'string' ? project.key.trim() : '';
    const projectLabel =
        projectName && projectKey
            ? `${projectKey} - ${projectName}`
            : projectName || projectKey || '—';

    const managerEmail = Array.isArray(project?.managers) ? project.managers[0]?.trim() : '';
    let managerName = '';
    if (managerEmail) {
        const managerUser = await UserModel.findOne({ email: managerEmail })
            .select('name')
            .lean();
        managerName = typeof managerUser?.name === 'string' ? managerUser.name.trim() : '';
    }

    return {
        projectLabel,
        managerName: managerName || '—',
        managerEmail: managerEmail || '—',
    };
};

const resolveRole = (params: {
    userId?: string | null;
    effectiveRole?: string | null;
    executorId?: string | null;
}) => {
    const { userId, effectiveRole, executorId } = params;
    if (effectiveRole && MANAGER_ROLES.includes(effectiveRole as never)) return 'manager' as const;
    if (userId && executorId && userId === executorId) return 'executor' as const;
    return 'viewer' as const;
};

const getUserContextError = (userContext: Awaited<ReturnType<typeof GetUserContext>>) => {
    if (userContext.success) return 'Нет активной сессии пользователя';
    return userContext.message || 'Нет активной сессии пользователя';
};

const parseUploadPayload = async (request: Request) => {
    const formData = await request.formData();
    const files = Array.from(formData.values()).filter(
        (value): value is File => value instanceof File
    );
    return { files };
};

const toVersionFilesMeta = (meta: Array<{ url: string; name: string; ext: string; size: number }>): VersionFileMeta[] =>
    meta.map((item) => ({ name: item.name, ext: item.ext, size: item.size }));

const buildStoredFileMeta = (url: string, size: number) => {
    const name = extractFileNameFromUrl(url, 'Файл');
    const ext = path.extname(name).replace('.', '').toLowerCase();
    return { url, name, ext, size };
};

const toIssueSnapshots = (issues: DocumentIssue[]): IssueSnapshot[] =>
    issues.map((issue) => ({ issueId: issue.id, text: issue.text, status: issue.status }));

const buildGuestLink = (taskId: string, initiatorEmail?: string | null) => {
    const { FRONTEND_URL } = getServerEnv();
    const frontendUrl = FRONTEND_URL || 'https://ciwork.ru';
    const normalizedEmail = initiatorEmail?.trim().toLowerCase() || '';
    if (!normalizedEmail) return '';
    const token = signInitiatorAccessToken({ taskId, email: normalizedEmail });
    return `${frontendUrl}/documents/${encodeURIComponent(taskId.toLowerCase())}?token=${encodeURIComponent(token)}`;
};

export const getDocumentReviewDetails = async ({
    taskId,
    token,
}: {
    taskId: string;
    token?: string;
}) => {
    const taskIdDecoded = normalizeTaskId(decodeURIComponent(taskId));
    if (!taskIdDecoded) {
        return { ok: false, error: 'Missing task ID', status: 400 } as const;
    }

    const task = await TaskModel.findOne({ taskId: taskIdDecoded }).lean();
    if (!task) {
        return { ok: false, error: 'Task not found', status: 404 } as const;
    }

    const scope = await resolveStorageScope(task);

    let role: DocumentReviewClient['role'] = 'viewer';
    const trimmedToken = token?.trim() ?? '';
    const guestAccess = trimmedToken ? verifyInitiatorAccessToken(trimmedToken) : null;

    if (guestAccess) {
        const initiatorEmail = task.initiatorEmail?.trim().toLowerCase() || '';
        if (guestAccess.taskId !== taskIdDecoded || !initiatorEmail || initiatorEmail !== guestAccess.email) {
            return { ok: false, error: 'Недостаточно прав для просмотра', status: 403 } as const;
        }
        role = 'viewer';
    } else {
        const userContext = await GetUserContext();
        if (!userContext.success || !userContext.data) {
            return { ok: false, error: getUserContextError(userContext), status: 401 } as const;
        }
        role = resolveRole({
            userId: userContext.data.user.clerkUserId,
            effectiveRole: userContext.data.effectiveOrgRole,
            executorId: task.executorId ?? null,
        });
    }

    let review = await DocumentReviewModel.findOne({ taskId: taskIdDecoded });
    if (!review && !guestAccess) {
        const user = await currentUser();
        const actorName = await resolveActorNameFromDb(user?.id ?? null, buildActorName(user));
        const actor = { id: user?.id ?? 'system', name: actorName };
        review = await upsertDocumentReview({
            taskId: taskIdDecoded,
            taskName: task.taskName ?? '',
            orgId: String(task.orgId ?? ''),
            projectId: task.projectId ? String(task.projectId) : null,
            initiatorName: task.initiatorName ?? null,
            actor,
        });
    }

    await resolveNamesForReview(review);

    const currentReview = review ?? {
        taskId: taskIdDecoded,
        taskName: task.taskName ?? '',
        orgId: task.orgId ?? undefined,
        projectId: task.projectId ?? undefined,
        status: 'Draft',
        currentVersion: 0,
        currentFiles: [],
        previousFiles: [],
        issues: [],
        versions: [],
    };

    return {
        ok: true,
        data: {
            taskId: taskIdDecoded,
            taskName: task.taskName ?? currentReview.taskName,
            bsNumber: task.bsNumber,
            orgSlug: scope.orgSlug ?? null,
            projectKey: scope.projectKey ?? null,
            status: currentReview.status as DocumentReviewStatus,
            currentVersion: currentReview.currentVersion ?? 0,
            currentFiles: currentReview.currentFiles ?? [],
            previousFiles: currentReview.previousFiles ?? [],
            issues: currentReview.issues ?? [],
            versions: currentReview.versions ?? [],
            role,
            executorName: task.executorName ?? undefined,
            initiatorName: task.initiatorName ?? undefined,
            createdAt: currentReview.createdAt?.toISOString?.() ?? undefined,
            updatedAt: currentReview.updatedAt?.toISOString?.() ?? undefined,
        } satisfies DocumentReviewClient,
    } as const;
};

export const uploadDocumentReviewFiles = async (request: Request, taskId: string) => {
    const user = await currentUser();
    if (!user) {
        return { ok: false, error: 'User is not authenticated', status: 401 } as const;
    }

    const taskIdDecoded = normalizeTaskId(decodeURIComponent(taskId));
    if (!taskIdDecoded) {
        return { ok: false, error: 'Task ID is required', status: 400 } as const;
    }

    const task = await TaskModel.findOne({ taskId: taskIdDecoded }).lean();
    if (!task) {
        return { ok: false, error: 'Task not found', status: 404 } as const;
    }
    if (task.taskType !== 'document') {
        return { ok: false, error: 'Task is not a document task', status: 400 } as const;
    }

    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data) {
        return { ok: false, error: getUserContextError(userContext), status: 401 } as const;
    }

    const role = resolveRole({
        userId: userContext.data.user.clerkUserId,
        effectiveRole: userContext.data.effectiveOrgRole,
        executorId: task.executorId ?? null,
    });

    if (role !== 'executor' && role !== 'manager') {
        return { ok: false, error: 'Недостаточно прав для загрузки', status: 403 } as const;
    }

    const { files } = await parseUploadPayload(request);
    if (!files.length) {
        return { ok: false, error: 'No files uploaded', status: 400 } as const;
    }

    if (!task.orgId) {
        return { ok: false, error: 'Task organization is missing', status: 400 } as const;
    }

    const storageCheck = await assertWritableStorage(task.orgId);
    if (!storageCheck.ok) {
        return { ok: false, error: storageCheck.error, status: 402 } as const;
    }

    const scope = await resolveStorageScope(task);
    const uploadedUrls: string[] = [];
    const uploadedMeta: Array<{ url: string; name: string; ext: string; size: number }> = [];
    let totalBytes = 0;

    for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name || 'file';
        const url = await uploadTaskFile(
            buffer,
            taskIdDecoded,
            'document-review',
            filename,
            file.type || 'application/octet-stream',
            { orgSlug: scope.orgSlug, projectKey: scope.projectKey }
        );
        uploadedUrls.push(url);
        totalBytes += buffer.length;
        uploadedMeta.push(buildStoredFileMeta(url, buffer.length));
    }

    const actorName = await resolveActorNameFromDb(user.id, buildActorName(user));
    const actor = { id: user.id, name: actorName };

    const review = await upsertDocumentReview({
        taskId: taskIdDecoded,
        taskName: task.taskName ?? '',
        orgId: String(task.orgId ?? ''),
        projectId: task.projectId ? String(task.projectId) : null,
        initiatorName: task.initiatorName ?? null,
        actor,
    });

    if (!ALLOWED_UPLOAD_STATUSES.has(review.status as DocumentReviewStatus)) {
        return { ok: false, error: 'Нельзя загрузить файлы в текущем статусе', status: 400 } as const;
    }

    const oldStorageBytes = (review.currentBytes ?? 0) + (review.previousBytes ?? 0);
    const filesToDelete: string[] = [];
    let nextPreviousFiles = review.previousFiles ?? [];
    let nextPreviousMeta = review.previousFilesMeta ?? [];
    let nextPreviousBytes = review.previousBytes ?? 0;

    if (review.status === 'Draft' && review.currentFiles?.length) {
        filesToDelete.push(...review.currentFiles);
        nextPreviousFiles = review.previousFiles ?? [];
        nextPreviousMeta = review.previousFilesMeta ?? [];
        nextPreviousBytes = review.previousBytes ?? 0;
    } else if (review.status !== 'Draft') {
        if (review.previousFiles?.length) {
            filesToDelete.push(...review.previousFiles);
        }
        nextPreviousFiles = review.currentFiles ?? [];
        nextPreviousMeta = review.currentFilesMeta ?? [];
        nextPreviousBytes = review.currentBytes ?? 0;
    }

    await Promise.all(filesToDelete.map((url) => deleteTaskFile(url)));

    const nextCurrentFiles = uploadedUrls;
    const nextCurrentMeta = uploadedMeta;
    const nextCurrentBytes = totalBytes;
    const newStorageBytes = nextCurrentBytes + nextPreviousBytes;
    const delta = newStorageBytes - oldStorageBytes;

    if (delta > 0) {
        await recordStorageBytes(task.orgId, delta);
    } else if (delta < 0) {
        await adjustStorageBytes(task.orgId, delta);
    }

    review.currentFiles = nextCurrentFiles;
    review.previousFiles = nextPreviousFiles;
    review.currentFilesMeta = nextCurrentMeta;
    review.previousFilesMeta = nextPreviousMeta;
    review.currentBytes = nextCurrentBytes;
    review.previousBytes = nextPreviousBytes;
    if (review.status === 'Issues') {
        review.status = 'Fixed';
    }
    review.events = Array.isArray(review.events) ? review.events : [];
    review.events.push({
        action: 'FILES_UPLOADED',
        author: actorName,
        authorId: user.id,
        date: new Date(),
        details: { files: uploadedUrls.length },
    });
    await review.save();

    return {
        ok: true,
        data: {
            files: uploadedUrls,
            status: review.status,
        },
    } as const;
};

export const submitDocumentReview = async (params: {
    taskId: string;
    changeLog?: string;
}) => {
    const user = await currentUser();
    if (!user) {
        return { ok: false, error: 'User is not authenticated', status: 401 } as const;
    }

    const taskIdDecoded = normalizeTaskId(decodeURIComponent(params.taskId));
    if (!taskIdDecoded) {
        return { ok: false, error: 'Task ID is required', status: 400 } as const;
    }
    const changeLog = params.changeLog?.trim() || '';

    const task = await TaskModel.findOne({ taskId: taskIdDecoded });
    if (!task) {
        return { ok: false, error: 'Task not found', status: 404 } as const;
    }
    if (task.taskType !== 'document') {
        return { ok: false, error: 'Task is not a document task', status: 400 } as const;
    }

    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data) {
        return { ok: false, error: getUserContextError(userContext), status: 401 } as const;
    }

    const role = resolveRole({
        userId: userContext.data.user.clerkUserId,
        effectiveRole: userContext.data.effectiveOrgRole,
        executorId: task.executorId ?? null,
    });
    if (role !== 'executor' && role !== 'manager') {
        return { ok: false, error: 'Недостаточно прав для отправки', status: 403 } as const;
    }

    const actorName = await resolveActorNameFromDb(user.id, buildActorName(user));
    const actor = { id: user.id, name: actorName };

    const review = await upsertDocumentReview({
        taskId: taskIdDecoded,
        taskName: task.taskName ?? '',
        orgId: String(task.orgId ?? ''),
        projectId: task.projectId ? String(task.projectId) : null,
        initiatorName: task.initiatorName ?? null,
        actor,
    });

    if (!ALLOWED_UPLOAD_STATUSES.has(review.status as DocumentReviewStatus)) {
        return { ok: false, error: 'Нельзя отправить на согласование в текущем статусе', status: 400 } as const;
    }

    if (!Array.isArray(review.currentFiles) || review.currentFiles.length === 0) {
        return { ok: false, error: 'Сначала загрузите файлы', status: 400 } as const;
    }

    const nextVersion = (review.currentVersion ?? 0) + 1;
    const filesMeta = toVersionFilesMeta(review.currentFilesMeta ?? []);
    const issuesSnapshot = toIssueSnapshots(review.issues ?? []);

    review.currentVersion = nextVersion;

    const nextStatus: DocumentReviewStatus = review.status === 'Draft' ? 'Pending' : 'Fixed';
    await updateDocumentStatus({ review, status: nextStatus, actor });
    await appendDocumentVersion({
        review,
        version: nextVersion,
        actor,
        changeLog,
        filesMeta,
        issuesSnapshot,
    });

    await syncTaskStatusFromDocument({
        taskId: taskIdDecoded,
        status: nextStatus,
        actor,
        comment: 'Документация отправлена на согласование',
    });

    const { projectLabel, managerName, managerEmail } = await resolveProjectEmailContext(task.projectId);
    const initiatorEmailNormalized =
        typeof task.initiatorEmail === 'string'
            ? task.initiatorEmail.trim().toLowerCase()
            : '';

    const { FRONTEND_URL } = getServerEnv();
    const frontendUrl = FRONTEND_URL || 'https://ciwork.ru';
    const reviewLink = `${frontendUrl}/documents/${encodeURIComponent(task.taskId.toLowerCase())}`;
    const guestLink = buildGuestLink(task.taskId, initiatorEmailNormalized);

    const recipientClerkIds = new Set<string>();
    if (typeof task.authorId === 'string' && task.authorId.trim()) {
        recipientClerkIds.add(task.authorId.trim());
    }

    const recipientsByClerkId = await UserModel.find({
        clerkUserId: { $in: Array.from(recipientClerkIds) },
    })
        .select('_id')
        .lean();

    const title = task.taskName
        ? `Документация по задаче "${task.taskName}"`
        : 'Документация по задаче';
    const message = `${actorName} отправил документацию на согласование. Статус: ${getStatusLabel(nextStatus)}.`;

    await Promise.all(
        recipientsByClerkId.map((recipient) =>
            createNotification({
                recipientUserId: recipient._id,
                type: 'task_status_change',
                title,
                message,
                link: `/documents/${encodeURIComponent(task.taskId.toLowerCase())}`,
                orgId: task.orgId ?? undefined,
                senderName: actorName,
            })
        )
    );

    if (initiatorEmailNormalized) {
        await sendEmail({
            to: initiatorEmailNormalized,
            subject: `${title} — на согласование`,
            text: `${message}\n\n${guestLink || reviewLink}`,
        });
    }

    if (managerEmail && managerEmail !== '—') {
        await sendEmail({
            to: managerEmail,
            subject: `${title} — на согласование`,
            text: `${message}\n\n${reviewLink}\nПроект: ${projectLabel}\nМенеджер: ${managerName}`,
        });
    }

    return {
        ok: true,
        data: { status: nextStatus, currentVersion: nextVersion },
    } as const;
};

export const addIssueToDocumentReview = async (params: {
    taskId: string;
    text: string;
}) => {
    const user = await currentUser();
    if (!user) {
        return { ok: false, error: 'User is not authenticated', status: 401 } as const;
    }

    const taskIdDecoded = normalizeTaskId(decodeURIComponent(params.taskId));
    if (!taskIdDecoded) {
        return { ok: false, error: 'Task ID is required', status: 400 } as const;
    }

    const text = params.text?.trim();
    if (!text) {
        return { ok: false, error: 'Введите текст замечания', status: 400 } as const;
    }

    const task = await TaskModel.findOne({ taskId: taskIdDecoded });
    if (!task) {
        return { ok: false, error: 'Task not found', status: 404 } as const;
    }

    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data) {
        return { ok: false, error: getUserContextError(userContext), status: 401 } as const;
    }

    const role = resolveRole({
        userId: userContext.data.user.clerkUserId,
        effectiveRole: userContext.data.effectiveOrgRole,
        executorId: task.executorId ?? null,
    });
    if (role !== 'manager') {
        return { ok: false, error: 'Недостаточно прав для замечаний', status: 403 } as const;
    }

    const actorName = await resolveActorNameFromDb(user.id, buildActorName(user));
    const actor = { id: user.id, name: actorName };

    const review = await upsertDocumentReview({
        taskId: taskIdDecoded,
        taskName: task.taskName ?? '',
        orgId: String(task.orgId ?? ''),
        projectId: task.projectId ? String(task.projectId) : null,
        initiatorName: task.initiatorName ?? null,
        actor,
    });

    const issue: DocumentIssue = {
        id: crypto.randomUUID(),
        text,
        status: 'open',
        createdAt: new Date(),
        createdById: user.id,
        createdByName: actorName,
        comments: [],
    };

    await addDocumentIssue({ review, issue, actor });
    if (review.status !== 'Issues') {
        await updateDocumentStatus({ review, status: 'Issues', actor });
        await syncTaskStatusFromDocument({
            taskId: taskIdDecoded,
            status: 'Issues',
            actor,
            comment: 'Добавлены замечания по документации',
        });
    }

    const recipients = new Set<string>();
    if (typeof task.executorId === 'string' && task.executorId.trim()) {
        recipients.add(task.executorId.trim());
    }

    const users = await UserModel.find({ clerkUserId: { $in: Array.from(recipients) } })
        .select('_id')
        .lean();

    await Promise.all(
        users.map((recipient) =>
            createNotification({
                recipientUserId: recipient._id,
                type: 'task_status_change',
                title: 'Замечания по документации',
                message: `${actorName} оставил замечания по задаче «${task.taskName ?? task.taskId}».`,
                link: `/documents/${encodeURIComponent(task.taskId.toLowerCase())}`,
                orgId: task.orgId ?? undefined,
                senderName: actorName,
            })
        )
    );

    return { ok: true, data: { issues: review.issues } } as const;
};

export const commentDocumentIssue = async (params: {
    taskId: string;
    issueId: string;
    text: string;
    type: 'comment' | 'fix-note';
}) => {
    const user = await currentUser();
    if (!user) {
        return { ok: false, error: 'User is not authenticated', status: 401 } as const;
    }

    const taskIdDecoded = normalizeTaskId(decodeURIComponent(params.taskId));
    if (!taskIdDecoded) {
        return { ok: false, error: 'Task ID is required', status: 400 } as const;
    }

    const text = params.text?.trim();
    if (!text) {
        return { ok: false, error: 'Введите текст комментария', status: 400 } as const;
    }

    const task = await TaskModel.findOne({ taskId: taskIdDecoded });
    if (!task) {
        return { ok: false, error: 'Task not found', status: 404 } as const;
    }

    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data) {
        return { ok: false, error: getUserContextError(userContext), status: 401 } as const;
    }

    const role = resolveRole({
        userId: userContext.data.user.clerkUserId,
        effectiveRole: userContext.data.effectiveOrgRole,
        executorId: task.executorId ?? null,
    });

    if (role !== 'manager' && role !== 'executor') {
        return { ok: false, error: 'Недостаточно прав для комментариев', status: 403 } as const;
    }

    const actorName = await resolveActorNameFromDb(user.id, buildActorName(user));
    const actor = { id: user.id, name: actorName };

    const review = await upsertDocumentReview({
        taskId: taskIdDecoded,
        taskName: task.taskName ?? '',
        orgId: String(task.orgId ?? ''),
        projectId: task.projectId ? String(task.projectId) : null,
        initiatorName: task.initiatorName ?? null,
        actor,
    });

    const comment: DocumentIssueComment = {
        id: crypto.randomUUID(),
        text,
        authorId: user.id,
        authorName: actorName,
        createdAt: new Date(),
        type: params.type,
    };

    await addDocumentIssueComment({ review, issueId: params.issueId, comment, actor });

    return { ok: true, data: { issues: review.issues } } as const;
};

export const resolveDocumentIssueAction = async (params: {
    taskId: string;
    issueId: string;
}) => {
    const user = await currentUser();
    if (!user) {
        return { ok: false, error: 'User is not authenticated', status: 401 } as const;
    }

    const taskIdDecoded = normalizeTaskId(decodeURIComponent(params.taskId));
    if (!taskIdDecoded) {
        return { ok: false, error: 'Task ID is required', status: 400 } as const;
    }

    const task = await TaskModel.findOne({ taskId: taskIdDecoded });
    if (!task) {
        return { ok: false, error: 'Task not found', status: 404 } as const;
    }

    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data) {
        return { ok: false, error: getUserContextError(userContext), status: 401 } as const;
    }

    const role = resolveRole({
        userId: userContext.data.user.clerkUserId,
        effectiveRole: userContext.data.effectiveOrgRole,
        executorId: task.executorId ?? null,
    });

    if (role !== 'manager') {
        return { ok: false, error: 'Недостаточно прав для подтверждения', status: 403 } as const;
    }

    const actorName = await resolveActorNameFromDb(user.id, buildActorName(user));
    const actor = { id: user.id, name: actorName };

    const review = await upsertDocumentReview({
        taskId: taskIdDecoded,
        taskName: task.taskName ?? '',
        orgId: String(task.orgId ?? ''),
        projectId: task.projectId ? String(task.projectId) : null,
        initiatorName: task.initiatorName ?? null,
        actor,
    });

    await resolveDocumentIssue({ review, issueId: params.issueId, actor });

    const hasOpenIssues = (review.issues ?? []).some(
        (issue: DocumentIssue) => issue.status !== 'resolved'
    );
    if (!hasOpenIssues && review.status !== 'Agreed') {
        await updateDocumentStatus({ review, status: 'Agreed', actor });
        await syncTaskStatusFromDocument({
            taskId: taskIdDecoded,
            status: 'Agreed',
            actor,
            comment: 'Документация согласована',
        });

        const recipients = new Set<string>();
        if (typeof task.executorId === 'string' && task.executorId.trim()) {
            recipients.add(task.executorId.trim());
        }

        const users = await UserModel.find({ clerkUserId: { $in: Array.from(recipients) } })
            .select('_id')
            .lean();

        await Promise.all(
            users.map((recipient) =>
                createNotification({
                    recipientUserId: recipient._id,
                    type: 'task_status_change',
                    title: 'Документация согласована',
                    message: `${actorName} согласовал документацию по задаче «${task.taskName ?? task.taskId}».`,
                    link: `/documents/${encodeURIComponent(task.taskId.toLowerCase())}`,
                    orgId: task.orgId ?? undefined,
                    senderName: actorName,
                })
            )
        );
    }

    return { ok: true, data: { issues: review.issues, status: review.status } } as const;
};

export const approveDocumentReview = async (params: { taskId: string }) => {
    const user = await currentUser();
    if (!user) {
        return { ok: false, error: 'User is not authenticated', status: 401 } as const;
    }

    const taskIdDecoded = normalizeTaskId(decodeURIComponent(params.taskId));
    if (!taskIdDecoded) {
        return { ok: false, error: 'Task ID is required', status: 400 } as const;
    }

    const task = await TaskModel.findOne({ taskId: taskIdDecoded });
    if (!task) {
        return { ok: false, error: 'Task not found', status: 404 } as const;
    }

    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data) {
        return { ok: false, error: getUserContextError(userContext), status: 401 } as const;
    }

    const role = resolveRole({
        userId: userContext.data.user.clerkUserId,
        effectiveRole: userContext.data.effectiveOrgRole,
        executorId: task.executorId ?? null,
    });
    if (role !== 'manager') {
        return { ok: false, error: 'Недостаточно прав для согласования', status: 403 } as const;
    }

    const actorName = await resolveActorNameFromDb(user.id, buildActorName(user));
    const actor = { id: user.id, name: actorName };

    const review = await upsertDocumentReview({
        taskId: taskIdDecoded,
        taskName: task.taskName ?? '',
        orgId: String(task.orgId ?? ''),
        projectId: task.projectId ? String(task.projectId) : null,
        initiatorName: task.initiatorName ?? null,
        actor,
    });

    const hasOpenIssues = (review.issues ?? []).some(
        (issue: DocumentIssue) => issue.status !== 'resolved'
    );
    if (hasOpenIssues) {
        return { ok: false, error: 'Есть незакрытые замечания', status: 400 } as const;
    }

    await updateDocumentStatus({ review, status: 'Agreed', actor });
    await syncTaskStatusFromDocument({
        taskId: taskIdDecoded,
        status: 'Agreed',
        actor,
        comment: 'Документация согласована',
    });

    const recipients = new Set<string>();
    if (typeof task.executorId === 'string' && task.executorId.trim()) {
        recipients.add(task.executorId.trim());
    }

    const users = await UserModel.find({ clerkUserId: { $in: Array.from(recipients) } })
        .select('_id')
        .lean();

    await Promise.all(
        users.map((recipient) =>
            createNotification({
                recipientUserId: recipient._id,
                type: 'task_status_change',
                title: 'Документация согласована',
                message: `${actorName} согласовал документацию по задаче «${task.taskName ?? task.taskId}».`,
                link: `/documents/${encodeURIComponent(task.taskId.toLowerCase())}`,
                orgId: task.orgId ?? undefined,
                senderName: actorName,
            })
        )
    );

    return { ok: true, data: { status: review.status } } as const;
};
