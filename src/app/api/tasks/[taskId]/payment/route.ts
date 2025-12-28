// app/api/tasks/[taskId]/payment/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import { GetUserContext } from '@/server-actions/user-context';
import { isExecutorRole, isManagerRole } from '@/app/utils/roleGuards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PaymentActionPayload {
    action?: 'mark_paid' | 'confirm_paid';
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ taskId: string }> }
) {
    try {
        await dbConnect();
        const { taskId } = await context.params;
        if (!taskId) {
            return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });
        }

        const body = (await request.json().catch(() => ({}))) as PaymentActionPayload;
        if (body.action !== 'mark_paid' && body.action !== 'confirm_paid') {
            return NextResponse.json({ error: 'Invalid payment action' }, { status: 400 });
        }

        const userContext = await GetUserContext();
        if (!userContext.success || !userContext.data) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const { user, effectiveOrgRole, activeOrgId, isSuperAdmin } = userContext.data;
        const taskIdUpper = taskId.toUpperCase();
        const task = await TaskModel.findOne({ taskId: taskIdUpper });

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        if (body.action === 'mark_paid') {
            if (!isManagerRole(effectiveOrgRole)) {
                return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
            }

            if (!isSuperAdmin) {
                const taskOrgId = task.orgId?.toString?.() ?? '';
                if (!activeOrgId || taskOrgId !== activeOrgId) {
                    return NextResponse.json({ error: 'Task org mismatch' }, { status: 403 });
                }
            }

            task.payment = {
                ...(task.payment || {}),
                orgMarkedPaidAt: new Date(),
                orgMarkedPaidBy: user.clerkUserId,
            };
        }

        if (body.action === 'confirm_paid') {
            if (!isExecutorRole(effectiveOrgRole)) {
                return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
            }

            if (task.executorId !== user.clerkUserId) {
                return NextResponse.json({ error: 'Executor mismatch' }, { status: 403 });
            }

            if (!task.payment?.orgMarkedPaidAt) {
                return NextResponse.json(
                    { error: 'Payment must be marked by organization first' },
                    { status: 400 }
                );
            }

            task.payment = {
                ...(task.payment || {}),
                contractorConfirmedAt: new Date(),
                contractorConfirmedBy: user.clerkUserId,
            };
        }

        await task.save();

        return NextResponse.json({
            taskId: task.taskId,
            payment: task.payment || null,
        });
    } catch (error) {
        console.error('Payment update error:', error);
        return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
    }
}
