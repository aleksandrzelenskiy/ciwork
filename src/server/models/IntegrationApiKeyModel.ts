import 'server-only';

import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export type IntegrationScope = 'tasks:read' | 'tasks:events' | 'tasks:write';
export type IntegrationKeyStatus = 'active' | 'revoked';

export interface IntegrationApiKey extends Document {
    _id: Types.ObjectId;
    orgId: Types.ObjectId;
    projectId?: Types.ObjectId | null;
    keyId: string;
    keyHash: string;
    keySalt: string;
    scopes: IntegrationScope[];
    status: IntegrationKeyStatus;
    lastUsedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const IntegrationApiKeySchema = new Schema<IntegrationApiKey>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: false, index: true },
        keyId: { type: String, required: true, unique: true, index: true },
        keyHash: { type: String, required: true },
        keySalt: { type: String, required: true },
        scopes: {
            type: [String],
            default: ['tasks:read'],
        },
        status: {
            type: String,
            enum: ['active', 'revoked'],
            default: 'active',
            index: true,
        },
        lastUsedAt: { type: Date, default: null },
    },
    { timestamps: true, collection: 'integration_api_keys' }
);

export default (models.IntegrationApiKey as mongoose.Model<IntegrationApiKey>) ||
model<IntegrationApiKey>('IntegrationApiKey', IntegrationApiKeySchema);
