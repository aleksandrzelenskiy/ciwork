// src/server/models/MembershipModel.ts
import mongoose, { Schema, Document, model, models } from 'mongoose';

export type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';

export interface Membership extends Document {
    _id: mongoose.Types.ObjectId;
    orgId: mongoose.Types.ObjectId;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: 'active' | 'invited';
    createdAt: Date;

    invitedByEmail?: string;
    inviteToken?: string;
    inviteExpiresAt?: Date;
}

const MembershipSchema = new Schema<Membership>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

        userEmail: { type: String, required: true, index: true, lowercase: true, trim: true },
        userName: { type: String },
        role: { type: String, enum: ['owner', 'org_admin', 'manager', 'executor', 'viewer'], default: 'viewer' },
        status: { type: String, enum: ['active', 'invited'], default: 'active' },
        createdAt: { type: Date, default: Date.now },


        invitedByEmail: { type: String, lowercase: true, trim: true },
        inviteToken: { type: String, index: true },
        inviteExpiresAt: { type: Date, index: true },
    },
    { timestamps: true }
);

// одно участникство на email в пределах организации
MembershipSchema.index({ orgId: 1, userEmail: 1 }, { unique: true });

export default (models.Membership as mongoose.Model<Membership>) ||
model<Membership>('Membership', MembershipSchema);
