import 'server-only';

import TaskModel from '@/server/models/TaskModel';
import ReportModel from '@/server/models/ReportModel';
import UserModel from '@/server/models/UserModel';
import { createNotification } from '@/server/notifications/service';
import { sendEmail } from '@/server/email/mailer';
import { getAggregatedReportStatus } from '@/server-actions/reportService';
import { signInitiatorAccessToken } from '@/utils/initiatorAccessToken';
import { getServerEnv } from '@/config/env';

type SubmitPayload = {
    taskId?: string;
    baseIds?: string[];
};

type ActorContext = {
    clerkUserId: string;
    name: string;
    email?: string;
};

const normalizeBaseIds = (baseIds?: string[]) =>
    Array.isArray(baseIds)
        ? baseIds.map((id) => id.trim()).filter((id) => id.length > 0)
        : [];

export const submitReport = async (payload: SubmitPayload, actor: ActorContext) => {
    const taskId = payload.taskId?.trim().toUpperCase() || '';
    const baseIds = normalizeBaseIds(payload.baseIds);

    if (!taskId) {
        return { ok: false, error: 'Task ID is required', status: 400 } as const;
    }
    if (baseIds.length === 0) {
        return { ok: false, error: 'Base IDs are required', status: 400 } as const;
    }

    const task = await TaskModel.findOne({ taskId }).lean();
    if (!task) {
        return { ok: false, error: 'Task not found', status: 404 } as const;
    }

    const reports = await ReportModel.find({
        taskId,
        baseId: { $in: baseIds },
    })
        .select('baseId files')
        .lean();

    const uploadedBases = new Set(
        reports
            .filter((report) => Array.isArray(report.files) && report.files.length > 0)
            .map((report) => report.baseId)
    );

    const missingBases = baseIds.filter((baseId) => !uploadedBases.has(baseId));
    if (missingBases.length > 0) {
        return {
            ok: false,
            error: `Нет загруженных фото для БС: ${missingBases.join(', ')}`,
            status: 400,
        } as const;
    }

    const actorName = task.executorName?.trim() || actor.name || 'Исполнитель';
    const oldStatus = task.status;
    const aggregatedStatus = await getAggregatedReportStatus(taskId);
    const newStatus = aggregatedStatus ?? 'Pending';

    await TaskModel.updateOne(
        { taskId },
        {
            $set: { status: newStatus },
            $push: {
                events: {
                    action: 'STATUS_CHANGED',
                    author: actorName,
                    authorId: actor.clerkUserId,
                    date: new Date(),
                    details: {
                        oldStatus,
                        newStatus,
                        comment: 'Статус изменен после отправки фотоотчета',
                    },
                },
            },
        }
    ).exec();

    const { FRONTEND_URL } = getServerEnv();
    const frontendUrl = FRONTEND_URL || 'https://ciwork.ru';
    const reportLink = `${frontendUrl}/reports?highlightTaskId=${encodeURIComponent(task.taskId)}`;
    const bsInfo = task.bsNumber ? ` (БС ${task.bsNumber})` : '';
    const reportTitle = task.taskName
        ? `Фотоотчет по задаче "${task.taskName}"${bsInfo}`
        : 'Фотоотчет по задаче';
    const reportMessage = `${actorName} отправил фотоотчет${bsInfo ? ` по${bsInfo}` : ''}. Статус: ${newStatus}.`;
    const baseListLine = baseIds.length > 0 ? `БС: ${baseIds.join(', ')}` : '';

    const recipientClerkIds = new Set<string>();
    if (typeof task.authorId === 'string' && task.authorId.trim()) {
        recipientClerkIds.add(task.authorId.trim());
    }

    const recipientsByClerkId = await UserModel.find({
        clerkUserId: { $in: Array.from(recipientClerkIds) },
    })
        .select('_id clerkUserId email')
        .lean()
        .exec();

    const recipientEmails = new Set<string>();
    recipientsByClerkId.forEach((recipient) => {
        if (recipient.email) {
            recipientEmails.add(recipient.email.trim().toLowerCase());
        }
    });

    const directEmails = new Set<string>();
    if (typeof task.authorEmail === 'string' && task.authorEmail.trim()) {
        directEmails.add(task.authorEmail.trim().toLowerCase());
    }
    if (typeof task.initiatorEmail === 'string' && task.initiatorEmail.trim()) {
        directEmails.add(task.initiatorEmail.trim().toLowerCase());
    }
    const initiatorEmailNormalized =
        typeof task.initiatorEmail === 'string'
            ? task.initiatorEmail.trim().toLowerCase()
            : '';
    const initiatorAccessLink = initiatorEmailNormalized
        ? `${frontendUrl}/reports?token=${encodeURIComponent(
              signInitiatorAccessToken({
                  taskId: task.taskId,
                  email: initiatorEmailNormalized,
              })
          )}&highlightTaskId=${encodeURIComponent(task.taskId.toLowerCase())}`
        : '';

    const metadataEntries = Object.entries({
        taskId: task.taskId,
        bsNumber: task.bsNumber,
        newStatus,
        baseIds,
    }).filter(([, value]) => typeof value !== 'undefined' && value !== null);
    const metadata =
        metadataEntries.length > 0 ? Object.fromEntries(metadataEntries) : undefined;

    try {
        for (const recipient of recipientsByClerkId) {
            await createNotification({
                recipientUserId: recipient._id,
                type: 'task_status_change',
                title: reportTitle,
                message: reportMessage,
                link: `/reports?highlightTaskId=${encodeURIComponent(
                    task.taskId.toLowerCase()
                )}`,
                orgId: task.orgId ?? undefined,
                senderName: actorName,
                senderEmail: actor.email ?? undefined,
                metadata,
            });
        }
    } catch (error) {
        console.error('Failed to create report notifications', error);
    }

    for (const email of directEmails) {
        if (recipientEmails.has(email)) continue;
        try {
            const link =
                email === initiatorEmailNormalized && initiatorAccessLink
                    ? initiatorAccessLink
                    : reportLink;
            await sendEmail({
                to: email,
                subject: reportTitle,
                text: [reportMessage, baseListLine, `Ссылка: ${link}`]
                    .filter(Boolean)
                    .join('\n\n'),
                html: `
<p>${reportMessage}</p>
${baseListLine ? `<p>${baseListLine}</p>` : ''}
<p><a href="${link}">Перейти к фотоотчетам</a></p>`,
            });
        } catch (error) {
            console.error('Failed to send report email', error);
        }
    }

    return {
        ok: true,
        data: {
            success: true,
            message: 'Фотоотчет отправлен',
        },
    } as const;
};
