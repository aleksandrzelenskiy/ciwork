import { Types } from 'mongoose';
import TaskModel from '@/server/models/TaskModel';

export async function addReverseRelations(taskId: Types.ObjectId, relatedIds: string[]): Promise<void> {
    const currentStr = taskId.toHexString();
    const uniqueTargets = Array.from(new Set(relatedIds.filter((id) => id && id !== currentStr)));
    if (!uniqueTargets.length) return;
    try {
        const objectIds = uniqueTargets.map((id) => new Types.ObjectId(id));
        await TaskModel.updateMany(
            { _id: { $in: objectIds } },
            { $addToSet: { relatedTasks: taskId } }
        );
    } catch (err) {
        console.error('Failed to add reverse related tasks:', err);
    }
}

export async function removeReverseRelations(
    taskId: Types.ObjectId,
    relatedIds: string[]
): Promise<void> {
    const targets = Array.from(new Set(relatedIds.filter(Boolean)));
    if (!targets.length) return;
    try {
        const objectIds = targets.map((id) => new Types.ObjectId(id));
        await TaskModel.updateMany(
            { _id: { $in: objectIds } },
            { $pull: { relatedTasks: taskId } }
        );
    } catch (err) {
        console.error('Failed to remove reverse related tasks:', err);
    }
}
