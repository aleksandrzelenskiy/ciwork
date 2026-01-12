// src/server/models/ReviewModel.ts

import mongoose, { Schema, type Document, model, models, Types } from 'mongoose';

export interface IReview extends Document {
    _id: Types.ObjectId;
    targetUserId: Types.ObjectId;
    authorUserId: Types.ObjectId;
    rating: number;
    comment?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
    {
        targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        authorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, default: '' },
    },
    { timestamps: true, collection: 'reviews' }
);

ReviewSchema.index({ targetUserId: 1, authorUserId: 1 }, { unique: true });

export default (models.Review as mongoose.Model<IReview>) || model<IReview>('Review', ReviewSchema);
