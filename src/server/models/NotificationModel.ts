import 'server-only';

// src/server/models/NotificationModel.ts

import mongoose, { Schema, Document, model, models, Types } from 'mongoose';
import type { NotificationKind, NotificationStatus } from '@/app/types/notifications';

export interface NotificationDoc extends Document {
    _id: Types.ObjectId;
    recipientUserId: Types.ObjectId;
    type: NotificationKind;
    title: string;
    message: string;
    link?: string;
    status: NotificationStatus;
    readAt?: Date;
    orgId?: Types.ObjectId;
    orgSlug?: string;
    orgName?: string;
    senderName?: string;
    senderEmail?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

const NotificationSchema = new Schema<NotificationDoc>(
    {
        recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        type: {
            type: String,
            enum: [
                'org_invite',
                'org_welcome',
                'signup_bonus',
                'invite_accepted',
                'invite_declined',
                'task_assigned',
                'task_unassigned',
                'task_comment',
                'task_status_change',
                'task_published',
                'task_application_submitted',
                'task_application_status',
            ],
            required: true,
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        link: { type: String },
        status: { type: String, enum: ['unread', 'read'], default: 'unread', index: true },
        readAt: { type: Date },
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization' },
        orgSlug: { type: String },
        orgName: { type: String },
        senderName: { type: String },
        senderEmail: { type: String },
        metadata: { type: Schema.Types.Mixed },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        collection: 'notifications',
    }
);

NotificationSchema.index({ recipientUserId: 1, createdAt: -1 });

export default (models.Notification as mongoose.Model<NotificationDoc>) ||
model<NotificationDoc>('Notification', NotificationSchema);
