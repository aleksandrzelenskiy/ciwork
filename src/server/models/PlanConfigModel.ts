import 'server-only';

import mongoose, { Schema, Document, model, models } from 'mongoose';

export type PlanCode = 'basic' | 'pro' | 'business' | 'enterprise';

export interface PlanConfig extends Document {
    plan: PlanCode;
    title: string;
    priceRubMonthly: number;
    projectsLimit: number | null;
    seatsLimit: number | null;
    tasksWeeklyLimit: number | null;
    publicTasksMonthlyLimit?: number | null;
    storageIncludedGb: number | null;
    storageOverageRubPerGbMonth: number;
    storagePackageGb: number | null;
    storagePackageRubMonthly: number | null;
    features?: string[];
    updatedAt: Date;
    createdAt: Date;
}

const PlanConfigSchema = new Schema<PlanConfig>(
    {
        plan: { type: String, enum: ['basic', 'pro', 'business', 'enterprise'], required: true, unique: true },
        title: { type: String, required: true },
        priceRubMonthly: { type: Number, required: true },
        projectsLimit: { type: Number, default: null },
        seatsLimit: { type: Number, default: null },
        tasksWeeklyLimit: { type: Number, default: null },
        publicTasksMonthlyLimit: { type: Number, default: null },
        storageIncludedGb: { type: Number, default: null },
        storageOverageRubPerGbMonth: { type: Number, default: 0 },
        storagePackageGb: { type: Number, default: null },
        storagePackageRubMonthly: { type: Number, default: null },
        features: { type: [String], default: [] },
    },
    { timestamps: true, collection: 'plan_configs' }
);

export default (models.PlanConfig as mongoose.Model<PlanConfig>) ||
model<PlanConfig>('PlanConfig', PlanConfigSchema);
