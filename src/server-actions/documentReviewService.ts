import DocumentReviewModel from '@/server/models/DocumentReviewModel';
import TaskModel from '@/server/models/TaskModel';
import type { IEvent } from '@/app/types/reportTypes';
import type {
    DocumentReviewStatus,
    DocumentIssue,
    DocumentIssueComment,
    IssueSnapshot,
    VersionFileMeta,
} from '@/app/types/documentReviewTypes';

type Actor = {
    id: string;
    name: string;
};

const ensureEventArray = (events?: IEvent[]) => (Array.isArray(events) ? events : []);

export const findDocumentReview = async (taskId: string) =>
    DocumentReviewModel.findOne({ taskId });

export const upsertDocumentReview = async (params: {
    taskId: string;
    taskName?: string;
    orgId: string;
    projectId?: string | null;
    initiatorName?: string | null;
    actor: Actor;
}) => {
    const { taskId, taskName, orgId, projectId, initiatorName, actor } = params;

    return DocumentReviewModel.findOneAndUpdate(
        { taskId },
        {
            $setOnInsert: {
                taskId,
                taskName: taskName ?? '',
                orgId,
                projectId: projectId ?? undefined,
                createdById: actor.id,
                createdByName: actor.name,
                initiatorName: initiatorName ?? undefined,
                status: 'Draft',
                currentVersion: 0,
                currentFiles: [],
                previousFiles: [],
                currentFilesMeta: [],
                previousFilesMeta: [],
                currentBytes: 0,
                previousBytes: 0,
                issues: [],
                versions: [],
                events: [],
            },
        },
        { new: true, upsert: true }
    ).exec();
};

export const appendDocumentEvent = async (params: {
    review: InstanceType<typeof DocumentReviewModel>;
    event: IEvent;
}) => {
    const { review, event } = params;
    review.events = ensureEventArray(review.events);
    review.events.push(event);
    await review.save();
    return review;
};

export const updateDocumentStatus = async (params: {
    review: InstanceType<typeof DocumentReviewModel>;
    status: DocumentReviewStatus;
    actor: Actor;
}) => {
    const { review, status, actor } = params;
    if (review.status === status) return review;
    const oldStatus = review.status;
    review.status = status;
    review.events = ensureEventArray(review.events);
    review.events.push({
        action: 'STATUS_CHANGED',
        author: actor.name,
        authorId: actor.id,
        date: new Date(),
        details: { oldStatus, newStatus: status },
    });
    await review.save();
    return review;
};

export const syncTaskStatusFromDocument = async (params: {
    taskId: string;
    status: DocumentReviewStatus;
    actor: Actor;
    comment: string;
}) => {
    const { taskId, status, actor, comment } = params;
    const task = await TaskModel.findOne({ taskId });
    if (!task) return null;

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

export const addDocumentIssue = async (params: {
    review: InstanceType<typeof DocumentReviewModel>;
    issue: DocumentIssue;
    actor: Actor;
}) => {
    const { review, issue, actor } = params;
    review.issues = Array.isArray(review.issues) ? review.issues : [];
    review.issues.push(issue as never);
    review.events = ensureEventArray(review.events);
    review.events.push({
        action: 'ISSUE_ADDED',
        author: actor.name,
        authorId: actor.id,
        date: new Date(),
        details: { issueId: issue.id },
    });
    await review.save();
    return review;
};

export const resolveDocumentIssue = async (params: {
    review: InstanceType<typeof DocumentReviewModel>;
    issueId: string;
    actor: Actor;
}) => {
    const { review, issueId, actor } = params;
    const issues = Array.isArray(review.issues) ? (review.issues as DocumentIssue[]) : [];
    const target = issues.find((item: DocumentIssue) => item.id === issueId);
    if (!target) return review;
    target.status = 'resolved';
    review.events = ensureEventArray(review.events);
    review.events.push({
        action: 'ISSUE_RESOLVED',
        author: actor.name,
        authorId: actor.id,
        date: new Date(),
        details: { issueId },
    });
    await review.save();
    return review;
};

export const addDocumentIssueComment = async (params: {
    review: InstanceType<typeof DocumentReviewModel>;
    issueId: string;
    comment: DocumentIssueComment;
    actor: Actor;
}) => {
    const { review, issueId, comment, actor } = params;
    const issues = Array.isArray(review.issues) ? review.issues : [];
    const target = issues.find((item) => item.id === issueId);
    if (!target) return review;
    target.comments = Array.isArray(target.comments) ? target.comments : [];
    target.comments.push(comment as never);
    review.events = ensureEventArray(review.events);
    review.events.push({
        action: 'ISSUE_COMMENT_ADDED',
        author: actor.name,
        authorId: actor.id,
        date: new Date(),
        details: { issueId, commentId: comment.id },
    });
    await review.save();
    return review;
};

export const appendDocumentVersion = async (params: {
    review: InstanceType<typeof DocumentReviewModel>;
    version: number;
    actor: Actor;
    changeLog: string;
    filesMeta: VersionFileMeta[];
    issuesSnapshot: IssueSnapshot[];
}) => {
    const { review, version, actor, changeLog, filesMeta, issuesSnapshot } = params;
    review.versions = Array.isArray(review.versions) ? review.versions : [];
    review.versions.push({
        version,
        createdAt: new Date(),
        createdById: actor.id,
        createdByName: actor.name,
        changeLog,
        filesMeta,
        issuesSnapshot,
    } as never);
    review.events = ensureEventArray(review.events);
    review.events.push({
        action: 'VERSION_SUBMITTED',
        author: actor.name,
        authorId: actor.id,
        date: new Date(),
        details: { version, files: filesMeta.length },
    });
    await review.save();
    return review;
};
