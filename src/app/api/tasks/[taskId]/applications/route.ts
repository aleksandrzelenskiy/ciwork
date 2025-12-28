// app/api/tasks/[taskId]/applications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import ApplicationModel from '@/server/models/ApplicationModel';
import { GetUserContext } from '@/server-actions/user-context';
import type { ApplicationStatus } from '@/server/models/ApplicationModel';
import UserModel from '@/server/models/UserModel';
import MembershipModel from '@/server/models/MembershipModel';
import OrganizationModel from '@/server/models/OrganizationModel';
import ProjectModel from '@/server/models/ProjectModel';
import { ensureSeatAvailable } from '@/utils/seats';
import { debitForBid, BID_COST_RUB } from '@/utils/wallet';
import {
    notifyApplicationStatusChanged,
    notifyApplicationSubmitted,
    notifyTaskAssignment,
    notifyTaskUnassignment,
    notifyTaskStatusChange,
} from '@/server/tasks/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANAGER_ROLES = new Set(['owner', 'org_admin', 'manager', 'super_admin']);

const toObjectId = (value: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId =>
    typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;

const isTransactionNotSupportedError = (error: unknown): boolean => {
    const mongoError = error as { code?: number; codeName?: string; message?: string };
    return (
        mongoError?.code === 20 ||
        mongoError?.codeName === 'IllegalOperation' ||
        mongoError?.message?.includes?.(
            'Transaction numbers are only allowed on a replica set member or mongos'
        ) === true
    );
};

type CreateApplicationBody = {
    coverMessage?: string;
    proposedBudget?: number;
    etaDays?: number;
    attachments?: string[];
};

type UpdateApplicationBody = {
    applicationId?: string;
    status?: ApplicationStatus;
};

async function loadTask(taskId: string) {
    if (!mongoose.Types.ObjectId.isValid(taskId)) return null;
    return TaskModel.findById(taskId).lean();
}

async function resolveStorageScope(task: {
    orgId?: unknown;
    projectId?: unknown;
}): Promise<{ orgSlug?: string; projectKey?: string; projectRef?: string }> {
    const scope: { orgSlug?: string; projectKey?: string; projectRef?: string } = {};
    const lookups: Promise<void>[] = [];

    if (task?.orgId) {
        lookups.push(
            OrganizationModel.findById(task.orgId)
                .select('orgSlug')
                .lean()
                .then((org) => {
                    if (org?.orgSlug) scope.orgSlug = org.orgSlug;
                })
                .catch(() => undefined)
        );
    }

    if (task?.projectId) {
        lookups.push(
            ProjectModel.findById(task.projectId)
                .select('key')
                .lean()
                .then((project) => {
                    if (project?.key) scope.projectKey = project.key;
                })
                .catch(() => undefined)
        );
    }

    if (lookups.length) {
        await Promise.all(lookups);
    }

    const projectId = task?.projectId ? String(task.projectId) : undefined;
    scope.projectRef = scope.projectKey ?? projectId;

    return scope;
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
    }

    const task = await loadTask(taskId);
    if (!task) {
        return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
    }

    const context = await GetUserContext();
    if (!context.success || !context.data) {
        return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { user, effectiveOrgRole, isSuperAdmin, memberships } = context.data;
    const orgId = task.orgId?.toString();
    const isMember = orgId ? memberships.some((m) => m.orgId === orgId) : false;
    const canViewAll =
        isSuperAdmin || (isMember && MANAGER_ROLES.has(effectiveOrgRole ?? ''));

    const query: Record<string, unknown> = { taskId: task._id };
    if (!canViewAll) {
        query.contractorId = user._id;
    }

    const applications = await ApplicationModel.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ applications });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    const body = (await request.json()) as CreateApplicationBody;

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
    }

    const context = await GetUserContext();
    if (!context.success || !context.data) {
        return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { user } = context.data;
    if (user.profileType !== 'contractor') {
        return NextResponse.json({ error: 'Отклики доступны только подрядчикам' }, { status: 403 });
    }

    const task = await loadTask(taskId);
    if (!task || task.visibility !== 'public') {
        return NextResponse.json({ error: 'Задача недоступна для откликов' }, { status: 404 });
    }

    const proposedBudget = typeof body.proposedBudget === 'number' ? body.proposedBudget : undefined;
    if (!proposedBudget || proposedBudget <= 0) {
        return NextResponse.json({ error: 'Укажите фиксированную ставку' }, { status: 400 });
    }
    const coverMessage = typeof body.coverMessage === 'string' ? body.coverMessage.trim() : '';

    const existing = await ApplicationModel.findOne({
        taskId: task._id,
        contractorId: user._id,
    }).lean();

    if (existing) {
        return NextResponse.json({ error: 'Вы уже откликались на эту задачу' }, { status: 409 });
    }

    const session = await mongoose.startSession();
    let applicationId: mongoose.Types.ObjectId | null = null;
    let applicationObj: Record<string, unknown> | null = null;
    let insufficientFunds = false;

    const isDuplicateError = (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000;

    type CreationResult =
        | { ok: true }
        | { ok: false; code: 'TASK_NOT_AVAILABLE' | 'INSUFFICIENT_FUNDS' | 'DUPLICATE' | 'UNKNOWN'; error?: unknown };

    const runCreation = async (txnSession?: mongoose.ClientSession): Promise<CreationResult> => {
        const sessionOptions = txnSession ? { session: txnSession } : {};
        let createdAppId: mongoose.Types.ObjectId | undefined;

        const freshTaskQuery = TaskModel.findById(task._id);
        if (txnSession) freshTaskQuery.session(txnSession);
        const freshTask = await freshTaskQuery;
        if (!freshTask || freshTask.visibility !== 'public') {
            return { ok: false, code: 'TASK_NOT_AVAILABLE' };
        }

        try {
            const [newApplication] = await ApplicationModel.create(
                [
                    {
                        taskId: freshTask._id,
                        orgId: freshTask.orgId,
                        contractorId: user._id,
                        contractorEmail: user.email,
                        contractorName: user.name,
                        coverMessage,
                        proposedBudget,
                        etaDays: body.etaDays,
                        attachments: Array.isArray(body.attachments) ? body.attachments : [],
                        status: 'submitted',
                    },
                ],
                sessionOptions
            );
            createdAppId = newApplication._id as mongoose.Types.ObjectId;
            if (!createdAppId) {
                return { ok: false, code: 'UNKNOWN' };
            }

            const debit = await debitForBid({
                contractorId: toObjectId(user._id),
                taskId: toObjectId(freshTask._id),
                applicationId: toObjectId(createdAppId),
                session: txnSession,
            });

            if (!debit.ok) {
                insufficientFunds = true;
                return { ok: false, code: 'INSUFFICIENT_FUNDS' };
            }

            await TaskModel.updateOne(
                { _id: freshTask._id },
                { $inc: { applicationCount: 1 } },
                sessionOptions
            );

            applicationId = createdAppId;
            applicationObj = newApplication.toObject() as unknown as Record<string, unknown>;
            return { ok: true };
        } catch (error) {
            if (!txnSession && createdAppId) {
                try {
                    await ApplicationModel.deleteOne({ _id: createdAppId });
                } catch (cleanupErr) {
                    console.error('Failed to rollback application after error', cleanupErr);
                }
            }

            if (isDuplicateError(error)) {
                return { ok: false, code: 'DUPLICATE', error };
            }

            return { ok: false, code: 'UNKNOWN', error };
        }
    };

    let creationResult: CreationResult | null = null;
    try {
        try {
            await session.withTransaction(async () => {
                creationResult = await runCreation(session);
                if (!creationResult?.ok) {
                    await session.abortTransaction();
                }
            });
        } catch (error) {
            if (isTransactionNotSupportedError(error)) {
                console.warn(
                    'Transactions unsupported by MongoDB, running application creation without a transaction'
                );
                creationResult = await runCreation();
            } else {
                const isCreationOk = (creationResult as CreationResult | null)?.ok;
                if (!creationResult || isCreationOk) {
                    creationResult = { ok: false, code: 'UNKNOWN', error };
                }
            }
        }
    } finally {
        await session.endSession();
    }

    if (!creationResult?.ok) {
        if (creationResult?.code === 'TASK_NOT_AVAILABLE') {
            return NextResponse.json({ error: 'Задача недоступна для откликов' }, { status: 404 });
        }
        if (creationResult?.code === 'INSUFFICIENT_FUNDS' || insufficientFunds) {
            return NextResponse.json(
                { error: `Недостаточно средств. На отклик требуется ${BID_COST_RUB} ₽` },
                { status: 402 }
            );
        }
        if (creationResult?.code === 'DUPLICATE') {
            return NextResponse.json({ error: 'Вы уже откликались на эту задачу' }, { status: 409 });
        }
        console.error('Failed to create application', creationResult?.error);
        return NextResponse.json({ error: 'Не удалось отправить отклик' }, { status: 500 });
    }

    if (!applicationId || !applicationObj) {
        return NextResponse.json({ error: 'Не удалось отправить отклик' }, { status: 500 });
    }

    const createdApplication = applicationObj;

    try {
        const managerClerkIds = [task.authorId]
            .map((v) => (typeof v === 'string' ? v.trim() : ''))
            .filter((v) => v.length > 0);

        const storageScope = await resolveStorageScope(task);

        await notifyApplicationSubmitted({
            taskId: task.taskId,
            taskName: task.taskName ?? 'Задача',
            bsNumber: task.bsNumber,
            applicationId,
            contractor: { _id: user._id, name: user.name, email: user.email },
            proposedBudget,
            orgId: task.orgId,
            orgSlug: storageScope.orgSlug,
            orgName: (task as { orgName?: string })?.orgName,
            managerClerkIds,
            projectRef: storageScope.projectRef,
            projectKey: storageScope.projectKey,
            projectName: undefined,
            triggeredByName: user.name,
            triggeredByEmail: user.email,
        });
    } catch (notifyErr) {
        console.error('Failed to notify about application submission', notifyErr);
    }

    return NextResponse.json({ ok: true, application: createdApplication }, { status: 201 });
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    const body = (await request.json()) as UpdateApplicationBody;

    if (!body.applicationId || !mongoose.Types.ObjectId.isValid(body.applicationId)) {
        return NextResponse.json({ error: 'Некорректный идентификатор отклика' }, { status: 400 });
    }

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
    }

    const context = await GetUserContext();
    if (!context.success || !context.data) {
        return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { user, effectiveOrgRole, isSuperAdmin, memberships } = context.data;

    const task = await loadTask(taskId);
    if (!task) {
        return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
    }

    const app = await ApplicationModel.findById(body.applicationId);
    if (!app || app.taskId.toString() !== task._id.toString()) {
        return NextResponse.json({ error: 'Отклик не найден' }, { status: 404 });
    }

    const previousStatus = app.status;
    const previousTaskStatus = task.status;
    const previousExecutorId =
        typeof task.executorId === 'string' ? task.executorId : '';
    const contractor = await UserModel.findById(app.contractorId).lean();
    const actorClerkId = user.clerkUserId;
    const actorName = user.name;
    const actorEmail = user.email;
    let updatedTask: typeof task | null = null;
    const orgId = task.orgId?.toString();
    const isMember = orgId ? memberships.some((m) => m.orgId === orgId) : false;
    const canManage =
        isSuperAdmin || (isMember && MANAGER_ROLES.has(effectiveOrgRole ?? ''));

    const isOwnerOfApplication = app.contractorId.toString() === user._id.toString();

    // Правила обновления статуса
    if (isOwnerOfApplication && body.status === 'withdrawn') {
        app.status = 'withdrawn';
    } else if (canManage && body.status) {
        app.status = body.status;
        if (body.status === 'accepted') {
            if (!contractor) {
                return NextResponse.json({ error: 'Подрядчик не найден' }, { status: 404 });
            }

            if (task.orgId && contractor.email) {
                const email = contractor.email.toLowerCase();
                const membership = await MembershipModel.findOne({
                    orgId: task.orgId,
                    userEmail: email,
                });

                if (!membership || membership.status !== 'active') {
                    const seat = await ensureSeatAvailable(task.orgId.toString());
                    if (!seat.ok) {
                        return NextResponse.json(
                            { error: `Достигнут лимит рабочих мест: ${seat.used}/${seat.limit}` },
                            { status: 402 }
                        );
                    }

                    if (membership) {
                        membership.status = 'active';
                        membership.role = membership.role || 'executor';
                        if (!membership.userName && contractor.name) {
                            membership.userName = contractor.name;
                        }
                        await membership.save();
                    } else {
                        await MembershipModel.create({
                            orgId: task.orgId,
                            userEmail: email,
                            userName: contractor.name || email,
                            role: 'executor',
                            status: 'active',
                        });
                    }
                }
            }

            const update: Record<string, unknown> = {
                publicStatus: 'assigned',
                acceptedApplicationId: app._id.toString(),
                contractorPayment: app.proposedBudget,
            };

            if (contractor.clerkUserId) {
                update.executorId = contractor.clerkUserId;
            }
            if (contractor.name) {
                update.executorName = contractor.name;
            }
            if (contractor.email) {
                update.executorEmail = contractor.email;
            }

            if (!task.status || task.status === 'To do') {
                update.status = 'Assigned';
            }

            updatedTask = await TaskModel.findByIdAndUpdate(
                task._id,
                {
                    $set: update,
                },
                { new: true, lean: true }
            );
        } else if (
            previousStatus === 'accepted' &&
            (!task.acceptedApplicationId || task.acceptedApplicationId === app._id.toString())
        ) {
            const setUpdate: Record<string, unknown> = {
                executorId: '',
                executorName: '',
                executorEmail: '',
            };

            if (task.status && task.status !== 'To do') {
                setUpdate.status = 'To do';
            }
            if (task.publicStatus === 'assigned') {
                setUpdate.publicStatus = 'open';
            }

            const unsetUpdate: Record<string, string> = { acceptedApplicationId: '' };

            updatedTask = await TaskModel.findByIdAndUpdate(
                task._id,
                {
                    $set: setUpdate,
                    ...(Object.keys(unsetUpdate).length > 0 ? { $unset: unsetUpdate } : {}),
                },
                { new: true, lean: true }
            );
        }
    } else {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    await app.save();
    const finalTask =
        updatedTask ??
        (await TaskModel.findById(task._id).lean()) ??
        task;
    const storageScope = await resolveStorageScope(finalTask ?? task);

    if (contractor && previousStatus !== app.status) {
        try {
            await notifyApplicationStatusChanged({
                contractor: {
                    _id: contractor._id,
                    name: contractor.name,
                    email: contractor.email,
                },
                status: app.status,
                previousStatus,
                taskId: finalTask.taskId,
                taskName: finalTask.taskName ?? task.taskName ?? 'Задача',
                bsNumber: finalTask.bsNumber,
                orgId: finalTask.orgId ?? task.orgId,
                orgSlug: storageScope.orgSlug,
                orgName: (finalTask as { orgName?: string })?.orgName,
                projectRef: storageScope.projectRef,
                projectKey: storageScope.projectKey,
                projectName: undefined,
                triggeredByName: actorName,
                triggeredByEmail: actorEmail,
            });
        } catch (notifyErr) {
            console.error('Failed to notify contractor about application status', notifyErr);
        }
    }

    if (app.status === 'accepted' && contractor?.clerkUserId) {
        try {
            await notifyTaskAssignment({
                executorClerkId: contractor.clerkUserId,
                taskId: finalTask.taskId,
                taskName: finalTask.taskName ?? task.taskName ?? 'Задача',
                bsNumber: finalTask.bsNumber,
                orgId: finalTask.orgId ?? task.orgId,
                orgSlug: storageScope.orgSlug,
                orgName: (finalTask as { orgName?: string })?.orgName,
                projectRef: storageScope.projectRef,
                projectKey: storageScope.projectKey,
                projectName: undefined,
                triggeredByName: actorName,
                triggeredByEmail: actorEmail,
            });
        } catch (notifyErr) {
            console.error('Failed to notify executor assignment from application', notifyErr);
        }
    }

    if (previousStatus === 'accepted' && app.status !== 'accepted' && previousExecutorId) {
        try {
            await notifyTaskUnassignment({
                executorClerkId: previousExecutorId,
                taskId: finalTask.taskId,
                taskName: finalTask.taskName ?? task.taskName ?? 'Задача',
                bsNumber: finalTask.bsNumber,
                orgId: finalTask.orgId ?? task.orgId,
                orgSlug: storageScope.orgSlug,
                orgName: (finalTask as { orgName?: string })?.orgName,
                projectRef: storageScope.projectRef,
                projectKey: storageScope.projectKey,
                projectName: undefined,
                triggeredByName: actorName,
                triggeredByEmail: actorEmail,
            });
        } catch (notifyErr) {
            console.error('Failed to notify executor unassignment from application', notifyErr);
        }
    }

    if (typeof finalTask.status === 'string' && previousTaskStatus !== finalTask.status) {
        try {
            await notifyTaskStatusChange({
                taskId: finalTask.taskId,
                taskName: finalTask.taskName ?? task.taskName ?? 'Задача',
                bsNumber: finalTask.bsNumber,
                previousStatus: previousTaskStatus,
                newStatus: finalTask.status,
                authorClerkId: typeof finalTask.authorId === 'string' ? finalTask.authorId : undefined,
                executorClerkId: typeof finalTask.executorId === 'string' ? finalTask.executorId : undefined,
                triggeredByClerkId: actorClerkId,
                triggeredByName: actorName,
                triggeredByEmail: actorEmail,
                orgId: finalTask.orgId ?? task.orgId,
                orgSlug: storageScope.orgSlug,
                orgName: (finalTask as { orgName?: string })?.orgName,
                projectRef: storageScope.projectRef,
                projectKey: storageScope.projectKey,
                projectName: undefined,
            });
        } catch (notifyErr) {
            console.error('Failed to notify participants about task status change', notifyErr);
        }
    }

    return NextResponse.json({ ok: true, application: app.toObject() });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    const { searchParams } = new URL(request.url);
    let applicationId = searchParams.get('applicationId');

    if (!applicationId) {
        try {
            const body = (await request.json()) as { applicationId?: string };
            applicationId = body?.applicationId ?? null;
        } catch {
            applicationId = null;
        }
    }

    if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
        return NextResponse.json({ error: 'Некорректный идентификатор отклика' }, { status: 400 });
    }

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
    }

    const context = await GetUserContext();
    if (!context.success || !context.data) {
        return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { user } = context.data;
    const task = await loadTask(taskId);
    if (!task) {
        return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
    }

    const app = await ApplicationModel.findById(applicationId);
    if (!app || app.taskId.toString() !== task._id.toString()) {
        return NextResponse.json({ error: 'Отклик не найден' }, { status: 404 });
    }

    const isOwner = app.contractorId.toString() === user._id.toString();
    if (!isOwner) {
        return NextResponse.json({ error: 'Недостаточно прав для удаления' }, { status: 403 });
    }

    if (app.status === 'accepted') {
        return NextResponse.json(
            { error: 'Принятый отклик нельзя удалить. Попросите менеджера переназначить задачу' },
            { status: 409 }
        );
    }

    try {
        await app.deleteOne();
        await TaskModel.findByIdAndUpdate(task._id, [
            {
                $set: {
                    applicationCount: {
                        $max: [
                            {
                                $subtract: [{ $ifNull: ['$applicationCount', 0] }, 1],
                            },
                            0,
                        ],
                    },
                },
            },
        ]);
    } catch (error) {
        console.error('Failed to delete application', error);
        return NextResponse.json({ error: 'Не удалось удалить отклик' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
