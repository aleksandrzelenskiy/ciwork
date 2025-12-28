// app/api/users/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import UserModel from '@/server/models/UserModel';

export async function GET() {
  try {
    await dbConnect();
    const users = await UserModel.find({}, 'clerkUserId name email role profilePic');
    return NextResponse.json(users);
  } catch (error) {
    console.error('Ошибка при получении пользователей:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке пользователей' },
      { status: 500 }
    );
  }
}
