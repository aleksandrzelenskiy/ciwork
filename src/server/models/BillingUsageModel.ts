import 'server-only';

// src/server/models/BillingUsageModel.ts
import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export type BillingPeriod = string; // YYYY-MM (UTC)

export interface BillingUsage extends Document {
    orgId: Types.ObjectId;
    period: BillingPeriod;
    projectsUsed: number;
    seatsUsed: number;
    publicationsUsed: number;
    tasksUsed: number;
    createdAt: Date;
    updatedAt: Date;
}

const BillingUsageSchema = new Schema<BillingUsage>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        period: { type: String, required: true },
        projectsUsed: { type: Number, default: 0 },
        seatsUsed: { type: Number, default: 0 },
        publicationsUsed: { type: Number, default: 0 },
        tasksUsed: { type: Number, default: 0 },
    },
    { timestamps: true, collection: 'billing_usage' }
);

BillingUsageSchema.index({ orgId: 1, period: 1 }, { unique: true });

export default (models.BillingUsage as mongoose.Model<BillingUsage>) ||
model<BillingUsage>('BillingUsage', BillingUsageSchema);
