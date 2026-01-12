import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import UserModel from '@/server/models/UserModel';
import ReviewModel from '@/server/models/ReviewModel';

type ReviewPayload = {
    targetClerkUserId?: string;
    rating?: number;
    comment?: string | null;
};

export async function POST(request: Request) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
        }

        const payload = (await request.json()) as ReviewPayload;
        const targetClerkUserId = payload.targetClerkUserId?.trim();
        const rating = typeof payload.rating === 'number' ? payload.rating : undefined;
        const comment = typeof payload.comment === 'string' ? payload.comment.trim() : '';

        if (!targetClerkUserId) {
            return NextResponse.json({ error: 'Пользователь не указан' }, { status: 400 });
        }

        if (!rating || rating < 1 || rating > 5) {
            return NextResponse.json({ error: 'Оценка должна быть от 1 до 5' }, { status: 400 });
        }

        if (targetClerkUserId === clerkUser.id) {
            return NextResponse.json({ error: 'Нельзя оставлять отзыв о себе' }, { status: 400 });
        }

        await dbConnect();

        const author = await UserModel.findOne({ clerkUserId: clerkUser.id }).lean();
        if (!author) {
            return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
        }

        const target = await UserModel.findOne({ clerkUserId: targetClerkUserId }).lean();
        if (!target) {
            return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
        }

        await ReviewModel.findOneAndUpdate(
            { targetUserId: target._id, authorUserId: author._id },
            { $set: { rating, comment } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        const [summary] = await ReviewModel.aggregate<{
            _id: null;
            avg: number;
        }>([
            { $match: { targetUserId: target._id } },
            { $group: { _id: null, avg: { $avg: '$rating' } } },
        ]);

        const nextRating = summary?.avg ? Number(summary.avg.toFixed(2)) : 0;
        await UserModel.updateOne({ _id: target._id }, { $set: { rating: nextRating } });

        return NextResponse.json({ ok: true, rating: nextRating });
    } catch (error) {
        console.error('POST /api/reviews error:', error);
        return NextResponse.json(
            { error: 'Не удалось отправить отзыв' },
            { status: 500 }
        );
    }
}
