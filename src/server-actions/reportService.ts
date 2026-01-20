import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import type { IEvent } from '@/app/types/reportTypes';

type Actor = {
    id: string;
    name: string;
};

type ReportStatus = 'Pending' | 'Issues' | 'Fixed' | 'Agreed';

const ensureEventArray = (events?: IEvent[]) => (Array.isArray(events) ? events : []);
const REPORT_STATUS_PRIORITY: ReportStatus[] = ['Issues', 'Pending', 'Fixed', 'Agreed'];

const normalizeReportStatus = (status?: string): ReportStatus | null => {
    if (!status) return null;
    const trimmed = status.trim();
    if (trimmed === 'Pending' || trimmed === 'Issues' || trimmed === 'Fixed' || trimmed === 'Agreed') {
        return trimmed;
    }
    return null;
};

const resolveAggregatedReportStatus = (statuses: Array<string | null | undefined>) => {
    const normalizedStatuses = statuses
        .map((status) => normalizeReportStatus(status ?? undefined))
        .filter(Boolean) as ReportStatus[];
    if (normalizedStatuses.length === 0) return null;
    for (const priority of REPORT_STATUS_PRIORITY) {
        if (normalizedStatuses.includes(priority)) return priority;
    }
    return null;
};

export const findReport = async (taskId: string, baseId: string) =>
    ReportModel.findOne({ taskId, baseId });

export const upsertReport = async (params: {
    taskId: string;
    baseId: string;
    taskName?: string;
    orgId: string;
    projectId?: string | null;
    initiatorName?: string | null;
    actor: Actor;
}) => {
    const {
        taskId,
        baseId,
        taskName,
        orgId,
        projectId,
        initiatorName,
        actor,
    } = params;

    return ReportModel.findOneAndUpdate(
        { taskId, baseId },
        {
            $setOnInsert: {
                taskId,
                baseId,
                taskName: taskName ?? '',
                orgId,
                projectId: projectId ?? undefined,
                createdById: actor.id,
                createdByName: actor.name,
                initiatorName: initiatorName ?? undefined,
                status: 'Pending',
                files: [],
                fixedFiles: [],
                issues: [],
                events: [],
            },
        },
        { new: true, upsert: true }
    ).exec();
};

export const appendReportFiles = async (params: {
    report: InstanceType<typeof ReportModel>;
    files: string[];
    bytesAdded?: number;
    actor: Actor;
    kind: 'main' | 'fix';
}) => {
    const { report, files, bytesAdded = 0, actor, kind } = params;
    const now = new Date();
    const event =
        kind === 'fix'
            ? {
                  action: 'FIXED_PHOTOS',
                  author: actor.name,
                  authorId: actor.id,
                  date: now,
                  details: { newFiles: files.length },
              }
            : {
                  action: report.events?.length ? 'REPORT_UPDATED' : 'REPORT_CREATED',
                  author: actor.name,
                  authorId: actor.id,
                  date: now,
                  details: { newFiles: files.length },
              };
    const update =
        kind === 'fix'
            ? {
                  $push: { fixedFiles: { $each: files }, events: event },
                  $inc: { storageBytes: Math.max(0, bytesAdded) },
                  $set: { status: 'Fixed' },
              }
            : {
                  $push: { files: { $each: files }, events: event },
                  $inc: { storageBytes: Math.max(0, bytesAdded) },
                  $set: { status: 'Pending' },
              };
    await ReportModel.updateOne({ _id: report._id }, update).exec();
    return report;
};

export const updateReportStatus = async (params: {
    report: InstanceType<typeof ReportModel>;
    status: ReportStatus;
    actor: Actor;
}) => {
    const { report, status, actor } = params;
    const oldStatus = report.status as ReportStatus;
    if (oldStatus === status) return report;
    report.status = status;
    report.events = ensureEventArray(report.events);
    report.events.push({
        action: 'STATUS_CHANGED',
        author: actor.name,
        authorId: actor.id,
        date: new Date(),
        details: {
            oldStatus,
            newStatus: status,
        },
    });
    await report.save();
    return report;
};

export const updateReportIssues = async (params: {
    report: InstanceType<typeof ReportModel>;
    issues: string[];
    actor: Actor;
}) => {
    const { report, issues, actor } = params;
    const oldIssues = Array.isArray(report.issues) ? [...report.issues] : [];
    report.issues = issues;
    report.events = ensureEventArray(report.events);
    report.events.push({
        action: 'ISSUES_UPDATED',
        author: actor.name,
        authorId: actor.id,
        date: new Date(),
        details: {
            oldIssues,
            newIssues: issues,
        },
    });
    await report.save();
    return report;
};

export const getAggregatedReportStatus = async (taskId: string) => {
    const reports = await ReportModel.find({ taskId }).select('status').lean();
    return resolveAggregatedReportStatus(
        reports.map((report) => (typeof report.status === 'string' ? report.status : null))
    );
};

export const syncTaskStatus = async (params: {
    taskId: string;
    status: ReportStatus;
    actor: Actor;
    comment: string;
}) => {
    const { taskId, status, actor, comment } = params;
    const task = await TaskModel.findOne({ taskId });
    if (!task) return null;
    const allowedPublicStatuses = new Set(['open', 'in_review', 'assigned', 'closed']);
    if (task.publicStatus && !allowedPublicStatuses.has(task.publicStatus)) {
        // normalize legacy/invalid values to a valid enum before save
        task.publicStatus = 'closed';
    }
    const aggregatedStatus = await getAggregatedReportStatus(taskId);
    const nextStatus = aggregatedStatus ?? status;
    const oldStatus = task.status;
    if (oldStatus === nextStatus) return task;
    task.status = nextStatus;
    if (!Array.isArray(task.events)) task.events = [];
    task.events.push({
        action: 'STATUS_CHANGED',
        author: actor.name,
        authorId: actor.id,
        date: new Date(),
        details: {
            oldStatus,
            newStatus: nextStatus,
            comment,
        },
    });
    await task.save();
    return task;
};
