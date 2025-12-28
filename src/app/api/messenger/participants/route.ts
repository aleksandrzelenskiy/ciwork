'use server';

import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import MembershipModel from '@/server/models/MembershipModel';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';

type ParticipantDTO = {
    email: string;
    name?: string;
    role?: string;
};

const normalizeEmail = (value?: string | null) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';

async function resolveActiveOrg() {
    const currentUser = await GetCurrentUserFromMongoDB();
    if (!currentUser.success) {
        return {
            ok: false as const,
            response: NextResponse.json(
                { error: currentUser.message || 'Unauthorized' },
                { status: 401 }
            ),
        };
    }

    const email = normalizeEmail(currentUser.data.email);
    if (!email) {
        return {
            ok: false as const,
            response: NextResponse.json({ error: 'Email отсутствует' }, { status: 400 }),
        };
    }

    await dbConnect();

    const memberships = await MembershipModel.find({
        userEmail: email,
        status: 'active',
    })
        .lean()
        .exec();

    const activeOrgId =
        currentUser.data.activeOrgId?.toString() ?? memberships[0]?.orgId?.toString() ?? '';

    if (!activeOrgId) {
        return {
            ok: false as const,
            response: NextResponse.json(
                { error: 'Нет активной организации для мессенджера' },
                { status: 400 }
            ),
        };
    }

    return {
        ok: true as const,
        context: {
            email,
            activeOrgId,
        },
    };
}

export async function GET() {
    const resolved = await resolveActiveOrg();
    if (!resolved.ok) return resolved.response;
    const { email, activeOrgId } = resolved.context;

    const members = await MembershipModel.find({
        orgId: activeOrgId,
        status: 'active',
    })
        .sort({ userName: 1, userEmail: 1 })
        .lean()
        .exec();

    const participants: ParticipantDTO[] = members.map((member) => ({
        email: normalizeEmail(member.userEmail),
        name: member.userName ?? undefined,
        role: member.role ?? undefined,
    }));

    return NextResponse.json({
        ok: true,
        userEmail: email,
        participants,
    });
}
