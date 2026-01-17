// src/app/utils/userContext.ts

import type { EffectiveOrgRole, OrgRole, PlatformRole } from '@/app/types/roles';
import { withBasePath } from '@/utils/basePath';

export interface ActiveMembership {
  _id: string;
  orgId: string;
  userEmail: string;
  userName?: string;
  role: OrgRole;
  status: 'active' | 'invited';
}

export interface UserContextResponse {
  platformRole?: PlatformRole;
  effectiveOrgRole?: EffectiveOrgRole | null;
  membershipRole?: OrgRole | null;
  isSuperAdmin?: boolean;
  profileType?: 'employer' | 'contractor';
  profileSetupCompleted?: boolean;
  name?: string;
  email?: string;
  phone?: string;
  regionCode?: string;
  user?: Record<string, unknown>;
  memberships?: ActiveMembership[];
  activeOrgId?: string | null;
  activeMembership?: ActiveMembership | null;
  error?: string;
}

export const resolveRoleFromContext = (
  payload?: UserContextResponse | null
): EffectiveOrgRole | null => {
  if (!payload) return null;
  if (payload.effectiveOrgRole) return payload.effectiveOrgRole;
  if (payload.membershipRole) return payload.membershipRole;
  if (payload.activeMembership?.role) return payload.activeMembership.role;
  return payload.memberships?.[0]?.role ?? null;
};

export const fetchUserContext = async (): Promise<UserContextResponse | null> => {
  try {
    const res = await fetch(withBasePath('/api/current-user'));
    if (!res.ok) {
      console.error('Failed to fetch user context', res.statusText);
      return null;
    }
    return (await res.json()) as UserContextResponse;
  } catch (error) {
    console.error('Failed to fetch user context', error);
    return null;
  }
};
