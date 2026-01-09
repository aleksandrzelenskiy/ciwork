// server-actions/users.ts

'use server';

import UserModel, { type IUser, type ProfileType } from '@/server/models/UserModel';
import dbConnect from '@/server/db/mongoose';
import { currentUser } from '@clerk/nextjs/server';

type UserSuccessResponse = {
  success: true;
  data: IUser;
};

type UserErrorResponse = {
  success: false;
  message: string;
};

export type GetCurrentUserResponse = UserSuccessResponse | UserErrorResponse;

const serializeUser = (user: unknown): IUser =>
  JSON.parse(JSON.stringify(user)) as IUser;

const normalizeProfileType = (
  value: unknown
): ProfileType | undefined => {
  if (value === 'contractor' || value === 'employer') {
    return value;
  }
  if (value === 'client') {
    return 'employer';
  }
  return undefined;
};

export const GetCurrentUserFromMongoDB =
  async (): Promise<GetCurrentUserResponse> => {
  try {
    await dbConnect();
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return {
        success: false,
        message: 'No user session found',
      };
    }

    const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase();
    let user = await UserModel.findOne({ clerkUserId: clerkUser.id });

    if (!user && primaryEmail) {
      // Support legacy rows that were created before clerkUserId existed
      user = await UserModel.findOne({ email: primaryEmail });
      if (user && !user.clerkUserId) {
        user.clerkUserId = clerkUser.id;
        const fallbackFullName = `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim();
        user.name =
          user.name ||
          fallbackFullName ||
          clerkUser?.username ||
          primaryEmail ||
          'Unknown User';
        user.profilePic = user.profilePic || clerkUser?.imageUrl || '';
        if (!user.platformRole) {
          user.platformRole = 'user';
        }
        const normalizedProfileType = normalizeProfileType(user.profileType);
        if (user.profileType !== normalizedProfileType) {
          user.profileType = normalizedProfileType;
        }
        if (typeof user.phone === 'undefined') {
          user.phone = '';
        }
        if (typeof user.profileSetupCompleted === 'undefined') {
          user.profileSetupCompleted = false;
        }
        if (!user.subscriptionTier) {
          user.subscriptionTier = 'free';
        }
        if (!user.billingStatus) {
          user.billingStatus = 'trial';
        }
        if (typeof user.activeOrgId === 'undefined') {
          user.activeOrgId = null;
        }
        if (typeof user.regionCode === 'undefined') {
          user.regionCode = '';
        }
        await user.save();
      }
    }

    if (user) {
      let needsSave = false;
      if (!user.platformRole) {
        user.platformRole = 'user';
        needsSave = true;
      }
      const normalizedProfileType = normalizeProfileType(user.profileType);
      if (user.profileType !== normalizedProfileType) {
        user.profileType = normalizedProfileType;
        needsSave = true;
      }
      if (!user.name) {
        user.name =
          `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim() ||
          clerkUser?.username ||
          primaryEmail ||
          'Unknown User';
        needsSave = true;
      }
      if (typeof user.phone === 'undefined') {
        user.phone = '';
        needsSave = true;
      }
      if (typeof user.profileSetupCompleted === 'undefined') {
        user.profileSetupCompleted = false;
        needsSave = true;
      }
      if (!user.subscriptionTier) {
        user.subscriptionTier = 'free';
        needsSave = true;
      }
      if (!user.billingStatus) {
        user.billingStatus = 'trial';
        needsSave = true;
      }
      if (typeof user.activeOrgId === 'undefined') {
        user.activeOrgId = null;
        needsSave = true;
      }
      if (typeof user.regionCode === 'undefined') {
        user.regionCode = '';
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
      return {
        success: true,
        data: serializeUser(user),
      };
    }

    const fullName = `${clerkUser?.firstName ?? ''} ${clerkUser?.lastName ?? ''}`.trim();
    const insertPayload = {
      name: fullName || clerkUser?.username || primaryEmail || 'Unknown User',
      phone: '',
      email: primaryEmail || '',
      clerkUserId: clerkUser?.id,
      profilePic: clerkUser?.imageUrl || '',
      platformRole: 'user' as const,
      profileSetupCompleted: false,
      subscriptionTier: 'free' as const,
      billingStatus: 'trial' as const,
      activeOrgId: null,
      regionCode: '',
    };

    const newUser = await UserModel.findOneAndUpdate(
      { clerkUserId: clerkUser.id },
      { $setOnInsert: insertPayload },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    return {
      success: true,
      data: serializeUser(newUser),
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      };
    }
    return {
      success: false,
      message: 'An unknown error occurred',
    };
  }
};
