import 'server-only';

import mongoose from 'mongoose';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import { GetUserContext } from '@/server-actions/user-context';
import ReportModel from '@/server/models/ReportModel';
import { splitAttachmentsAndDocuments } from '@/utils/taskFiles';
import { normalizeRelatedTasks } from '@/app/utils/relatedTasks';

interface Location {
    coordinates: [number, number];
}

export const listTasksForCurrentUser = async () => {
    const userContext = await GetUserContext();

    if (!userContext.success || !userContext.data) {
        return { ok: false, error: 'Failed to fetch user data' } as const;
    }

    const { user, effectiveOrgRole, isSuperAdmin, activeOrgId } =
        userContext.data;
    const clerkUserId = user.clerkUserId;
    const userEmail = user.email?.toLowerCase();

    const matchStage: Record<string, unknown> = {};

    if (isSuperAdmin) {
        // полный доступ, без ограничений
    } else if (effectiveOrgRole === 'executor') {
        matchStage.executorId = clerkUserId;
    } else {
        if (!activeOrgId || !effectiveOrgRole) {
            return { ok: true, tasks: [] } as const;
        }

        let orgObjectId: mongoose.Types.ObjectId;
        try {
            orgObjectId = new mongoose.Types.ObjectId(activeOrgId);
        } catch (error) {
            console.error('Invalid activeOrgId provided', error);
            return { ok: true, tasks: [] } as const;
        }

        matchStage.orgId = orgObjectId;

        switch (effectiveOrgRole) {
            case 'owner':
            case 'org_admin':
                break;
            case 'manager': {
                if (!userEmail) {
                    return { ok: true, tasks: [] } as const;
                }

                const projectDocs = await ProjectModel.find({
                    orgId: orgObjectId,
                    managers: userEmail,
                })
                    .select('_id')
                    .lean();

                if (projectDocs.length === 0) {
                    return { ok: true, tasks: [] } as const;
                }

                matchStage.projectId = {
                    $in: projectDocs.map((p) => p._id),
                };
                break;
            }
            default:
                return { ok: true, tasks: [] } as const;
        }
    }

    const tasks = await TaskModel.aggregate([
        {
            $match: matchStage,
        },
        {
            $addFields: {
                bsNumbers: {
                    $split: ['$bsNumber', '-'],
                },
            },
        },
        {
            $lookup: {
                from: 'objects-t2-ir',
                let: { bsNumbers: '$bsNumbers' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $in: ['$name', '$$bsNumbers'],
                            },
                        },
                    },
                ],
                as: 'objectDetails',
            },
        },
        {
            $lookup: {
                from: 'projects',
                localField: 'projectId',
                foreignField: '_id',
                as: 'projectDoc',
            },
        },
        {
            $addFields: {
                projectKey: { $arrayElemAt: ['$projectDoc.key', 0] },
                projectName: { $arrayElemAt: ['$projectDoc.name', 0] },
                projectOperator: { $arrayElemAt: ['$projectDoc.operator', 0] },
            },
        },
        {
            $project: {
                projectDoc: 0,
            },
        },
        {
            $sort: { createdAt: -1 },
        },
    ]);

    const filteredTasks = tasks.filter(
        (task) =>
            Array.isArray(task.bsLocation) &&
            task.bsLocation.some(
                (location: Location) => location && location.coordinates
            )
    );

    const normalizedTasks = filteredTasks.map((task) => {
        const { attachments } = splitAttachmentsAndDocuments(
            (task as { attachments?: unknown }).attachments,
            (task as { documents?: unknown }).documents
        );
        return {
            ...task,
            attachments,
            documents: undefined,
        };
    });

    return { ok: true, tasks: normalizedTasks } as const;
};

export const getTaskDetails = async (taskId: string) => {
    if (!taskId) {
        return { ok: false, error: 'No taskId provided', status: 400 } as const;
    }

    const taskIdUpper = taskId.toUpperCase();
    const task = await TaskModel.findOne({ taskId: taskIdUpper });
    if (!task) {
        return { ok: false, error: 'Task not found', status: 404 } as const;
    }

    await task.populate({
        path: 'relatedTasks',
        select: 'taskId taskName bsNumber status priority',
    });

    const photoReports = await ReportModel.find({ taskId: taskIdUpper });

    const baseTask = task.toObject();
    const { attachments } = splitAttachmentsAndDocuments(
        baseTask.attachments,
        baseTask.documents
    );

    const normalizedRelatedTasks = normalizeRelatedTasks(task.relatedTasks);

    return {
        ok: true,
        task: {
            ...baseTask,
            relatedTasks: normalizedRelatedTasks,
            attachments,
            documents: undefined,
            photoReports: photoReports || [],
        },
    } as const;
};
