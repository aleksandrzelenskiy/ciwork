// src/server/org/permissions.ts

import 'server-only';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import Membership, { OrgRole } from '@/server/models/MembershipModel';
import { Types } from 'mongoose';

/** Минимальный lean-тип организации */
interface OrgLean {
    _id: Types.ObjectId;
    name: string;
    orgSlug: string;
    ownerEmail?: string;
    createdByEmail?: string;
}

/** Минимальный lean-тип членства */
interface MembershipLean {
    _id: Types.ObjectId;
    orgId: Types.ObjectId;
    userEmail: string;
    role: OrgRole;
    status?: string;
}

/**
 * Проверяет, что пользователь состоит в организации orgSlug и его роль входит в allowed. Возвращает org и membership (оба lean).
 */
export async function requireOrgRole(
    orgSlug: string,
    userEmail: string,
    allowed: OrgRole[]
): Promise<{ org: OrgLean; membership: MembershipLean }> {
    await dbConnect();

    const normalizedSlug = orgSlug.trim().toLowerCase();
    const normalizedEmail = userEmail.trim().toLowerCase();

    const org = await Organization.findOne({ orgSlug: normalizedSlug }).lean<OrgLean>();
    if (!org) throw new Error('Организация не найдена');

    const membership = await Membership.findOne({ orgId: org._id, userEmail: normalizedEmail }).lean<MembershipLean>();
    if (!membership) throw new Error('Нет членства в этой организации');

    if (!allowed.includes(membership.role)) {
        throw new Error('Недостаточно прав');
    }

    return { org, membership };
}

/** Возвращает организацию по orgSlug (lean). Бросает, если не найдено. */
export async function getOrgBySlug(orgSlug: string): Promise<OrgLean> {
    await dbConnect();

    const normalizedSlug = orgSlug.trim().toLowerCase();
    const org = await Organization.findOne({ orgSlug: normalizedSlug }).lean<OrgLean>();
    if (!org) throw new Error('Организация не найдена');

    return org;
}
