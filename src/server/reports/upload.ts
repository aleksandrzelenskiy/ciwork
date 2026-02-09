import 'server-only';

import { currentUser } from '@clerk/nextjs/server';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import { deleteTaskFile, uploadBuffer } from '@/utils/s3';
import { adjustStorageBytes, assertWritableStorage, recordStorageBytes } from '@/utils/storageUsage';
import { appendReportFiles, upsertReport } from '@/server-actions/reportService';
import {
    buildReportKey,
    extractUploadPayload,
    type UploadPayload,
    isSupportedImage,
    parseBsCoordinates,
    validateUploadFiles,
    prepareImageBuffer,
    resolveStorageScope,
} from '@/app/api/reports/_shared';
import { resolvePhotoReportFolderPath } from '@/utils/photoReportFolders';

const buildActorName = (user: Awaited<ReturnType<typeof currentUser>>) => {
    if (!user) return 'Исполнитель';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.username || user.id;
};

export const handleReportUpload = async (
    request: Request,
    user: Awaited<ReturnType<typeof currentUser>>
) => {
    let payload: UploadPayload | null = null;
    const uploadedUrls: string[] = [];
    let totalBytes = 0;
    try {
        if (!user) {
            return { ok: false, error: 'User is not authenticated', status: 401 } as const;
        }

        payload = await extractUploadPayload(request);
        if (!payload.taskId || !payload.baseId) {
            return { ok: false, error: 'taskId and baseId are required', status: 400 } as const;
        }
        if (payload.files.length === 0) {
            return { ok: false, error: 'No files uploaded', status: 400 } as const;
        }
        const invalidFiles = payload.files.filter((file) => !isSupportedImage(file));
        if (invalidFiles.length > 0) {
            return { ok: false, error: 'Unsupported file type', status: 400 } as const;
        }
        const validation = validateUploadFiles(payload.files);
        if (!validation.ok) {
            return { ok: false, error: validation.error, status: validation.status } as const;
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
        const projectDoc = task.projectId
            ? await ProjectModel.findById(task.projectId)
                  .select('photoReportFolders')
                  .lean()
            : null;
        const subpath = resolvePhotoReportFolderPath(
            Array.isArray(projectDoc?.photoReportFolders)
                ? projectDoc.photoReportFolders
                : [],
            payload.folderId
        );
        const baseIdNormalized = payload.baseId.trim().toLowerCase();
        const bsLocationList = Array.isArray(task.bsLocation) ? task.bsLocation : [];
        const matchedLocation =
            bsLocationList.find(
                (loc) =>
                    typeof loc?.name === 'string' &&
                    loc.name.trim().toLowerCase() === baseIdNormalized
            ) ?? (bsLocationList.length === 1 ? bsLocationList[0] : null);
        const bsCoords = matchedLocation?.coordinates
            ? parseBsCoordinates(matchedLocation.coordinates)
            : null;

        for (const file of payload.files) {
            const prepared = await prepareImageBuffer(file, {
                taskId: payload.taskId,
                taskName: task.taskName ?? null,
                baseId: payload.baseId,
                bsNumber: task.bsNumber ?? null,
                bsLat: bsCoords?.lat ?? null,
                bsLon: bsCoords?.lon ?? null,
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
                subpath,
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
    } catch (error) {
        if (uploadedUrls.length > 0) {
            await Promise.allSettled(uploadedUrls.map((url) => deleteTaskFile(url)));
        }
        const rollbackTaskId = payload?.taskId;
        if (rollbackTaskId && totalBytes > 0) {
            const taskRecord = await TaskModel.findOne({ taskId: rollbackTaskId })
                .select('orgId')
                .lean();
            if (taskRecord?.orgId) {
                await adjustStorageBytes(taskRecord.orgId, -Math.abs(totalBytes));
            }
        }
        console.error('Report upload failed', {
            error,
            taskId: payload?.taskId ?? null,
            baseId: payload?.baseId ?? null,
            filesCount: payload?.files.length,
            userId: user?.id,
        });
        return { ok: false, error: 'Failed to upload photos', status: 500 } as const;
    }
};
