import 'server-only';

import mongoose, { Schema } from 'mongoose';
import type { IEvent } from '@/app/types/reportTypes';
import type {
    DocumentReviewStatus,
    IssueStatus,
    IssueCommentType,
} from '@/app/types/documentReviewTypes';

type IssueComment = {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    createdAt: Date;
    type: IssueCommentType;
};

type Issue = {
    id: string;
    text: string;
    status: IssueStatus;
    createdAt: Date;
    createdById: string;
    createdByName: string;
    comments: IssueComment[];
};

type IssueSnapshot = {
    issueId: string;
    text: string;
    status: IssueStatus;
};

type VersionFileMeta = {
    name: string;
    ext: string;
    size: number;
};

type StoredFileMeta = VersionFileMeta & {
    url: string;
};

type DocumentReviewVersion = {
    version: number;
    createdAt: Date;
    createdById: string;
    createdByName: string;
    changeLog: string;
    filesMeta: VersionFileMeta[];
    issuesSnapshot: IssueSnapshot[];
};

type DocumentReview = {
    orgId: mongoose.Types.ObjectId | string;
    projectId?: mongoose.Types.ObjectId | string;
    taskId: string;
    taskName?: string;
    status: DocumentReviewStatus;
    currentVersion: number;
    currentFiles: string[];
    previousFiles: string[];
    currentFilesMeta: StoredFileMeta[];
    previousFilesMeta: StoredFileMeta[];
    currentBytes: number;
    previousBytes: number;
    issues: Issue[];
    versions: DocumentReviewVersion[];
    events: IEvent[];
    createdById: string;
    createdByName: string;
    initiatorName?: string;
};

const EventSchema = new Schema<IEvent>(
    {
        action: { type: String, required: true },
        author: { type: String, required: true },
        authorId: { type: String },
        date: { type: Date, default: Date.now },
        details: { type: mongoose.Schema.Types.Mixed },
    },
    { _id: false }
);

const IssueCommentSchema = new Schema<IssueComment>(
    {
        id: { type: String, required: true },
        text: { type: String, required: true },
        authorId: { type: String, required: true },
        authorName: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        type: { type: String, default: 'comment' },
    },
    { _id: false }
);

const IssueSchema = new Schema<Issue>(
    {
        id: { type: String, required: true },
        text: { type: String, required: true },
        status: { type: String, default: 'open' },
        createdAt: { type: Date, default: Date.now },
        createdById: { type: String, required: true },
        createdByName: { type: String, required: true },
        comments: { type: [IssueCommentSchema], default: [] },
    },
    { _id: false }
);

const IssueSnapshotSchema = new Schema<IssueSnapshot>(
    {
        issueId: { type: String, required: true },
        text: { type: String, required: true },
        status: { type: String, required: true },
    },
    { _id: false }
);

const VersionFileMetaSchema = new Schema<VersionFileMeta>(
    {
        name: { type: String, required: true },
        ext: { type: String, required: true },
        size: { type: Number, required: true },
    },
    { _id: false }
);

const StoredFileMetaSchema = new Schema<StoredFileMeta>(
    {
        url: { type: String, required: true },
        name: { type: String, required: true },
        ext: { type: String, required: true },
        size: { type: Number, required: true },
    },
    { _id: false }
);

const VersionSchema = new Schema<DocumentReviewVersion>(
    {
        version: { type: Number, required: true },
        createdAt: { type: Date, default: Date.now },
        createdById: { type: String, required: true },
        createdByName: { type: String, required: true },
        changeLog: { type: String, required: true },
        filesMeta: { type: [VersionFileMetaSchema], default: [] },
        issuesSnapshot: { type: [IssueSnapshotSchema], default: [] },
    },
    { _id: false }
);

const DocumentReviewSchema = new Schema<DocumentReview>(
    {
        orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        taskId: { type: String, required: true, index: true },
        taskName: { type: String, default: '' },
        status: { type: String, default: 'Draft' },
        currentVersion: { type: Number, default: 0 },
        currentFiles: { type: [String], default: [] },
        previousFiles: { type: [String], default: [] },
        currentFilesMeta: { type: [StoredFileMetaSchema], default: [] },
        previousFilesMeta: { type: [StoredFileMetaSchema], default: [] },
        currentBytes: { type: Number, default: 0 },
        previousBytes: { type: Number, default: 0 },
        issues: { type: [IssueSchema], default: [] },
        versions: { type: [VersionSchema], default: [] },
        events: { type: [EventSchema], default: [] },
        createdById: { type: String, required: true },
        createdByName: { type: String, default: 'Unknown' },
        initiatorName: { type: String, default: 'initiator' },
    },
    { timestamps: true }
);

DocumentReviewSchema.index({ taskId: 1 }, { unique: true });

const DocumentReviewModel =
    mongoose.models.DocumentReview || mongoose.model<DocumentReview>('DocumentReview', DocumentReviewSchema);

export default DocumentReviewModel;
