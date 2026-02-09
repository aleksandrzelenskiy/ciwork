import { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import { jsonData, jsonError } from '@/server/http/response';
import { buildFolderPathMap, normalizePhotoReportFolders } from '@/utils/photoReportFolders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    const task = await TaskModel.findOne({ taskId }).select('projectId').lean();
    if (!task) {
        return jsonError('Task not found', 404);
    }
    if (!task.projectId) {
        return jsonData({ folders: [], folderPaths: [] });
    }

    const project = await ProjectModel.findById(task.projectId)
        .select('photoReportFolders')
        .lean();
    const normalized = normalizePhotoReportFolders(project?.photoReportFolders ?? []);
    if (!normalized.ok) {
        return jsonData({ folders: [], folderPaths: [] });
    }

    return jsonData({
        folders: normalized.nodes,
        folderPaths: buildFolderPathMap(normalized.nodes),
    });
}
