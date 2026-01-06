import 'server-only';

export type TaskSyncPayload = Record<string, unknown>;

export function buildTaskSyncPayload(task: unknown): TaskSyncPayload {
    const record = JSON.parse(JSON.stringify(task ?? {})) as TaskSyncPayload;
    delete record.taskDescription;
    delete record.publicDescription;
    delete record.comments;
    delete record.events;
    delete record.__v;
    return record;
}
