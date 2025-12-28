import 'server-only';

// src/server/models/TaskDeletionLog.ts

import mongoose, { Schema, Document, model, Types } from 'mongoose';

export interface TaskDeletionLog extends Document {
    orgId?: Types.ObjectId;
    projectId?: Types.ObjectId;
    taskId: string;
    taskName?: string;
    bsNumber?: string;
    deletedById: string;
    deletedByEmail?: string;
    deletedAt: Date;
}

const TaskDeletionLogSchema = new Schema<TaskDeletionLog>({
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: false, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: false, index: true },
    taskId: { type: String, required: true, index: true },
    taskName: { type: String },
    bsNumber: { type: String },
    deletedById: { type: String, required: true },
    deletedByEmail: { type: String },
    deletedAt: { type: Date, default: Date.now },
});

const MODEL_NAME = 'TaskDeletionLog';

const mutableModels = mongoose.models as unknown as Record<string, mongoose.Model<unknown>>;

if (mutableModels[MODEL_NAME]) {
    delete mutableModels[MODEL_NAME];
}

export default model<TaskDeletionLog>(MODEL_NAME, TaskDeletionLogSchema);
