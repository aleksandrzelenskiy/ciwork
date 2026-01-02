import 'server-only';

import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface BillingConfig extends Document {
    taskPublishCostRub: number;
    bidCostRub: number;
    updatedAt: Date;
    createdAt: Date;
}

const BillingConfigSchema = new Schema<BillingConfig>(
    {
        taskPublishCostRub: { type: Number, default: 100 },
        bidCostRub: { type: Number, default: 50 },
    },
    { timestamps: true, collection: 'billing_config' }
);

export default (models.BillingConfig as mongoose.Model<BillingConfig>) ||
model<BillingConfig>('BillingConfig', BillingConfigSchema);
