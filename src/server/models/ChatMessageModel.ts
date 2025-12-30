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
    attachments?: Array<{
        url: string;
        kind: 'image' | 'video';
        contentType?: string;
        size?: number;
        width?: number;
        height?: number;
        posterUrl?: string;
        filename?: string;
    }>;
    attachmentsBytes?: number;
    createdAt: Date;
}

const ChatMessageSchema = new Schema<ChatMessage>(
    {
        conversationId: { type: Schema.Types.ObjectId, ref: 'ChatConversation', required: true, index: true },
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        senderEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
        senderName: { type: String },
        text: { type: String, default: '' },
        readBy: { type: [String], default: [], index: true }, // lower-case emails
        attachments: {
            type: [
                {
                    url: { type: String, required: true },
                    kind: { type: String, enum: ['image', 'video'], required: true },
                    contentType: { type: String },
                    size: { type: Number },
                    width: { type: Number },
                    height: { type: Number },
                    posterUrl: { type: String },
                    filename: { type: String },
                },
            ],
            default: [],
        },
        attachmentsBytes: { type: Number, default: 0 },
    },
    { timestamps: true }
);

ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });

export default (models.ChatMessage as mongoose.Model<ChatMessage>) ||
    model<ChatMessage>('ChatMessage', ChatMessageSchema);
