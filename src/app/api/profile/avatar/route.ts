import { NextResponse } from 'next/server';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import UserModel from '@/server/models/UserModel';

export async function POST(request: Request) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const formData = await request.formData();
    const avatarFile = formData.get('avatar');
    if (!(avatarFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'Файл аватара не найден' },
        { status: 400 }
      );
    }

    const client = await clerkClient();
    const updated = await client.users.updateUserProfileImage(
      clerkUser.id,
      { file: avatarFile }
    );

    const imageUrl = updated.imageUrl;

    await dbConnect();
    await UserModel.findOneAndUpdate(
      { clerkUserId: clerkUser.id },
      { profilePic: imageUrl, portfolioStatus: 'pending', moderationComment: '' },
      { new: true }
    );

    return NextResponse.json({ ok: true, imageUrl });
  } catch (error) {
    console.error('POST /api/profile/avatar error:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить аватар' },
      { status: 500 }
    );
  }
}
