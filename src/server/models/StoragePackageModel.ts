import 'server-only';

import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export type StoragePackageStatus = 'active' | 'expired' | 'canceled';

export interface StoragePackage extends Document {
    orgId: Types.ObjectId;
    packageGb: number;
    priceRubMonthly: number;
    periodStart: Date;
    periodEnd: Date;
    status: StoragePackageStatus;
    autoRenew: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const StoragePackageSchema = new Schema<StoragePackage>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        packageGb: { type: Number, required: true },
        priceRubMonthly: { type: Number, required: true },
        periodStart: { type: Date, required: true },
        periodEnd: { type: Date, required: true },
        status: { type: String, enum: ['active', 'expired', 'canceled'], default: 'active' },
        autoRenew: { type: Boolean, default: true },
    },
    { timestamps: true, collection: 'storage_packages' }
);

StoragePackageSchema.index({ orgId: 1, periodEnd: 1 });

export default (models.StoragePackage as mongoose.Model<StoragePackage>) ||
model<StoragePackage>('StoragePackage', StoragePackageSchema);
