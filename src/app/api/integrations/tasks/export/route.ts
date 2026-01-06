import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import { requireIntegrationKey } from '@/server/integrations/auth';
import { buildTaskSyncPayload } from '@/server/integrations/taskPayload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseLimit(value: string | null): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 500;
    return Math.min(Math.max(Math.floor(parsed), 1), 1000);
}

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const auth = await requireIntegrationKey(req.headers, ['tasks:read'] as const);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { key } = auth;
        const { searchParams } = new URL(req.url);
        const limit = parseLimit(searchParams.get('limit'));
        const cursorRaw = searchParams.get('cursor');

        const query: Record<string, unknown> = {
            orgId: key.orgId,
        };
        if (key.projectId) {
            query.projectId = key.projectId;
        }

        if (cursorRaw && Types.ObjectId.isValid(cursorRaw)) {
            query._id = { $gt: new Types.ObjectId(cursorRaw) };
        }

        const tasks = await TaskModel.find(query).sort({ _id: 1 }).limit(limit).lean();
        const items = tasks.map((task) => buildTaskSyncPayload(task));

        const nextCursor =
            tasks.length === limit ? tasks[tasks.length - 1]?._id?.toString() ?? null : null;

        return NextResponse.json(
            {
                items,
                nextCursor,
            },
            { headers: { 'cache-control': 'no-store' } }
        );
    } catch (error) {
        console.error('Failed to export tasks:', error);
        return NextResponse.json({ error: 'Failed to export tasks' }, { status: 500 });
    }
}
