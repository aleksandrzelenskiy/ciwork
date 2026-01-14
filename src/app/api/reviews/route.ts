import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import UserModel from '@/server/models/UserModel';
import ReviewModel from '@/server/models/ReviewModel';
import { createNotification } from '@/server/notifications/service';

type ReviewPayload = {
    targetClerkUserId?: string;
    rating?: number;
    comment?: string | null;
};

export async function GET(request: Request) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser) {
            return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const targetClerkUserId = searchParams.get('targetClerkUserId')?.trim();
        if (!targetClerkUserId) {
            return NextResponse.json(
                { error: 'Пользователь не указан' },
                { status: 400 }
            );
        }

        await dbConnect();

        const target = await UserModel.findOne({ clerkUserId: targetClerkUserId })
            .select('_id')
            .lean();
        if (!target) {
            return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
        }

        const reviews = await ReviewModel.aggregate<{
            _id: string;
            rating: number;
            comment?: string;
            createdAt: Date;
            authorName?: string;
        }>([
            { $match: { targetUserId: target._id } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'authorUserId',
                    foreignField: '_id',
                    as: 'author',
                },
            },
            { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    rating: 1,
                    comment: 1,
                    createdAt: 1,
                    authorName: '$author.name',
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        return NextResponse.json({
            reviews: reviews.map((review) => ({
                id: review._id?.toString?.() ?? String(review._id),
                rating: review.rating,
                comment: review.comment ?? null,
                createdAt: review.createdAt?.toISOString?.() ?? new Date().toISOString(),
                authorName: review.authorName || 'Пользователь',
            })),
        });
    } catch (error) {
        console.error('GET /api/reviews error:', error);
        return NextResponse.json(
            { error: 'Не удалось загрузить отзывы' },
            { status: 500 }
        );
    }
}

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

        const authorName = author.name || 'Пользователь';

        await createNotification({
            recipientUserId: target._id,
            type: 'review_received',
            title: 'Новый отзыв',
            message: `Пользователь ${authorName} оставил отзыв.`,
            link: `/profile/${target.clerkUserId}`,
            senderName: authorName,
            senderEmail: author.email,
            metadata: {
                rating,
            },
        });

        return NextResponse.json({ ok: true, rating: nextRating });
    } catch (error) {
        console.error('POST /api/reviews error:', error);
        return NextResponse.json(
            { error: 'Не удалось отправить отзыв' },
            { status: 500 }
        );
    }
}
