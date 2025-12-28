import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import UserModel from '@/server/models/UserModel';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return NextResponse.json(
            { error: 'Некорректный идентификатор пользователя' },
            { status: 400 }
        );
    }

    const viewer = await GetCurrentUserFromMongoDB();
    if (!viewer.success) {
        return NextResponse.json(
            { error: 'Требуется авторизация' },
            { status: 401 }
        );
    }

    try {
        await dbConnect();
    } catch (error) {
        console.error('GET /api/profile/[userId] db error', error);
        return NextResponse.json(
            { error: 'Не удалось подключиться к базе' },
            { status: 500 }
        );
    }

    const user = await UserModel.findById(userId).lean();
    if (!user) {
        return NextResponse.json(
            { error: 'Пользователь не найден' },
            { status: 404 }
        );
    }

    const canEdit =
        user._id?.toString?.() === viewer.data._id?.toString?.();

    return NextResponse.json({
        profile: {
            id: user._id?.toString?.(),
            name: user.name,
            email: user.email,
            phone: user.phone ?? '',
            regionCode: user.regionCode ?? '',
            profilePic: user.profilePic || '',
            profileType: user.profileType,
            skills: user.skills ?? [],
            desiredRate: user.desiredRate ?? null,
            bio: user.bio ?? '',
            portfolioLinks: user.portfolioLinks ?? [],
            portfolioStatus: user.portfolioStatus ?? 'pending',
            moderationComment: user.moderationComment ?? '',
            completedCount: user.completedCount ?? 0,
            rating: typeof user.rating === 'number' ? user.rating : null,
        },
        canEdit,
    });
}
