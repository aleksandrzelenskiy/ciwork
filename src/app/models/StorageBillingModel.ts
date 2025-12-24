import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export interface StorageBilling extends Document {
    orgId: Types.ObjectId;
    period: string; // YYYY-MM
    hourKey: string; // YYYY-MM-DD-HH (UTC)
    bytesSnapshot: number;
    gbBilled: number;
    amountRub: number;
    chargedAt: Date;
}

const StorageBillingSchema = new Schema<StorageBilling>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        period: { type: String, required: true },
        hourKey: { type: String, required: true },
        bytesSnapshot: { type: Number, required: true },
        gbBilled: { type: Number, required: true },
        amountRub: { type: Number, required: true },
        chargedAt: { type: Date, default: Date.now },
    },
    { timestamps: true, collection: 'storage_billing' }
);

StorageBillingSchema.index({ orgId: 1, hourKey: 1 }, { unique: true });

export default (models.StorageBilling as mongoose.Model<StorageBilling>) ||
model<StorageBilling>('StorageBilling', StorageBillingSchema);
