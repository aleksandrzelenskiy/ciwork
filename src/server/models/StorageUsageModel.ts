import 'server-only';

import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export interface StorageUsage extends Document {
    orgId: Types.ObjectId;
    bytesUsed: number;
    readOnly: boolean;
    readOnlyReason?: string;
    updatedAt: Date;
    createdAt: Date;
}

const StorageUsageSchema = new Schema<StorageUsage>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
        bytesUsed: { type: Number, default: 0 },
        readOnly: { type: Boolean, default: false },
        readOnlyReason: { type: String },
    },
    { timestamps: true, collection: 'storage_usage' }
);

export default (models.StorageUsage as mongoose.Model<StorageUsage>) ||
model<StorageUsage>('StorageUsage', StorageUsageSchema);
