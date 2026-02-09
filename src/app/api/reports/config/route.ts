import { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import ReportModel from '@/server/models/ReportModel';
import { jsonData, jsonError } from '@/server/http/response';
import { buildFolderPathMap, normalizePhotoReportFolders } from '@/utils/photoReportFolders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const normalizeProjectRef = (value: unknown): string => {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object' && value && 'toString' in value) {
        const str = String(value);
        return str.trim();
    }
    return '';
};

const findProjectByRef = async (projectRef: string) => {
    if (!projectRef) return null;
    if (Types.ObjectId.isValid(projectRef)) {
        const byId = await ProjectModel.findById(projectRef)
            .select('photoReportFolders')
            .lean();
        if (byId) return byId;
    }
    return ProjectModel.findOne({ key: projectRef.toUpperCase() })
        .select('photoReportFolders')
        .lean();
};

export async function GET(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return jsonError('User is not authenticated', 401);
    }

    await dbConnect();

    const taskIdRaw = request.nextUrl.searchParams.get('taskId') ?? '';
    const taskId = taskIdRaw.trim().toUpperCase();
    if (!taskId) {
        return jsonError('taskId is required', 400);
    }

    const task = await TaskModel.findOne({ taskId })
        .select('projectId projectKey')
        .lean();
    if (!task) {
        return jsonError('Task not found', 404);
    }

    const taskProjectRef = normalizeProjectRef(task.projectId);
    const taskProjectKey = normalizeProjectRef((task as { projectKey?: unknown }).projectKey);
    let project =
        (await findProjectByRef(taskProjectRef)) ||
        (await findProjectByRef(taskProjectKey));

    if (!project) {
        const report = await ReportModel.findOne({ taskId }).select('projectId').lean();
        const reportProjectRef = normalizeProjectRef(report?.projectId);
        project = await findProjectByRef(reportProjectRef);
    }

    if (!project) {
        return jsonData({ folders: [], folderPaths: [] });
    }

    const normalized = normalizePhotoReportFolders(project?.photoReportFolders ?? []);
    if (!normalized.ok) {
        return jsonData({ folders: [], folderPaths: [] });
    }

    return jsonData({
        folders: normalized.nodes,
        folderPaths: buildFolderPathMap(normalized.nodes),
    });
}
