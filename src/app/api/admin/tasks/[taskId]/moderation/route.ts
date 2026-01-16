import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import { GetUserContext } from '@/server-actions/user-context';
import { ensurePublicTaskSlot } from '@/utils/publicTasks';
import { getBillingConfig } from '@/utils/billingConfig';
import { debitOrgWallet, ensureOrgWallet } from '@/utils/orgWallet';
import { notifyTaskPublished } from '@/server/tasks/notifications';
import UserModel from '@/server/models/UserModel';
import { createNotification } from '@/server/notifications/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ModerationStatus = 'approved' | 'rejected';

type ModerationPayload = {
    status?: ModerationStatus;
    comment?: string;
};

const normalizeComment = (value?: string) => (value ?? '').trim().slice(0, 1000);

const isTransactionNotSupported = (error: unknown) => {
    const code = (error as { code?: number })?.code;
    return (
        code === 20 ||
        (error instanceof Error &&
            error.message.includes('Transaction numbers are only allowed'))
    );
};

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { user } = userContext.data;
    const { taskId } = await params;
    const rawTaskId = taskId?.trim();
    if (!rawTaskId) {
        return NextResponse.json({ error: 'Task not specified' }, { status: 400 });
    }

    const body = (await request.json()) as ModerationPayload;
    const status = body.status;
    if (!status || !['approved', 'rejected'].includes(status)) {
        return NextResponse.json({ error: 'Некорректный статус модерации' }, { status: 400 });
    }

    const comment = normalizeComment(body.comment);
    if (status === 'rejected' && !comment) {
        return NextResponse.json(
            { error: 'Укажите комментарий для отказа' },
            { status: 400 }
        );
    }

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'Ошибка подключения к базе' }, { status: 500 });
    }

    const taskQuery = mongoose.Types.ObjectId.isValid(rawTaskId)
        ? { _id: new mongoose.Types.ObjectId(rawTaskId) }
        : { taskId: rawTaskId.toUpperCase() };

    const task = await TaskModel.findOne(taskQuery);
    if (!task) {
        return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
    }

    const updateBase: Record<string, unknown> = {
        publicModerationStatus: status,
        publicModerationComment: status === 'rejected' ? comment : '',
        publicModeratedById: user?._id?.toString(),
        publicModeratedByName: user?.name || user?.email,
        publicModeratedAt: new Date(),
    };

    if (status === 'rejected') {
        const updated = await TaskModel.findByIdAndUpdate(
            task._id,
            {
                $set: {
                    ...updateBase,
                    visibility: 'private',
                    publicStatus: 'closed',
                },
            },
            { new: true }
        );

        if (updated) {
            const authorQuery: Array<{ clerkUserId?: string; email?: string }> = [];
            if (updated.authorId) {
                authorQuery.push({ clerkUserId: updated.authorId });
            }
            if (updated.authorEmail) {
                authorQuery.push({ email: updated.authorEmail.toLowerCase() });
            }
            if (authorQuery.length > 0) {
                const author = await UserModel.findOne({ $or: authorQuery })
                    .select('_id')
                    .lean();
                if (author?._id) {
                    const taskCode = updated.taskId ?? task.taskId;
                    const link = taskCode ? `/tasks/${encodeURIComponent(taskCode)}` : undefined;
                    const taskLabel = updated.taskName ?? task.taskName ?? 'Задача';
                    const bsInfo = updated.bsNumber ?? task.bsNumber;
                    const message = `Модерация задачи «${taskLabel}»${bsInfo ? ` (БС ${bsInfo})` : ''} отклонена.${comment ? ` Причина: ${comment}` : ''}`;
                    await createNotification({
                        recipientUserId: author._id,
                        type: 'task_public_moderation_result',
                        title: 'Публикация отклонена',
                        message,
                        link,
                        orgId: updated.orgId ?? task.orgId ?? undefined,
                        orgSlug: (updated as { orgSlug?: string })?.orgSlug ?? (task as { orgSlug?: string })?.orgSlug,
                        orgName: (updated as { orgName?: string })?.orgName ?? (task as { orgName?: string })?.orgName,
                        metadata: {
                            taskId: updated._id.toString(),
                            taskCode,
                            status: 'rejected',
                        },
                    });
                }
            }
        }

        return NextResponse.json({ ok: true, task: updated });
    }

    let session: mongoose.ClientSession | null = null;
    let saved: typeof task | null = null;
    let limitError: string | undefined;

    const performUpdate = async (currentSession?: mongoose.ClientSession | null) => {
        const freshTaskQuery = TaskModel.findById(task._id);
        if (currentSession) {
            freshTaskQuery.session(currentSession);
        }
        const freshTask = await freshTaskQuery;
        if (!freshTask) {
            throw new Error('TASK_NOT_FOUND');
        }

        const taskUpdate: Record<string, unknown> = {
            ...updateBase,
            visibility: 'public',
        };

        if (!freshTask.publicStatus || freshTask.publicStatus === 'closed') {
            taskUpdate.publicStatus = 'open';
        }

        const targetVisibility =
            (taskUpdate.visibility as string | undefined) ?? freshTask.visibility;
        const targetPublicStatus =
            (taskUpdate.publicStatus as string | undefined) ?? freshTask.publicStatus;

        const isPublishingNow =
            targetVisibility === 'public' &&
            (freshTask.visibility !== 'public' ||
                (freshTask.publicStatus === 'closed' && targetPublicStatus !== 'closed'));

        if (isPublishingNow) {
            if (!freshTask.orgId) {
                limitError = 'Организация не определена для списания';
                throw new Error('INSUFFICIENT_FUNDS');
            }
            const orgObjectId = mongoose.Types.ObjectId.isValid(freshTask.orgId)
                ? new mongoose.Types.ObjectId(freshTask.orgId)
                : null;
            if (!orgObjectId) {
                limitError = 'Организация не определена для списания';
                throw new Error('INSUFFICIENT_FUNDS');
            }
            const billingConfig = await getBillingConfig();
            const publishCost = Number.isFinite(billingConfig.taskPublishCostRub)
                ? billingConfig.taskPublishCostRub
                : 0;

            if (publishCost > 0 && !currentSession) {
                const { wallet } = await ensureOrgWallet(orgObjectId);
                if ((wallet.balance ?? 0) < publishCost) {
                    limitError = `Недостаточно средств для публикации: нужно ${publishCost} ₽`;
                    throw new Error('INSUFFICIENT_FUNDS');
                }
            }

            const check = await ensurePublicTaskSlot(orgObjectId.toString(), {
                consume: true,
                session: currentSession ?? undefined,
            });
            if (!check.ok) {
                limitError = check.reason ?? 'Лимит публичных задач исчерпан';
                throw new Error('LIMIT_REACHED');
            }

            if (publishCost > 0) {
                const debit = await debitOrgWallet({
                    orgId: orgObjectId,
                    amount: publishCost,
                    source: 'publication',
                    meta: {
                        taskId: freshTask._id.toString(),
                        visibility: 'public',
                    },
                    session: currentSession ?? undefined,
                });
                if (!debit.ok) {
                    limitError = `Недостаточно средств для публикации: нужно ${publishCost} ₽`;
                    throw new Error('INSUFFICIENT_FUNDS');
                }
            }
        }

        return TaskModel.findByIdAndUpdate(
            freshTask._id,
            { $set: taskUpdate },
            { new: true, ...(currentSession ? { session: currentSession } : {}) }
        );
    };

    const buildErrorResponse = (error: unknown) => {
        if ((error as Error).message === 'LIMIT_REACHED') {
            return NextResponse.json(
                { error: limitError ?? 'Лимит публичных задач исчерпан' },
                { status: 403 }
            );
        }
        if ((error as Error).message === 'INSUFFICIENT_FUNDS') {
            return NextResponse.json(
                { error: limitError ?? 'Недостаточно средств для публикации задачи' },
                { status: 402 }
            );
        }
        if ((error as Error).message === 'TASK_NOT_FOUND') {
            return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
        }
        console.error('Failed to moderate public task', error);
        return NextResponse.json({ error: 'Не удалось обновить задачу' }, { status: 500 });
    };

    try {
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
            saved = await performUpdate(session);
        });
    } catch (error) {
        const transactionNotSupported = isTransactionNotSupported(error);
        if (!transactionNotSupported) {
            const response = buildErrorResponse(error);
            await session?.endSession();
            return response;
        }

        try {
            saved = await performUpdate(null);
        } catch (fallbackError) {
            const response = buildErrorResponse(fallbackError);
            await session?.endSession();
            return response;
        }
    }

    await session?.endSession();

    const savedTask = saved;
    const becamePublic = task.visibility !== 'public' && savedTask?.visibility === 'public';
    const reopenedFromClosed =
        savedTask?.visibility === 'public' &&
        task.publicStatus === 'closed' &&
        savedTask.publicStatus !== 'closed';

    if (savedTask && (becamePublic || reopenedFromClosed)) {
        try {
            await notifyTaskPublished({
                taskId: savedTask.taskId ?? task.taskId,
                taskName: savedTask.taskName ?? task.taskName ?? 'Задача',
                bsNumber: savedTask.bsNumber ?? task.bsNumber,
                budget: savedTask.budget ?? task.budget,
                currency: savedTask.currency ?? task.currency,
                orgId: savedTask.orgId ?? task.orgId,
                orgSlug: (savedTask as { orgSlug?: string })?.orgSlug ?? (task as { orgSlug?: string })?.orgSlug,
                orgName: (savedTask as { orgName?: string })?.orgName ?? (task as { orgName?: string })?.orgName,
                projectKey: (savedTask as { projectKey?: string })?.projectKey ?? undefined,
                projectName: (savedTask as { projectName?: string })?.projectName ?? undefined,
            });
        } catch (notifyErr) {
            console.error('Failed to notify about task publication', notifyErr);
        }
    }

    if (savedTask) {
        const authorQuery: Array<{ clerkUserId?: string; email?: string }> = [];
        if (savedTask.authorId) {
            authorQuery.push({ clerkUserId: savedTask.authorId });
        }
        if (savedTask.authorEmail) {
            authorQuery.push({ email: savedTask.authorEmail.toLowerCase() });
        }
        if (authorQuery.length > 0) {
            const author = await UserModel.findOne({ $or: authorQuery })
                .select('_id')
                .lean();
            if (author?._id) {
                const taskCode = savedTask.taskId ?? task.taskId;
                const link = taskCode ? `/tasks/${encodeURIComponent(taskCode)}` : undefined;
                const taskLabel = savedTask.taskName ?? task.taskName ?? 'Задача';
                const bsInfo = savedTask.bsNumber ?? task.bsNumber;
                const message = `Модерация задачи «${taskLabel}»${bsInfo ? ` (БС ${bsInfo})` : ''} одобрена.`;
                await createNotification({
                    recipientUserId: author._id,
                    type: 'task_public_moderation_result',
                    title: 'Публикация одобрена',
                    message,
                    link,
                    orgId: savedTask.orgId ?? task.orgId ?? undefined,
                    orgSlug: (savedTask as { orgSlug?: string })?.orgSlug ?? (task as { orgSlug?: string })?.orgSlug,
                    orgName: (savedTask as { orgName?: string })?.orgName ?? (task as { orgName?: string })?.orgName,
                    metadata: {
                        taskId: savedTask._id.toString(),
                        taskCode,
                        status: 'approved',
                    },
                });
            }
        }
    }

    return NextResponse.json({ ok: true, task: savedTask });
}
