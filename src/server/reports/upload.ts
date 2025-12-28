import 'server-only';

import { currentUser } from '@clerk/nextjs/server';
import TaskModel from '@/server/models/TaskModel';
import { uploadBuffer } from '@/utils/s3';
import { assertWritableStorage, recordStorageBytes } from '@/utils/storageUsage';
import { appendReportFiles, upsertReport } from '@/server-actions/reportService';
import {
    buildReportKey,
    extractUploadPayload,
    prepareImageBuffer,
    resolveStorageScope,
} from '@/app/api/reports/_shared';

const buildActorName = (user: Awaited<ReturnType<typeof currentUser>>) => {
    if (!user) return 'Исполнитель';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.username || user.id;
};

export const handleReportUpload = async (
    request: Request,
    user: Awaited<ReturnType<typeof currentUser>>
) => {
    if (!user) {
        return { ok: false, error: 'User is not authenticated', status: 401 } as const;
    }

    const payload = await extractUploadPayload(request);
    if (!payload.taskId || !payload.baseId) {
        return { ok: false, error: 'taskId and baseId are required', status: 400 } as const;
    }
    if (payload.files.length === 0) {
        return { ok: false, error: 'No files uploaded', status: 400 } as const;
    }
    const invalidFiles = payload.files.filter((file) => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
        return { ok: false, error: 'Unsupported file type', status: 400 } as const;
    }

    const task = await TaskModel.findOne({ taskId: payload.taskId }).lean();
    if (!task) {
        return { ok: false, error: 'Task not found', status: 404 } as const;
    }

    if (!task.orgId) {
        return { ok: false, error: 'Task organization is missing', status: 400 } as const;
    }

    const storageCheck = await assertWritableStorage(task.orgId);
    if (!storageCheck.ok) {
        return {
            ok: false,
            error: storageCheck.error,
            status: 402,
            data: {
                readOnly: true,
                storage: storageCheck.access,
            },
        } as const;
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
        });
        const url = await uploadBuffer(
            prepared.buffer,
            key,
            prepared.contentType || 'image/jpeg'
        );
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
        initiatorName: task.initiatorName ?? null,
        actor,
    });

    await appendReportFiles({
        report,
        files: uploadedUrls,
        bytesAdded: totalBytes,
        actor,
        kind: 'main',
    });

    return {
        ok: true,
        data: {
            success: true,
            uploaded: uploadedUrls.length,
            urls: uploadedUrls,
        },
    } as const;
};
