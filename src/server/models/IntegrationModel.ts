import 'server-only';

import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export type IntegrationType = 'google_sheets' | 'telegram' | 'erp_1c' | 'n8n_webhook';
export type IntegrationStatus = 'active' | 'paused';

export interface Integration extends Document {
    _id: Types.ObjectId;
    orgId: Types.ObjectId;
    projectId?: Types.ObjectId | null;
    type: IntegrationType;
    name?: string;
    status: IntegrationStatus;
    webhookUrl?: string;
    webhookSecret?: string;
    config?: string;
    createdAt: Date;
    updatedAt: Date;
}

const IntegrationSchema = new Schema<Integration>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: false, index: true },
        type: {
            type: String,
            enum: ['google_sheets', 'telegram', 'erp_1c', 'n8n_webhook'],
            required: true,
            index: true,
        },
        name: { type: String, default: '' },
        status: {
            type: String,
            enum: ['active', 'paused'],
            default: 'active',
            index: true,
        },
        webhookUrl: { type: String, default: '' },
        webhookSecret: { type: String, default: '' },
        config: { type: String, default: '' },
    },
    { timestamps: true, collection: 'integrations' }
);

export default (models.Integration as mongoose.Model<Integration>) ||
model<Integration>('Integration', IntegrationSchema);
