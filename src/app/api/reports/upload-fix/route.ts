import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import { currentUser } from '@clerk/nextjs/server';
import { uploadBuffer } from '@/utils/s3';
import { assertWritableStorage, recordStorageBytes } from '@/utils/storageUsage';
import { appendReportFiles, syncTaskStatus, upsertReport } from '@/server-actions/reportService';
import { buildReportKey, extractUploadPayload, prepareImageBuffer, resolveStorageScope } from '@/app/api/reports/_shared';
import UserModel from '@/app/models/UserModel';
import { createNotification } from '@/app/utils/notificationService';
import ProjectModel from '@/app/models/ProjectModel';
import { sendEmail } from '@/utils/mailer';
import { signInitiatorAccessToken } from '@/utils/initiatorAccessToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const buildActorName = (user: Awaited<ReturnType<typeof currentUser>>) => {
    if (!user) return 'Исполнитель';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.username || user.id;
};

export async function POST(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'User is not authenticated' }, { status: 401 });
    }

    const payload = await extractUploadPayload(request);
    if (!payload.taskId || !payload.baseId) {
        return NextResponse.json({ error: 'taskId and baseId are required' }, { status: 400 });
    }
    if (payload.files.length === 0) {
        return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }
    const invalidFiles = payload.files.filter((file) => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    await dbConnect();

    const task = await TaskModel.findOne({ taskId: payload.taskId }).lean();
    if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!task.orgId) {
        return NextResponse.json({ error: 'Task organization is missing' }, { status: 400 });
    }

    const storageCheck = await assertWritableStorage(task.orgId);
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

    const scope = await resolveStorageScope(task);
    const uploadedUrls: string[] = [];
    let totalBytes = 0;

    for (const file of payload.files) {
        const prepared = await prepareImageBuffer(file, {
            taskId: payload.taskId,
            taskName: task.taskName ?? null,
            baseId: payload.baseId,
            bsNumber: task.bsNumber ?? null,
            executorName: task.executorName ?? buildActorName(user),
            orgName: scope.orgName ?? null,
            projectId: task.projectId ? String(task.projectId) : null,
            projectKey: scope.projectKey ?? null,
        });
        const key = buildReportKey({
            orgSlug: scope.orgSlug,
            projectKey: scope.projectKey,
            taskId: payload.taskId,
            baseId: payload.baseId,
            filename: prepared.filename,
            isFix: true,
        });
        const url = await uploadBuffer(prepared.buffer, key, prepared.contentType || 'image/jpeg');
        uploadedUrls.push(url);
        totalBytes += prepared.size;
    }

    await recordStorageBytes(task.orgId, totalBytes);

    const executorName =
        typeof task.executorName === 'string' && task.executorName.trim()
            ? task.executorName.trim()
            : null;
    const actorName = executorName ?? buildActorName(user);
    const actor = { id: user.id, name: actorName };
    const actorEmail = user.emailAddresses?.[0]?.emailAddress;
    const initiatorEmailNormalized =
        typeof task.initiatorEmail === 'string' ? task.initiatorEmail.trim().toLowerCase() : '';
    const report = await upsertReport({
        taskId: payload.taskId,
        baseId: payload.baseId,
        taskName: task.taskName ?? '',
        orgId: String(task.orgId ?? ''),
        projectId: task.projectId ? String(task.projectId) : null,
        initiatorName: task.initiatorName ?? null,
        actor,
    });

    await appendReportFiles({ report, files: uploadedUrls, bytesAdded: totalBytes, actor, kind: 'fix' });
    await syncTaskStatus({
        taskId: payload.taskId,
        status: 'Fixed',
        actor,
        comment: 'Исполнитель загрузил исправления по фотоотчету',
    });

    const recipientClerkIds = new Set<string>();
    if (typeof task.authorId === 'string' && task.authorId.trim()) {
        recipientClerkIds.add(task.authorId.trim());
    }
    if (typeof task.executorId === 'string' && task.executorId.trim()) {
        recipientClerkIds.add(task.executorId.trim());
    }
    recipientClerkIds.delete(user.id);

    const recipientEmails = new Set<string>();
    if (typeof task.authorEmail === 'string' && task.authorEmail.trim()) {
        recipientEmails.add(task.authorEmail.trim().toLowerCase());
    }
    if (initiatorEmailNormalized) {
        recipientEmails.add(initiatorEmailNormalized);
    }

    if (task.projectId) {
        const project = await ProjectModel.findById(task.projectId).select('managers').lean();
        const managers = Array.isArray(project?.managers) ? project.managers : [];
        managers.forEach((email) => {
            if (typeof email === 'string' && email.trim()) {
                recipientEmails.add(email.trim().toLowerCase());
            }
        });
    }

    if (actorEmail) {
        recipientEmails.delete(actorEmail.trim().toLowerCase());
    }

    if (recipientClerkIds.size > 0 || recipientEmails.size > 0) {
        const orConditions: Record<string, unknown>[] = [];
        if (recipientClerkIds.size > 0) {
            orConditions.push({ clerkUserId: { $in: Array.from(recipientClerkIds) } });
        }
        if (recipientEmails.size > 0) {
            orConditions.push({ email: { $in: Array.from(recipientEmails) } });
        }

        const recipients = await UserModel.find({ $or: orConditions })
            .select('_id clerkUserId email')
            .lean()
            .exec();

        const filteredRecipients = recipients.filter((recipient) => {
            const isActorByClerk = Boolean(recipient?.clerkUserId && recipient.clerkUserId === user.id);
            const isActorByEmail = Boolean(
                recipient?.email &&
                    actorEmail &&
                    recipient.email.trim().toLowerCase() === actorEmail.trim().toLowerCase()
            );
            return !isActorByClerk && !isActorByEmail;
        });
        const initiatorNotifiedInApp = Boolean(
            initiatorEmailNormalized &&
                filteredRecipients.some(
                    (recipient) =>
                        typeof recipient.email === 'string' &&
                        recipient.email.trim().toLowerCase() === initiatorEmailNormalized
                )
        );

        if (filteredRecipients.length > 0) {
            const bsInfo = task.bsNumber ? ` (БС ${task.bsNumber})` : '';
            const baseInfo = payload.baseId ? ` БС ${payload.baseId}` : '';
            const taskTitle = task.taskName || task.taskId;
            const link = `/reports/${encodeURIComponent(payload.taskId)}/${encodeURIComponent(
                payload.baseId
            )}`;

            await Promise.all(
                filteredRecipients.map((recipient) =>
                    createNotification({
                        recipientUserId: recipient._id,
                        type: 'task_status_change',
                        title: `Исправления по фотоотчету${bsInfo}`,
                        message: `${actorName} загрузил исправления по фотоотчету по задаче «${taskTitle}»${baseInfo}.`,
                        link,
                        orgId: task.orgId ?? undefined,
                        senderName: actorName,
                        senderEmail: actorEmail,
                        metadata: {
                            taskId: task.taskId,
                            baseId: payload.baseId,
                            status: 'Fixed',
                            fixedFilesCount: uploadedUrls.length,
                        },
                    })
                )
            );
        }

        if (initiatorEmailNormalized && !initiatorNotifiedInApp) {
            const frontendUrl = process.env.FRONTEND_URL || 'https://ciwork.ru';
            const token = signInitiatorAccessToken({
                taskId: task.taskId,
                email: initiatorEmailNormalized,
            });
            const initiatorLink = `${frontendUrl}/reports/${encodeURIComponent(
                payload.taskId
            )}/${encodeURIComponent(payload.baseId)}?token=${encodeURIComponent(token)}`;
            const bsInfo = task.bsNumber ? ` (БС ${task.bsNumber})` : '';
            const baseInfo = payload.baseId ? ` БС ${payload.baseId}` : '';
            const taskTitle = task.taskName || task.taskId;
            const subject = `Исправления по фотоотчету${bsInfo}`;
            const text = `${actorName} загрузил исправления по фотоотчету по задаче «${taskTitle}»${baseInfo}.`;
            try {
                await sendEmail({
                    to: initiatorEmailNormalized,
                    subject,
                    text: `${text}\n\nСсылка: ${initiatorLink}`,
                    html: `<p>${text}</p><p><a href="${initiatorLink}">Перейти к отчету</a></p>`,
                });
            } catch (error) {
                console.error('Failed to send fix upload email to initiator', error);
            }
        }
    }

    return NextResponse.json({
        success: true,
        uploaded: uploadedUrls.length,
        urls: uploadedUrls,
    });
}
