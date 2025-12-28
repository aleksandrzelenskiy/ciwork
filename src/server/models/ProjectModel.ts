import 'server-only';

// src/server/models/ProjectModel.ts
import mongoose, { Schema, Document, Model } from 'mongoose';
import type { UpdateQuery } from 'mongoose';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';

export interface Project extends Document {
    orgId: mongoose.Types.ObjectId;
    name: string;
    key: string;
    description?: string;
    managers: string[];
    createdByEmail: string;
    regionCode: typeof RUSSIAN_REGIONS[number]['code'];
    operator: typeof OPERATORS[number]['value'];
    createdAt: Date;
    updatedAt: Date;
}

const ProjectSchema = new Schema<Project>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        name: { type: String, required: true },
        key:  { type: String, required: true },
        description: { type: String },
        managers: { type: [String], default: [] },
        regionCode: {
            type: String,
            enum: RUSSIAN_REGIONS.map((region) => region.code),
            required: true,
        },
        operator: {
            type: String,
            enum: OPERATORS.map((operator) => operator.value),
            required: true,
        },
        createdByEmail: { type: String, required: true },
    },
    { timestamps: true }
);

// Уникальность ключа в пределах организации
ProjectSchema.index({ orgId: 1, key: 1 }, { unique: true });

// Нормализация KEY при сохранении
ProjectSchema.pre('save', function (next) {
    if (typeof this.key === 'string') {
        this.key = this.key.trim().toUpperCase();
    }
    next();
});

// Нормализация KEY при findOneAndUpdate / updateOne — БЕЗ any
ProjectSchema.pre('findOneAndUpdate', function (next) {
    type UpdateWithKey = UpdateQuery<Project> & {
        key?: string;
        $set?: Partial<Pick<Project, 'key'>>;
    };

    const update = this.getUpdate() as UpdateWithKey | undefined;
    if (!update) return next();

    const normalize = (v?: string) =>
        typeof v === 'string' ? v.trim().toUpperCase() : v;

    if (update.$set && typeof update.$set.key === 'string') {
        update.$set.key = normalize(update.$set.key);
    } else if (typeof update.key === 'string') {
        update.key = normalize(update.key);
    }

    next();
});

ProjectSchema.path('key').validate((v: string) => /^[A-Z0-9-]+$/.test(v), 'Invalid project key');

const ProjectModel: Model<Project> =
    (mongoose.models.Project as Model<Project>) ||
    mongoose.model<Project>('Project', ProjectSchema);

export default ProjectModel;
