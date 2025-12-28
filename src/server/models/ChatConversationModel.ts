import 'server-only';

// src/server/models/ChatConversationModel.ts
import mongoose, { Schema, Document, model, models } from 'mongoose';

export type ConversationType = 'org' | 'project' | 'direct';

export interface ChatConversation extends Document {
    orgId: mongoose.Types.ObjectId;
    type: ConversationType;
    title: string;
    projectKey?: string | null;
    participants: string[]; // lowercased emails for direct chats, optional for others
    createdByEmail: string;
    createdAt: Date;
    updatedAt: Date;
}

const ChatConversationSchema = new Schema<ChatConversation>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        type: { type: String, enum: ['org', 'project', 'direct'], required: true, index: true },
        title: { type: String, required: true },
        projectKey: { type: String, index: true },
        participants: { type: [String], default: [], index: true }, // lower-case emails
        createdByEmail: { type: String, required: true, lowercase: true, trim: true },
    },
    { timestamps: true }
);

ChatConversationSchema.index({ orgId: 1, type: 1, projectKey: 1 }, { unique: false });
ChatConversationSchema.index({ orgId: 1, type: 1, participants: 1 });

export default (models.ChatConversation as mongoose.Model<ChatConversation>) ||
    model<ChatConversation>('ChatConversation', ChatConversationSchema);
