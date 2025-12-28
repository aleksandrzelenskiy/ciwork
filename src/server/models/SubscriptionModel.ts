import 'server-only';

// src/server/models/SubscriptionModel.ts
import mongoose, { Schema, Document, model, models } from 'mongoose';

export type SubscriptionPlan = 'basic' | 'pro' | 'business' | 'enterprise';

export interface Subscription extends Document {
    orgId: mongoose.Types.ObjectId;
    plan: SubscriptionPlan;
    status: 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';
    seats?: number;            // лимит мест
    projectsLimit?: number;    // лимит проектов
    publicTasksLimit?: number; // лимит публичных задач
    boostCredits?: number;     // кредиты на бусты
    storageLimitGb?: number;   // лимит хранилища
    periodStart?: Date;
    periodEnd?: Date;
    note?: string;             // номер счёта/комментарии
    updatedByEmail?: string;   // кто включил/изменил
    updatedAt: Date;
    createdAt: Date;
}

const SubscriptionSchema = new Schema<Subscription>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
        plan: { type: String, enum: ['basic', 'pro', 'business', 'enterprise'], default: 'basic' },
        status: { type: String, enum: ['active', 'trial', 'suspended', 'past_due', 'inactive'], default: 'inactive' },
        seats: { type: Number },
        projectsLimit: { type: Number },
        publicTasksLimit: { type: Number },
        boostCredits: { type: Number, default: 0 },
        storageLimitGb: { type: Number, default: 10 },
        periodStart: { type: Date },
        periodEnd: { type: Date },
        note: { type: String },
        updatedByEmail: { type: String },
        updatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export default (models.Subscription as mongoose.Model<Subscription>) ||
model<Subscription>('Subscription', SubscriptionSchema);
