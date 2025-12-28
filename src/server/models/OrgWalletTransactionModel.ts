import 'server-only';

import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export type OrgWalletTxType = 'credit' | 'debit';
export type OrgWalletTxSource = 'manual' | 'storage_overage';

export interface OrgWalletTransaction extends Document {
    orgId: Types.ObjectId;
    amount: number;
    type: OrgWalletTxType;
    source: OrgWalletTxSource;
    balanceAfter: number;
    meta?: Record<string, unknown>;
    createdAt: Date;
}

const OrgWalletTransactionSchema = new Schema<OrgWalletTransaction>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        amount: { type: Number, required: true },
        type: { type: String, enum: ['credit', 'debit'], required: true },
        source: { type: String, enum: ['manual', 'storage_overage'], required: true },
        balanceAfter: { type: Number, required: true },
        meta: { type: Schema.Types.Mixed },
    },
    { timestamps: { createdAt: true, updatedAt: false }, collection: 'org_wallet_transactions' }
);

export default (models.OrgWalletTransaction as mongoose.Model<OrgWalletTransaction>) ||
model<OrgWalletTransaction>('OrgWalletTransaction', OrgWalletTransactionSchema);
