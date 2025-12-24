import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export interface OrgWallet extends Document {
    orgId: Types.ObjectId;
    balance: number;
    currency: string;
    updatedAt: Date;
    createdAt: Date;
}

const OrgWalletSchema = new Schema<OrgWallet>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true, index: true },
        balance: { type: Number, default: 0 },
        currency: { type: String, default: 'RUB' },
    },
    { timestamps: true, collection: 'org_wallets' }
);

export default (models.OrgWallet as mongoose.Model<OrgWallet>) ||
model<OrgWallet>('OrgWallet', OrgWalletSchema);
