// app/api/tasks/[taskId]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import UserModel from '@/server/models/UserModel';
import { GetUserContext } from '@/server-actions/user-context';
import { ensurePublicTaskSlot } from '@/utils/publicTasks';
import { getBillingConfig } from '@/utils/billingConfig';
import { debitOrgWallet, ensureOrgWallet } from '@/utils/orgWallet';
import { notifyTaskPublished } from '@/server/tasks/notifications';
import { createNotification } from '@/server/notifications/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANAGER_ROLES = new Set(['owner', 'org_admin', 'manager', 'super_admin']);

type Payload = {
    visibility?: 'private' | 'public';
    publicStatus?: 'open' | 'in_review' | 'assigned' | 'closed';
    budget?: number | null;
    publicDescription?: string | null;
    currency?: string;
    allowInstantClaim?: boolean;
};

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    if (!taskId) {
        return NextResponse.json({ error: 'Некорректный идентификатор задачи' }, { status: 400 });
    }

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'Ошибка подключения к базе' }, { status: 500 });
    }

    const context = await GetUserContext();
    if (!context.success || !context.data) {
        return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { effectiveOrgRole, isSuperAdmin, memberships, user } = context.data;
    const payload = (await request.json()) as Payload;

    const taskQuery = mongoose.Types.ObjectId.isValid(taskId)
        ? { _id: new mongoose.Types.ObjectId(taskId) }
        : { taskId: taskId.toUpperCase() };

    const task = await TaskModel.findOne(taskQuery);
    if (!task) {
        return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
    }
    const wasPublic = task.visibility === 'public';
    const previousPublicStatus = task.publicStatus;
    const authorEmail = task.authorEmail?.toLowerCase();
    const toProjectRef = (projectRef?: mongoose.Types.ObjectId | string | null) => {
        if (!projectRef) return undefined;
        return typeof projectRef === 'string' ? projectRef : projectRef.toString();
    };

    const buildOrgTaskLink = (source: {
        orgSlug?: string;
        projectKey?: string;
        projectId?: mongoose.Types.ObjectId | string | null;
        taskId?: string;
    }) => {
        if (!source.taskId) return undefined;
        const taskSlug = source.taskId.toLowerCase();
        const projectRef = source.projectKey ?? toProjectRef(source.projectId);
        if (source.orgSlug && projectRef) {
            return `/org/${encodeURIComponent(source.orgSlug)}/projects/${encodeURIComponent(
                projectRef
            )}/tasks/${encodeURIComponent(taskSlug)}`;
        }
        return `/tasks/${encodeURIComponent(taskSlug)}`;
    };

    const authorQuery: Array<{ clerkUserId?: string; email?: string }> = [];
    if (task.authorId) {
        authorQuery.push({ clerkUserId: task.authorId });
    }
    if (authorEmail) {
        authorQuery.push({ email: authorEmail });
    }
    const authorIsSuperAdmin =
        authorQuery.length > 0
            ? await UserModel.findOne({
                platformRole: 'super_admin',
                $or: authorQuery,
            })
                  .select('_id')
                  .lean()
            : null;
    const bypassModeration = isSuperAdmin || Boolean(authorIsSuperAdmin);

    const orgId = task.orgId?.toString();
    const isMember = orgId
        ? memberships?.some((m) => m.orgId === orgId)
        : false;
    const canManage =
        isSuperAdmin ||
        (MANAGER_ROLES.has(effectiveOrgRole ?? '') && isMember);

    if (!canManage) {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    const update: Record<string, unknown> = {};

    if ('budget' in payload) {
        if (typeof payload.budget === 'number' && payload.budget >= 0) {
            update.budget = payload.budget;
        } else if (payload.budget === null) {
            update.budget = null;
        }
    }
    if (typeof payload.publicDescription === 'string') {
        update.publicDescription = payload.publicDescription.trim();
    }
    if (payload.currency) {
        update.currency = payload.currency;
    }
    if (typeof payload.allowInstantClaim === 'boolean') {
        update.allowInstantClaim = payload.allowInstantClaim;
    }
    if (payload.publicStatus) {
        update.publicStatus = payload.publicStatus;
    }

    const isTransactionNotSupported = (error: unknown) => {
        const code = (error as { code?: number })?.code;
        return (
            code === 20 ||
            (error instanceof Error &&
                error.message.includes('Transaction numbers are only allowed'))
        );
    };

    const buildErrorResponse = (error: unknown, limitError?: string) => {
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
        console.error('Failed to update publish state', error);
        return NextResponse.json({ error: 'Не удалось обновить задачу' }, { status: 500 });
    };

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

        const taskUpdate: Record<string, unknown> = { ...update };

        const wantsPublic = payload.visibility === 'public';
        const shouldRequestModeration =
            wantsPublic &&
            !bypassModeration &&
            freshTask.visibility !== 'public';

        if (shouldRequestModeration) {
            taskUpdate.visibility = 'private';
            taskUpdate.publicStatus = 'closed';
            taskUpdate.publicModerationStatus = 'pending';
            taskUpdate.publicModerationComment = '';
            taskUpdate.publicModeratedById = null;
            taskUpdate.publicModeratedByName = null;
            taskUpdate.publicModeratedAt = null;
        } else if (wantsPublic) {
            if (freshTask.visibility !== 'public') {
                taskUpdate.visibility = 'public';
                if (!taskUpdate.publicStatus) {
                    taskUpdate.publicStatus = 'open';
                }
            }
            if (bypassModeration) {
                taskUpdate.publicModerationStatus = 'approved';
                taskUpdate.publicModerationComment = '';
                taskUpdate.publicModeratedById = user?._id?.toString();
                taskUpdate.publicModeratedByName = user?.name || user?.email;
                taskUpdate.publicModeratedAt = new Date();
            }
        } else if (payload.visibility === 'private') {
            taskUpdate.visibility = 'private';
            taskUpdate.publicStatus = 'closed';
        }

        const targetVisibility = (taskUpdate.visibility as string | undefined) ?? freshTask.visibility;
        const targetPublicStatus = (taskUpdate.publicStatus as string | undefined) ?? freshTask.publicStatus;

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

    try {
        session = await mongoose.startSession();
        await session.withTransaction(async () => {
            saved = await performUpdate(session);
        });
    } catch (error) {
        const transactionNotSupported = isTransactionNotSupported(error);
        if (!transactionNotSupported) {
            const response = buildErrorResponse(error, limitError);
            await session?.endSession();
            return response;
        }

        try {
            saved = await performUpdate(null);
        } catch (fallbackError) {
            const response = buildErrorResponse(fallbackError, limitError);
            await session?.endSession();
            return response;
        }
    }

    await session?.endSession();

    const savedTask = saved;
    const taskMetadataSource = {
        orgSlug: (savedTask as { orgSlug?: string } | null | undefined)?.orgSlug ?? task.orgSlug,
        projectKey: (savedTask as { projectKey?: string } | null | undefined)?.projectKey ?? task.projectKey,
        projectId: (savedTask as { projectId?: mongoose.Types.ObjectId | string | null } | null | undefined)?.projectId ??
            task.projectId,
        taskId: (savedTask as { taskId?: string } | null | undefined)?.taskId ?? task.taskId,
    };

    const becamePublic = !wasPublic && savedTask?.visibility === 'public';
    const reopenedFromClosed =
        savedTask?.visibility === 'public' &&
        previousPublicStatus === 'closed' &&
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

    const moderationRequested =
        payload.visibility === 'public' &&
        savedTask?.visibility !== 'public' &&
        savedTask?.publicModerationStatus === 'pending';

    if (moderationRequested) {
        const superAdmins = await UserModel.find({ platformRole: 'super_admin' })
            .select('_id')
            .lean();
        const taskLabel = savedTask?.taskName ?? task.taskName ?? 'Задача';
        const bsInfo = savedTask?.bsNumber ?? task.bsNumber;
        const message = `Запрошена модерация публичной задачи: ${taskLabel}${bsInfo ? ` (БС ${bsInfo})` : ''}.`;
        const link = `/admin?tab=tasks`;

        await Promise.all(
            superAdmins.map((admin) =>
                createNotification({
                    recipientUserId: admin._id,
                    type: 'task_public_moderation_requested',
                    title: 'Новая задача на модерацию',
                    message,
                    link,
                    orgId: savedTask?.orgId ?? task.orgId ?? undefined,
                    orgSlug: (savedTask as { orgSlug?: string })?.orgSlug ?? (task as { orgSlug?: string })?.orgSlug,
                    orgName: (savedTask as { orgName?: string })?.orgName ?? (task as { orgName?: string })?.orgName,
                    metadata: {
                        taskId: savedTask?._id?.toString() ?? task._id?.toString(),
                        taskCode: savedTask?.taskId ?? task.taskId,
                    },
                })
            )
        );

        if (authorQuery.length > 0) {
            const author = await UserModel.findOne({ $or: authorQuery })
                .select('_id')
                .lean();
            if (author?._id) {
                const authorLink = buildOrgTaskLink({
                    ...taskMetadataSource,
                    taskId: savedTask?.taskId ?? task.taskId,
                });
                await createNotification({
                    recipientUserId: author._id,
                    type: 'task_public_moderation_requested',
                    title: 'Задача отправлена на модерацию',
                    message: `Задача «${taskLabel}» отправлена на модерацию.`,
                    link: authorLink,
                    orgId: savedTask?.orgId ?? task.orgId ?? undefined,
                    orgSlug: (savedTask as { orgSlug?: string })?.orgSlug ?? (task as { orgSlug?: string })?.orgSlug,
                    orgName: (savedTask as { orgName?: string })?.orgName ?? (task as { orgName?: string })?.orgName,
                    metadata: {
                        taskId: savedTask?._id?.toString() ?? task._id?.toString(),
                        taskCode: savedTask?.taskId ?? task.taskId,
                    },
                });
            }
        }
    }

    return NextResponse.json({ ok: true, task: savedTask });
}
