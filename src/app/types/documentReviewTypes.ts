export type DocumentReviewStatus = 'Draft' | 'Pending' | 'Issues' | 'Fixed' | 'Agreed';

export type IssueStatus = 'open' | 'resolved';

export type IssueCommentType = 'comment' | 'fix-note';

export type DocumentIssueComment = {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    createdAt: string | Date;
    type: IssueCommentType;
};

export type DocumentIssue = {
    id: string;
    text: string;
    status: IssueStatus;
    createdAt: string | Date;
    createdById: string;
    createdByName: string;
    comments: DocumentIssueComment[];
};

export type IssueSnapshot = {
    issueId: string;
    text: string;
    status: IssueStatus;
};

export type VersionFileMeta = {
    name: string;
    ext: string;
    size: number;
};

export type DocumentReviewVersion = {
    version: number;
    createdAt: string | Date;
    createdById: string;
    createdByName: string;
    changeLog: string;
    filesMeta: VersionFileMeta[];
    issuesSnapshot: IssueSnapshot[];
};

export type DocumentReviewClient = {
    taskId: string;
    taskName?: string;
    bsNumber?: string;
    orgSlug?: string | null;
    projectKey?: string | null;
    status: DocumentReviewStatus;
    currentVersion: number;
    currentFiles: string[];
    previousFiles: string[];
    issues: DocumentIssue[];
    versions: DocumentReviewVersion[];
    role?: 'manager' | 'executor' | 'viewer';
    createdAt?: string;
    updatedAt?: string;
    executorName?: string;
    initiatorName?: string;
};

export type DocumentReviewSummary = {
    taskId: string;
    status: DocumentReviewStatus;
    currentVersion: number;
    currentFilesCount: number;
    issuesOpenCount: number;
};
