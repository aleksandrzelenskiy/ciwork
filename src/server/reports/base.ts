import 'server-only';

import path from 'path';
import { currentUser } from '@clerk/nextjs/server';
import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import OrganizationModel from '@/server/models/OrganizationModel';
import ReportDeletionLog from '@/server/models/ReportDeletionLog';
import UserModel from '@/server/models/UserModel';
import { createNotification } from '@/server/notifications/service';
import { GetUserContext } from '@/server-actions/user-context';
import { getAggregatedReportStatus } from '@/server-actions/reportService';
import { mapRoleToLegacy } from '@/utils/roleMapping';
import { verifyInitiatorAccessToken } from '@/utils/initiatorAccessToken';
import {
    deleteStoragePrefix,
    deleteTaskFile,
    storageKeyFromPublicUrl,
} from '@/utils/s3';
import { adjustStorageBytes } from '@/utils/storageUsage';

type ReportParams = {
    taskId: string;
    baseId: string;
};

const normalizeParams = (params: ReportParams) => {
    const taskIdDecoded = decodeURIComponent(params.taskId).toUpperCase();
    const baseIdDecoded = decodeURIComponent(params.baseId);
    return { taskIdDecoded, baseIdDecoded };
};

export const getReportDetails = async ({
    taskId,
    baseId,
    token,
}: ReportParams & { token?: string }) => {
    const { taskIdDecoded, baseIdDecoded } = normalizeParams({ taskId, baseId });

    if (!taskIdDecoded || !baseIdDecoded) {
        return { ok: false, error: 'Missing parameters in URL', status: 400 } as const;
    }

    const report = await ReportModel.findOne({
        baseId: baseIdDecoded,
        taskId: taskIdDecoded,
    });

    if (!report) {
        return { ok: false, error: 'Отчёт не найден', status: 404 } as const;
    }

    const taskRecord = await TaskModel.findOne({ taskId: taskIdDecoded })
        .select('taskName bsNumber executorName initiatorEmail initiatorName orgId projectId')
        .lean();
    const projectId =
        report.projectId?.toString?.() ?? taskRecord?.projectId?.toString?.() ?? null;
    const orgId =
        report.orgId?.toString?.() ?? taskRecord?.orgId?.toString?.() ?? null;
    const [project, org] = await Promise.all([
        projectId ? ProjectModel.findById(projectId).select('key').lean() : null,
        orgId ? OrganizationModel.findById(orgId).select('orgSlug').lean() : null,
    ]);

    const authorProfile = report.createdById
        ? await UserModel.findOne({ clerkUserId: report.createdById })
              .select('name email')
              .lean()
        : null;
    const createdByName =
        authorProfile?.name?.trim() ||
        authorProfile?.email?.trim() ||
        report.createdByName;

    const trimmedToken = token?.trim() ?? '';
    const guestAccess = trimmedToken ? verifyInitiatorAccessToken(trimmedToken) : null;
    const initiatorEmail = taskRecord?.initiatorEmail?.trim().toLowerCase() || '';
    const isGuestAllowed =
        !!guestAccess &&
        guestAccess.taskId === taskIdDecoded &&
        initiatorEmail &&
        initiatorEmail === guestAccess.email;

    let role: ReturnType<typeof mapRoleToLegacy> = null;
    if (isGuestAllowed) {
        role = 'viewer';
    } else {
        const userContext = await GetUserContext();
        if (!userContext.success || !userContext.data) {
            const errorMessage = userContext.success
                ? 'Нет активной сессии пользователя'
                : userContext.message || 'Нет активной сессии пользователя';
            return { ok: false, error: errorMessage, status: 401 } as const;
        }
        role = mapRoleToLegacy(
            userContext.data.effectiveOrgRole ||
                userContext.data.activeMembership?.role ||
                null
        );
    }

    return {
        ok: true,
        data: {
            taskId: report.taskId,
            taskName: report.taskName || taskRecord?.taskName,
            orgSlug: org?.orgSlug ?? null,
            projectKey: project?.key ?? null,
            bsNumber: taskRecord?.bsNumber,
            files: report.files,
            createdAt: report.createdAt,
            createdById: report.createdById,
            createdByName,
            executorName: taskRecord?.executorName ?? report.createdByName,
            reviewerName: report.initiatorName,
            status: report.status,
            issues: report.issues || [],
            fixedFiles: report.fixedFiles || [],
            events: report.events || [],
            role,
        },
    } as const;
};

export const updateReport = async ({
    taskId,
    baseId,
    token,
    status,
    issues,
    user,
}: ReportParams & {
    token?: string;
    status?: string;
    issues?: string[];
    user: Awaited<ReturnType<typeof currentUser>> | null;
}) => {
    const { taskIdDecoded, baseIdDecoded } = normalizeParams({ taskId, baseId });

    if (!taskIdDecoded || !baseIdDecoded) {
        return { ok: false, error: 'Missing parameters in URL', status: 400 } as const;
    }

    const trimmedToken = token?.trim() ?? '';
    const guestAccess = trimmedToken ? verifyInitiatorAccessToken(trimmedToken) : null;

    const report = await ReportModel.findOne({
        baseId: baseIdDecoded,
        taskId: taskIdDecoded,
    });

    if (!report) {
        return { ok: false, error: 'Отчёт не найден', status: 404 } as const;
    }

    let actorName = '';
    let actorId = '';
    let actorEmail: string | undefined;
    const allowedGuestStatuses = new Set(['Agreed', 'Issues', 'Pending']);
    if (guestAccess) {
        const taskRecord = await TaskModel.findOne({ taskId: taskIdDecoded })
            .select('initiatorEmail initiatorName')
            .lean();
        const initiatorEmail = taskRecord?.initiatorEmail?.trim().toLowerCase() || '';
        if (
            guestAccess.taskId !== taskIdDecoded ||
            !initiatorEmail ||
            initiatorEmail !== guestAccess.email
        ) {
            return {
                ok: false,
                error: 'Недостаточно прав для обновления отчёта',
                status: 403,
            } as const;
        }
        if (status && !allowedGuestStatuses.has(status)) {
            return {
                ok: false,
                error: 'Недопустимый статус для инициатора',
                status: 403,
            } as const;
        }
        actorName = taskRecord?.initiatorName?.trim() || guestAccess.email;
        actorId = `guest:${guestAccess.email}`;
        actorEmail = guestAccess.email;
    } else {
        if (!user) {
            return {
                ok: false,
                error: 'Пользователь не авторизован',
                status: 401,
            } as const;
        }
        actorName = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();
        actorId = user.id;
        actorEmail = user.emailAddresses?.[0]?.emailAddress;
    }

    const oldStatus = report.status;
    const oldIssues = [...report.issues];

    if (status && status !== oldStatus) {
        report.status = status;
        report.events = report.events || [];
        report.events.push({
            action: 'STATUS_CHANGED',
            author: actorName,
            authorId: actorId,
            date: new Date(),
            details: {
                oldStatus,
                newStatus: status,
            },
        });
    }

    let issuesChanged = false;
    if (Array.isArray(issues)) {
        const oldIssuesSet = new Set(oldIssues);
        const newIssuesSet = new Set(issues);

        const addedIssues = issues.filter((i) => !oldIssuesSet.has(i));
        const removedIssues = oldIssues.filter((i) => !newIssuesSet.has(i));

        if (addedIssues.length > 0 || removedIssues.length > 0) {
            issuesChanged = true;
            report.issues = Array.from(newIssuesSet);
        }
    }

    if (issuesChanged) {
        report.events = report.events || [];
        report.events.push({
            action: 'ISSUES_UPDATED',
            author: actorName,
            authorId: actorId,
            date: new Date(),
            details: {
                oldIssues,
                newIssues: report.issues,
            },
        });
    }

    await report.save();

    const relatedTask = await TaskModel.findOne({ taskId: report.taskId });
    const aggregatedStatus = relatedTask
        ? await getAggregatedReportStatus(report.taskId)
        : null;
    if (relatedTask && aggregatedStatus && relatedTask.status !== aggregatedStatus) {
        const allowedPublicStatuses = new Set([
            'open',
            'in_review',
            'assigned',
            'closed',
        ]);
        if (relatedTask.publicStatus && !allowedPublicStatuses.has(relatedTask.publicStatus)) {
            relatedTask.publicStatus = 'closed';
        }
        const oldTaskStatus = relatedTask.status;
        relatedTask.status = aggregatedStatus;

        relatedTask.events = relatedTask.events || [];
        relatedTask.events.push({
            action: 'STATUS_CHANGED',
            author: actorName,
            authorId: actorId,
            date: new Date(),
            details: {
                oldStatus: oldTaskStatus,
                newStatus: aggregatedStatus,
                comment: 'Статус синхронизирован с фотоотчетами',
            },
        });

        await relatedTask.save();
    }

    const statusChanged = Boolean(status && status !== oldStatus);
    const hasIssuesNow = Array.isArray(report.issues) && report.issues.length > 0;
    const shouldNotifyAgreed = statusChanged && report.status === 'Agreed';
    const shouldNotifyIssues =
        !shouldNotifyAgreed &&
        ((statusChanged && report.status === 'Issues') || (issuesChanged && hasIssuesNow));

    if ((shouldNotifyIssues || shouldNotifyAgreed) && relatedTask) {
        const recipientClerkIds = new Set<string>();
        if (typeof relatedTask.authorId === 'string' && relatedTask.authorId.trim()) {
            recipientClerkIds.add(relatedTask.authorId.trim());
        }
        if (typeof relatedTask.executorId === 'string' && relatedTask.executorId.trim()) {
            recipientClerkIds.add(relatedTask.executorId.trim());
        }
        if (actorId && !actorId.startsWith('guest:')) {
            recipientClerkIds.delete(actorId);
        }

        if (recipientClerkIds.size > 0) {
            const recipients = await UserModel.find({
                clerkUserId: { $in: Array.from(recipientClerkIds) },
            })
                .select('_id')
                .lean()
                .exec();

            const bsInfo = relatedTask.bsNumber ? ` (БС ${relatedTask.bsNumber})` : '';
            const baseInfo = baseIdDecoded ? ` БС ${baseIdDecoded}` : '';
            const taskTitle = relatedTask.taskName || relatedTask.taskId;
            const reportLink = `/reports/${encodeURIComponent(
                taskIdDecoded
            )}/${encodeURIComponent(baseIdDecoded)}`;
            const issuesLink = `/tasks/${encodeURIComponent(
                taskIdDecoded.toLowerCase()
            )}?focus=issues`;
            const link = shouldNotifyIssues ? issuesLink : reportLink;

            const metadata = {
                taskId: relatedTask.taskId,
                baseId: baseIdDecoded,
                status: report.status,
                issuesCount: report.issues?.length ?? 0,
            };

            const title = shouldNotifyAgreed
                ? `Фотоотчет согласован${bsInfo}`
                : `Замечания по фотоотчету${bsInfo}`;
            const message = shouldNotifyAgreed
                ? `${actorName} согласовал фотоотчет по задаче «${taskTitle}»${baseInfo}.`
                : `${actorName} оставил замечания по фотоотчету по задаче «${taskTitle}»${baseInfo}.`;

            await Promise.all(
                recipients.map((recipient) =>
                    createNotification({
                        recipientUserId: recipient._id,
                        type: 'task_status_change',
                        title,
                        message,
                        link,
                        orgId: relatedTask.orgId ?? undefined,
                        senderName: actorName,
                        senderEmail: actorEmail,
                        metadata,
                    })
                )
            );
        }
    }

    return { ok: true, data: { message: 'Отчёт успешно обновлён' } } as const;
};

export const deleteReport = async ({ taskId, baseId }: ReportParams) => {
    const { taskIdDecoded, baseIdDecoded } = normalizeParams({ taskId, baseId });

    if (!taskIdDecoded || !baseIdDecoded) {
        return { ok: false, error: 'Missing parameters in URL', status: 400 } as const;
    }

    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data) {
        const errorMessage = userContext.success
            ? 'Нет активной сессии пользователя'
            : userContext.message || 'Нет активной сессии пользователя';
        return { ok: false, error: errorMessage, status: 401 } as const;
    }

    const userEmail = userContext.data.user.email?.trim().toLowerCase();
    if (!userEmail) {
        return { ok: false, error: 'Не удалось определить пользователя', status: 401 } as const;
    }

    const report = await ReportModel.findOne({
        baseId: baseIdDecoded,
        taskId: taskIdDecoded,
    });

    if (!report) {
        return { ok: false, error: 'Отчёт не найден', status: 404 } as const;
    }

    const taskRecord = await TaskModel.findOne({ taskId: taskIdDecoded })
        .select('orgId projectId taskName bsNumber')
        .lean();
    const projectId =
        report.projectId?.toString?.() ?? taskRecord?.projectId?.toString?.() ?? null;
    if (!projectId) {
        return { ok: false, error: 'Проект для отчёта не найден', status: 404 } as const;
    }

    const project = await ProjectModel.findById(projectId).select('managers').lean();
    const managers = Array.isArray(project?.managers) ? project?.managers : [];
    const managesProject = managers.some(
        (manager) =>
            typeof manager === 'string' && manager.trim().toLowerCase() === userEmail
    );
    if (!managesProject) {
        return {
            ok: false,
            error: 'Недостаточно прав для удаления отчёта',
            status: 403,
        } as const;
    }

    const allFiles = [...report.files, ...report.fixedFiles].filter(
        (file): file is string => typeof file === 'string' && file.length > 0
    );

    const prefixSet = new Set<string>();
    const fallbackDeletes: Promise<void>[] = [];

    const safeOrgFolder =
        (taskRecord?.orgId ?? report.orgId)
            ?.toString?.()
            ?.replace(/[\\/]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/\.+/g, '.')
            .trim() || 'unknown-org';
    const safeProjectFolder =
        (taskRecord?.projectId ?? report.projectId)
            ?.toString?.()
            ?.replace(/[\\/]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/\.+/g, '.')
            .trim() || 'unknown-project';
    const safeBaseFolder =
        baseIdDecoded
            .replace(/[\\/]/g, '_')
            .replace(/\s+/g, '_')
            .replace(/\.+/g, '.')
            .trim() || 'base';
    const safeTaskFolder =
        taskIdDecoded.replace(/[\\/]/g, '_').replace(/\s+/g, '_').trim() || 'task';

    const reportFolder = path.posix.join(
        'uploads',
        safeOrgFolder,
        safeProjectFolder,
        safeTaskFolder,
        `${safeTaskFolder}-reports`,
        safeBaseFolder
    );
    prefixSet.add(`${reportFolder.replace(/\/+$/, '')}/`);

    const reportFolderWithoutOrg = path.posix.join(
        'uploads',
        safeTaskFolder,
        `${safeTaskFolder}-reports`,
        safeBaseFolder
    );
    prefixSet.add(`${reportFolderWithoutOrg.replace(/\/+$/, '')}/`);

    for (const fileUrl of allFiles) {
        const key = storageKeyFromPublicUrl(fileUrl);
        if (!key) {
            fallbackDeletes.push(deleteTaskFile(fileUrl));
            continue;
        }

        const dir = path.posix.dirname(key);
        if (dir && dir !== '.') {
            prefixSet.add(`${dir.replace(/\/+$/, '')}/`);
        }
    }

    await Promise.all([
        ...Array.from(prefixSet).map((prefix) => deleteStoragePrefix(prefix)),
        ...fallbackDeletes,
    ]);

    if (report.storageBytes && report.orgId) {
        await adjustStorageBytes(report.orgId.toString(), -Math.abs(report.storageBytes));
    }

    await ReportDeletionLog.create({
        orgId: report.orgId ?? taskRecord?.orgId,
        projectId: report.projectId ?? taskRecord?.projectId,
        taskId: report.taskId,
        taskName: report.taskName || taskRecord?.taskName,
        baseId: report.baseId,
        deletedById: userContext.data.user.clerkUserId,
        deletedByEmail: userContext.data.user.email,
        deletedAt: new Date(),
    });

    await ReportModel.deleteOne({ _id: report._id });

    return { ok: true, data: { message: 'Отчёт успешно удалён' } } as const;
};
