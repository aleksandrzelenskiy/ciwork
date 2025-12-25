import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import { currentUser } from '@clerk/nextjs/server';
import { uploadBuffer } from '@/utils/s3';
import { assertWritableStorage, recordStorageBytes } from '@/utils/storageUsage';
import { appendReportFiles, syncTaskStatus, upsertReport } from '@/server-actions/reportService';
import { buildReportKey, extractUploadPayload, prepareImageBuffer, resolveStorageScope } from '@/app/api/reports/_shared';

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

    const actor = { id: user.id, name: buildActorName(user) };
    const report = await upsertReport({
        taskId: payload.taskId,
        baseId: payload.baseId,
        taskName: task.taskName ?? '',
        orgId: String(task.orgId ?? ''),
        projectId: task.projectId ? String(task.projectId) : null,
        initiatorId: task.initiatorId ?? null,
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

    return NextResponse.json({
        success: true,
        uploaded: uploadedUrls.length,
        urls: uploadedUrls,
    });
}
