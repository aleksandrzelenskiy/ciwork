import 'server-only';

// src/server/models/WalletModel.ts
import mongoose, { Schema, Document, model, models, Types } from 'mongoose';

export interface Wallet extends Document {
    contractorId: Types.ObjectId;
    balance: number;
    bonusBalance: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
}

const WalletSchema = new Schema<Wallet>(
    {
        contractorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
        balance: { type: Number, default: 0 },
        bonusBalance: { type: Number, default: 0 },
        currency: { type: String, default: 'RUB' },
    },
    { timestamps: true, collection: 'wallets' }
);

export default (models.Wallet as mongoose.Model<Wallet>) ||
model<Wallet>('Wallet', WalletSchema);
