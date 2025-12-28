import 'server-only';

// src/server/models/UserModel.ts

import mongoose, { Schema, Document, model, models, Types } from 'mongoose';
import type { PlatformRole } from '@/app/types/roles';
export type ProfileType = 'employer' | 'contractor';
export type SubscriptionTier = 'free' | 'team' | 'enterprise';
export type BillingStatus = 'trial' | 'active' | 'past_due' | 'canceled';

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    phone?: string;
    email: string;
    profilePic: string;
    clerkUserId: string;
    platformRole: PlatformRole;
    profileType?: ProfileType;
    profileSetupCompleted: boolean;
    subscriptionTier: SubscriptionTier;
    billingStatus: BillingStatus;
    activeOrgId?: Types.ObjectId | null;
    regionCode?: string;
    lastActive?: Date | null;
    // Подрядчик — профиль
    skills?: string[];
    desiredRate?: number; // фиксированная ставка за типовую задачу
    bio?: string;
    portfolioLinks?: string[];
    completedCount?: number;
    rating?: number;
    portfolioStatus?: 'pending' | 'approved' | 'rejected';
    moderationComment?: string;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        phone: { type: String, default: '', trim: true },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        profilePic: { type: String, required: true, trim: true },
        clerkUserId: { type: String, required: true, unique: true, index: true },
        platformRole: {
            type: String,
            enum: ['super_admin', 'staff', 'user'],
            default: 'user',
        },
        profileType: {
            type: String,
            enum: ['employer', 'contractor'],
        },
        profileSetupCompleted: {
            type: Boolean,
            default: false,
        },
        subscriptionTier: {
            type: String,
            enum: ['free', 'team', 'enterprise'],
            default: 'free',
        },
        billingStatus: {
            type: String,
            enum: ['trial', 'active', 'past_due', 'canceled'],
            default: 'trial',
        },
        activeOrgId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            default: null,
        },
        regionCode: {
            type: String,
            default: '',
        },
        lastActive: {
            type: Date,
            default: null,
        },
        skills: { type: [String], default: [] },
        desiredRate: { type: Number },
        bio: { type: String, default: '' },
        portfolioLinks: { type: [String], default: [] },
        completedCount: { type: Number, default: 0 },
        rating: { type: Number, min: 0, max: 5 },
        portfolioStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        moderationComment: { type: String, default: '' },
    },
    { timestamps: true, collection: 'users' }
);

export default (models.User as mongoose.Model<IUser>) || model<IUser>('User', UserSchema);
