import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import OrganizationModel from '@/app/models/OrganizationModel';
import ProjectModel from '@/app/models/ProjectModel';

export type UploadPayload = {
    taskId: string;
    baseId: string;
    files: File[];
};

export const normalizeTaskId = (value: string) => value.trim().toUpperCase();

export const extractUploadPayload = async (request: Request): Promise<UploadPayload> => {
    const formData = await request.formData();
    const taskIdRaw = String(formData.get('taskId') ?? '').trim();
    const baseIdRaw = String(formData.get('baseId') ?? '').trim();
    const files = Array.from(formData.values()).filter(
        (value): value is File => value instanceof File
    );
    return {
        taskId: normalizeTaskId(taskIdRaw),
        baseId: baseIdRaw,
        files,
    };
};

export const resolveStorageScope = async (task: {
    orgId?: unknown;
    projectId?: unknown;
}) => {
    const scope: { orgSlug?: string; projectKey?: string } = {};
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

    return scope;
};

export const buildReportKey = (params: {
    orgSlug?: string;
    projectKey?: string;
    taskId: string;
    baseId: string;
    filename: string;
    isFix?: boolean;
}) => {
    const safe = (value?: string) =>
        (value ?? '').replace(/[\\/]/g, '_').replace(/\s+/g, '_').trim();
    const parts = ['uploads'];
    const orgSlug = safe(params.orgSlug);
    const projectKey = safe(params.projectKey);
    if (orgSlug) parts.push(orgSlug);
    if (projectKey) parts.push(projectKey);
    const taskId = safe(params.taskId);
    const baseId = safe(params.baseId);
    const reportFolder = `${taskId}-reports`;
    const filename = safe(params.filename);
    parts.push(taskId, reportFolder, baseId);
    if (params.isFix) {
        parts.push('Fix');
    }
    parts.push(filename);
    return parts.join('/');
};

export const prepareImageBuffer = async (file: File) => {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
    const nameBase = `${uuidv4()}.${ext}`;
    try {
        const converted = await sharp(buffer)
            .rotate()
            .resize(1920, 1920, { fit: sharp.fit.inside, withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toBuffer();
        return { buffer: converted, filename: nameBase, size: converted.length };
    } catch {
        return { buffer, filename: nameBase, size: buffer.length };
    }
};
