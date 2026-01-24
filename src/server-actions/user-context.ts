// src/server-actions/user-context.ts

'use server';

import { GetCurrentUserFromMongoDB, type GetCurrentUserResponse } from '@/server-actions/users';
import MembershipModel, { type OrgRole } from '@/server/models/MembershipModel';
import dbConnect from '@/server/db/mongoose';
import type { IUser } from '@/server/models/UserModel';

interface MembershipSummary {
  _id: string;
  orgId: string;
  userEmail: string;
  userName?: string;
  role: OrgRole;
  status: 'active' | 'invited' | 'requested';
  createdAt?: string;
}

interface UserContextPayload {
  user: IUser;
  memberships: MembershipSummary[];
  activeOrgId: string | null;
  activeMembership: MembershipSummary | null;
  effectiveOrgRole: OrgRole | 'super_admin' | null;
  isSuperAdmin: boolean;
}

export const GetUserContext = async (): Promise<
  | { success: true; data: UserContextPayload }
  | { success: false; message: string }
> => {
  const baseResponse: GetCurrentUserResponse =
    await GetCurrentUserFromMongoDB();

  if (!baseResponse.success) {
    return { success: false, message: baseResponse.message || 'User not found' };
  }

  await dbConnect();

  const user = baseResponse.data;
  const email = user.email?.toLowerCase();

  let memberships: MembershipSummary[] = [];

  if (email) {
    const membershipDocs = await MembershipModel.find({ userEmail: email }).lean();
    memberships = membershipDocs.map((doc) => ({
      _id: doc._id.toString(),
      orgId: doc.orgId?.toString?.() ?? '',
      userEmail: doc.userEmail,
      userName: doc.userName,
      role: doc.role,
      status: doc.status,
      createdAt: doc.createdAt ? doc.createdAt.toISOString?.() ?? String(doc.createdAt) : undefined,
    }));
  }

  let activeOrgId: string | null = user.activeOrgId
    ? user.activeOrgId.toString()
    : null;

  if (!activeOrgId && memberships.length > 0) {
    activeOrgId = memberships[0].orgId || null;
  }

  const activeMembership =
    memberships.find((m) => activeOrgId && m.orgId === activeOrgId) ?? null;
  const fallbackMembership = activeMembership ?? memberships[0] ?? null;
  const isSuperAdmin = user.platformRole === 'super_admin';
  const effectiveOrgRole = isSuperAdmin
    ? 'super_admin'
    : fallbackMembership?.role ?? null;

  return {
    success: true,
    data: {
      user,
      memberships,
      activeOrgId,
      activeMembership,
      effectiveOrgRole,
      isSuperAdmin,
    },
  };
};
