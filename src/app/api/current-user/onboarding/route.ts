import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import UserModel, { type ProfileType } from '@/server/models/UserModel';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import { ensureWalletWithBonus } from '@/utils/wallet';

const VALID_PROFILE_TYPES: ProfileType[] = ['employer', 'contractor'];

type OnboardingPayload = {
  profileType?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  regionCode?: string;
  consentAccepted?: boolean;
  consentVersion?: string;
  consentAcceptedAt?: string;
};

const REGION_CODES = new Set(RUSSIAN_REGIONS.map((region) => region.code));

export async function POST(request: Request) {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: OnboardingPayload = {};
  try {
    body = (await request.json()) as OnboardingPayload;
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }

  const profileType = body.profileType as ProfileType | undefined;
  if (!profileType || !VALID_PROFILE_TYPES.includes(profileType)) {
    return NextResponse.json(
      { error: 'Выберите роль: заказчик, исполнитель или оба' },
      { status: 400 }
    );
  }

  const firstName = (body.firstName ?? '').trim();
  const lastName = (body.lastName ?? '').trim();
  const phone = (body.phone ?? '').trim();
  const regionCode = (body.regionCode ?? '').trim();
  const consentAccepted = body.consentAccepted === true;
  const consentVersion = (body.consentVersion ?? '').trim();
  const consentAcceptedAt = (body.consentAcceptedAt ?? '').trim();

  if (!consentAccepted) {
    return NextResponse.json(
      { error: 'Для продолжения примите согласие на обработку персональных данных.' },
      { status: 400 }
    );
  }

  if (!firstName || !lastName || !phone || !regionCode) {
    return NextResponse.json(
      { error: 'Укажите имя, фамилию, телефон и регион' },
      { status: 400 }
    );
  }

  if (!REGION_CODES.has(regionCode)) {
    return NextResponse.json(
      { error: 'Выберите регион из списка' },
      { status: 400 }
    );
  }

  const fullName = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();

  await dbConnect();

  const setPayload: Record<string, unknown> = {
    profileType,
    profileSetupCompleted: true,
    platformRole: 'user',
    name: fullName,
    phone,
    regionCode,
    consentAcceptedAt: consentAcceptedAt ? new Date(consentAcceptedAt) : new Date(),
    consentVersion,
  };

  if (profileType === 'contractor') {
    setPayload.activeOrgId = null;
  }

  const updatedUser = await UserModel.findOneAndUpdate(
    { clerkUserId: clerkUser.id },
    { $set: setPayload },
    { new: true }
  ).lean();

  if (!updatedUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (updatedUser.profileType === 'contractor') {
    try {
      await ensureWalletWithBonus(new Types.ObjectId(updatedUser._id));
    } catch (error) {
      console.error('Failed to initialize contractor wallet', error);
    }
  }

  return NextResponse.json({
    success: true,
    profileType: updatedUser.profileType,
    profileSetupCompleted: updatedUser.profileSetupCompleted,
  });
}
