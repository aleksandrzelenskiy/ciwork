import ReportModel from '@/app/models/ReportModel';
import TaskModel from '@/app/models/TaskModel';
import type { IEvent } from '@/app/types/reportTypes';

type Actor = {
    id: string;
    name: string;
};

type ReportStatus = 'Pending' | 'Issues' | 'Fixed' | 'Agreed';

const ensureEventArray = (events?: IEvent[]) => (Array.isArray(events) ? events : []);

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

    const existing = await ReportModel.findOne({ taskId, baseId });
    if (existing) return existing;

    return new ReportModel({
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
    });
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
    report.events = ensureEventArray(report.events);
    report.storageBytes = (report.storageBytes ?? 0) + Math.max(0, bytesAdded);
    if (kind === 'fix') {
        report.fixedFiles.push(...files);
        report.status = 'Fixed';
        report.events.push({
            action: 'FIXED_PHOTOS',
            author: actor.name,
            authorId: actor.id,
            date: now,
            details: { newFiles: files.length },
        });
    } else {
        report.files.push(...files);
        report.status = 'Pending';
        report.events.push({
            action: report.events.length ? 'REPORT_UPDATED' : 'REPORT_CREATED',
            author: actor.name,
            authorId: actor.id,
            date: now,
            details: { newFiles: files.length },
        });
    }
    await report.save();
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
    const oldStatus = task.status;
    if (oldStatus === status) return task;
    task.status = status;
    if (!Array.isArray(task.events)) task.events = [];
    task.events.push({
        action: 'STATUS_CHANGED',
        author: actor.name,
        authorId: actor.id,
        date: new Date(),
        details: {
            oldStatus,
            newStatus: status,
            comment,
        },
    });
    await task.save();
    return task;
};
