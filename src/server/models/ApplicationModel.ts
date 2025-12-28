import 'server-only';

// src/server/models/ApplicationModel.ts
import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export type ApplicationStatus =
    | 'submitted'
    | 'shortlisted'
    | 'accepted'
    | 'rejected'
    | 'withdrawn';

export interface Application extends Document {
    _id: Types.ObjectId;
    taskId: Types.ObjectId;
    orgId: Types.ObjectId;
    contractorId: Types.ObjectId;
    contractorEmail?: string;
    contractorName?: string;
    coverMessage: string;
    proposedBudget: number;
    etaDays?: number;
    attachments?: string[];
    status: ApplicationStatus;
    createdAt: Date;
    updatedAt: Date;
}

const ApplicationSchema = new Schema<Application>(
    {
        taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        contractorEmail: { type: String, lowercase: true, trim: true },
        contractorName: { type: String },
        coverMessage: { type: String, required: false, trim: true, default: '' },
        proposedBudget: { type: Number, required: true },
        etaDays: { type: Number },
        attachments: { type: [String], default: [] },
        status: {
            type: String,
            enum: ['submitted', 'shortlisted', 'accepted', 'rejected', 'withdrawn'],
            default: 'submitted',
            index: true,
        },
    },
    { timestamps: true }
);

ApplicationSchema.index({ taskId: 1, contractorId: 1 }, { unique: true });

export default (models.Application as mongoose.Model<Application>) ||
model<Application>('Application', ApplicationSchema);
