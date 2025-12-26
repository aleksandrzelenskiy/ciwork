import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import ReportModel from '@/app/models/ReportModel';
import UserModel from '@/app/models/UserModel';
import { createNotification } from '@/app/utils/notificationService';
import { sendEmail } from '@/utils/mailer';
import { signInitiatorAccessToken } from '@/utils/initiatorAccessToken';
import { currentUser } from '@clerk/nextjs/server';

type SubmitPayload = {
    taskId?: string;
    baseIds?: string[];
};

const getActorName = (user: Awaited<ReturnType<typeof currentUser>>) => {
    if (!user) return 'Исполнитель';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.username || user.id;
};

export async function POST(req: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'User is not authenticated' }, { status: 401 });
    }

    const payload = (await req.json().catch(() => null)) as SubmitPayload | null;

    const taskId = payload?.taskId?.trim().toUpperCase() || '';
    const baseIds = Array.isArray(payload?.baseIds) ? payload!.baseIds!.filter((id) => id.trim()) : [];

    if (!taskId) {
        return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    if (baseIds.length === 0) {
        return NextResponse.json({ error: 'Base IDs are required' }, { status: 400 });
    }

    await dbConnect();

    const task = await TaskModel.findOne({ taskId }).lean();
    if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const reports = await ReportModel.find({
        taskId,
        baseId: { $in: baseIds },
    })
        .select('baseId files')
        .lean();

    const uploadedBases = new Set(
        reports.filter((report) => Array.isArray(report.files) && report.files.length > 0)
            .map((report) => report.baseId)
    );

    const missingBases = baseIds.filter((baseId) => !uploadedBases.has(baseId));
    if (missingBases.length > 0) {
        return NextResponse.json(
            { error: `Нет загруженных фото для БС: ${missingBases.join(', ')}` },
            { status: 400 }
        );
    }

    const actorName = task.executorName?.trim() || getActorName(user);
    const oldStatus = task.status;
    const newStatus = 'Pending';

    await TaskModel.updateOne(
        { taskId },
        {
            $set: { status: newStatus },
            $push: {
                events: {
                    action: 'STATUS_CHANGED',
                    author: actorName,
                    authorId: user.id,
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

    const frontendUrl = process.env.FRONTEND_URL || 'https://ciwork.ru';
    const reportLink = `${frontendUrl}/reports?highlightTaskId=${encodeURIComponent(task.taskId)}`;
    const bsInfo = task.bsNumber ? ` (БС ${task.bsNumber})` : '';
    const reportTitle = task.taskName ? `Фотоотчет по задаче "${task.taskName}"${bsInfo}` : 'Фотоотчет по задаче';
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
        typeof task.initiatorEmail === 'string' ? task.initiatorEmail.trim().toLowerCase() : '';
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
    const metadata = metadataEntries.length > 0 ? Object.fromEntries(metadataEntries) : undefined;

    try {
        for (const recipient of recipientsByClerkId) {
            await createNotification({
                recipientUserId: recipient._id,
                type: 'task_status_change',
                title: reportTitle,
                message: reportMessage,
                link: `/reports?highlightTaskId=${encodeURIComponent(task.taskId.toLowerCase())}`,
                orgId: task.orgId ?? undefined,
                senderName: actorName,
                senderEmail: user.emailAddresses?.[0]?.emailAddress ?? undefined,
                metadata,
            });
        }
    } catch (error) {
        console.error('Failed to create report notifications', error);
    }

    for (const email of directEmails) {
        if (recipientEmails.has(email)) continue;
        try {
            const link = email === initiatorEmailNormalized && initiatorAccessLink
                ? initiatorAccessLink
                : reportLink;
            await sendEmail({
                to: email,
                subject: reportTitle,
                text: [reportMessage, baseListLine, `Ссылка: ${link}`].filter(Boolean).join('\n\n'),
                html: `
<p>${reportMessage}</p>
${baseListLine ? `<p>${baseListLine}</p>` : ''}
<p><a href="${link}">Перейти к фотоотчетам</a></p>`,
            });
        } catch (error) {
            console.error('Failed to send report email', error);
        }
    }

    return NextResponse.json({
        success: true,
        message: 'Фотоотчет отправлен',
    });
}
