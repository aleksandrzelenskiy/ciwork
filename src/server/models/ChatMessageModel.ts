import 'server-only';

// src/server/models/ChatMessageModel.ts
import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface ChatMessage extends Document {
    conversationId: mongoose.Types.ObjectId;
    orgId: mongoose.Types.ObjectId;
    senderEmail: string;
    senderName?: string;
    text: string;
    readBy: string[];
    createdAt: Date;
}

const ChatMessageSchema = new Schema<ChatMessage>(
    {
        conversationId: { type: Schema.Types.ObjectId, ref: 'ChatConversation', required: true, index: true },
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        senderEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
        senderName: { type: String },
        text: { type: String, required: true },
        readBy: { type: [String], default: [], index: true }, // lower-case emails
    },
    { timestamps: true }
);

ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });

export default (models.ChatMessage as mongoose.Model<ChatMessage>) ||
    model<ChatMessage>('ChatMessage', ChatMessageSchema);
