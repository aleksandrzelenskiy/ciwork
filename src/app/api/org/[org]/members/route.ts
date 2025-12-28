// src/app/api/org/[org]/members/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Membership, { OrgRole } from '@/server/models/MembershipModel';
import { requireOrgRole } from '@/server/org/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

type MemberDTO = {
    _id: string;
    orgSlug: string;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: 'active' | 'invited';
    clerkId?: string;

    /** аватар из users.profilePic */
    profilePic?: string;

    // Доп. поля для приглашённых: отдаются только менеджерским ролям
    inviteToken?: string;
    inviteExpiresAt?: string; // ISO
    invitedByEmail?: string;
};

type MembersResponse = { members: MemberDTO[] } | { error: string };
type AddMemberBody = { userEmail: string; userName?: string; role?: OrgRole };
type AddMemberResponse = { ok: true; member: MemberDTO } | { error: string };

type MembershipLean = {
    _id: unknown;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: 'active' | 'invited';
    invitedByEmail?: string;
    inviteToken?: string;
    inviteExpiresAt?: Date;
};

/** Тип строки после aggregate + $project */
type AggRow = {
    _id: string;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: 'active' | 'invited';
    invitedByEmail?: string;
    inviteToken?: string;
    inviteExpiresAt?: Date;
    profilePic?: string | null;
    clerkId?: string | null;
};


// GET /api/org/:org/members?role=executor&status=active|invited|all
export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<MembersResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const email = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // Доступ читают все участники организации
        const { org, membership } = await requireOrgRole(orgSlug, email, [
            'owner',
            'org_admin',
            'manager',
            'executor',
            'viewer',
        ]);

        // Только менеджерские роли видят токены/сроки приглашений
        const includeInviteSecrets = ['owner', 'org_admin', 'manager'].includes(membership.role);

        // Параметры фильтрации
        const url = new URL(req.url);
        const roleParam = url.searchParams.get('role')?.toLowerCase() as OrgRole | undefined;

        // По умолчанию — 'all' (показываем и active, и invited)
        const statusParamRaw =
            (url.searchParams.get('status')?.toLowerCase() as 'active' | 'invited' | 'all' | undefined) ?? 'all';

        const matchStage: Record<string, unknown> = { orgId: org._id };
        if (roleParam) {
            const allowedRoles: OrgRole[] = ['owner', 'org_admin', 'manager', 'executor', 'viewer'];
            if (!allowedRoles.includes(roleParam)) {
                return NextResponse.json({ error: `Unknown role: ${roleParam}` }, { status: 400 });
            }
            matchStage.role = roleParam;
        }
        if (!['active', 'invited', 'all'].includes(statusParamRaw)) {
            return NextResponse.json({ error: `Unknown status: ${statusParamRaw}` }, { status: 400 });
        }
        if (statusParamRaw !== 'all') matchStage.status = statusParamRaw;

        // Один проход: Membership -> $lookup users по email
        const rows = await Membership.aggregate<AggRow>([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userEmail',   // в Membership email хранится в lowercase
                    foreignField: 'email',     // в users тоже lowercase
                    as: 'user',
                },
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: { $toString: '$_id' },
                    userEmail: 1,
                    userName: { $ifNull: ['$user.name', '$userName'] }, // имя из users.name приоритетно
                    role: 1,
                    status: 1,
                    invitedByEmail: 1,
                    inviteToken: 1,
                    inviteExpiresAt: 1,
                    profilePic: '$user.profilePic',
                    clerkId: '$user.clerkUserId',
                },
            },
            { $sort: { userName: 1, userEmail: 1 } },
        ]);

        const members: MemberDTO[] = rows.map((row) => {
            const dto: MemberDTO = {
                _id: row._id,
                orgSlug: org.orgSlug,
                userEmail: row.userEmail,
                userName: row.userName,
                role: row.role,
                status: row.status,
                profilePic: row.profilePic ?? undefined,
                clerkId: row.clerkId ?? undefined,
            };

            if (includeInviteSecrets && row.status === 'invited') {
                if (row.invitedByEmail) dto.invitedByEmail = row.invitedByEmail;
                if (row.inviteToken) dto.inviteToken = row.inviteToken;
                if (row.inviteExpiresAt instanceof Date && !isNaN(row.inviteExpiresAt.getTime())) {
                    dto.inviteExpiresAt = row.inviteExpiresAt.toISOString();
                }
            }
            return dto;
        });

        return NextResponse.json({ members });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// POST /api/org/:org/members — добавить участника
export async function POST(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<AddMemberResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const email = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // Добавлять участников могут только owner/org_admin/manager
        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const body = (await request.json()) as AddMemberBody;
        const userEmail = body.userEmail?.toLowerCase();
        const userName = body.userName?.trim();
        if (!userEmail) {
            return NextResponse.json({ error: 'userEmail обязателен' }, { status: 400 });
        }

        const allowed: OrgRole[] = ['org_admin', 'manager', 'executor', 'viewer'];
        const roleToSet: OrgRole = (allowed.includes(body.role as OrgRole)
            ? (body.role as OrgRole)
            : 'viewer');

        await Membership.findOneAndUpdate(
            { orgId: org._id, userEmail },
            {
                $setOnInsert: {
                    userName: userName || userEmail,
                    role: roleToSet,
                    status: 'active',
                },
            },
            { upsert: true, new: true }
        );

        const saved = await Membership.findOne({ orgId: org._id, userEmail }).lean<MembershipLean | null>();
        if (!saved) {
            return NextResponse.json({ error: 'Не удалось сохранить участника' }, { status: 500 });
        }

        // В POST возвращаем без секретов — обычное добавление активного участника
        const member: MemberDTO = {
            _id: String(saved._id),
            orgSlug: org.orgSlug,
            userEmail: saved.userEmail,
            userName: saved.userName,
            role: saved.role,
            status: saved.status,
        };

        return NextResponse.json({ ok: true, member });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
