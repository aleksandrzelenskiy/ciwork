import 'server-only';

// src/server/models/WalletTransactionModel.ts
import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export type WalletTransactionType = 'credit' | 'debit';
export type WalletTransactionSource = 'signup_bonus' | 'bid' | 'manual_adjustment';

export interface WalletTransaction extends Document {
    walletId: Types.ObjectId;
    contractorId: Types.ObjectId;
    amount: number;
    type: WalletTransactionType;
    source: WalletTransactionSource;
    balanceAfter: number;
    bonusBalanceAfter: number;
    meta?: Record<string, unknown>;
    createdAt: Date;
}

const WalletTransactionSchema = new Schema<WalletTransaction>(
    {
        walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true, index: true },
        contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        amount: { type: Number, required: true },
        type: { type: String, enum: ['credit', 'debit'], required: true },
        source: { type: String, enum: ['signup_bonus', 'bid', 'manual_adjustment'], required: true },
        balanceAfter: { type: Number, required: true },
        bonusBalanceAfter: { type: Number, required: true },
        meta: { type: Schema.Types.Mixed },
    },
    { timestamps: { createdAt: true, updatedAt: false }, collection: 'wallet_transactions' }
);

WalletTransactionSchema.index({ contractorId: 1, createdAt: -1 });

export default (models.WalletTransaction as mongoose.Model<WalletTransaction>) ||
model<WalletTransaction>('WalletTransaction', WalletTransactionSchema);
