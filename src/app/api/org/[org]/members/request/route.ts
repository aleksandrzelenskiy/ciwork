// src/app/api/org/[org]/members/request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import type { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import Membership, { type OrgRole } from '@/server/models/MembershipModel';
import UserModel from '@/server/models/UserModel';
import { createNotification } from '@/server/notifications/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RequestBody = { role?: OrgRole };
type RequestResponse = { ok: true } | { error: string };

const normalizeEmail = (value: string | undefined | null) => value?.trim().toLowerCase() || '';

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<RequestResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const requesterEmail = normalizeEmail(me?.emailAddresses?.[0]?.emailAddress);
        if (!requesterEmail || !me?.id) {
            return NextResponse.json({ error: 'Auth required' }, { status: 401 });
        }

        const org = await Organization.findOne({ orgSlug }).lean<{
            _id: Types.ObjectId;
            name: string;
            orgSlug: string;
            ownerEmail: string;
        }>();
        if (!org) return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });

        if (normalizeEmail(org.ownerEmail) === requesterEmail) {
            return NextResponse.json({ error: 'Вы уже владелец этой организации' }, { status: 400 });
        }

        const existing = await Membership.findOne({ orgId: org._id, userEmail: requesterEmail }).lean();
        if (existing?.status === 'active') {
            return NextResponse.json({ error: 'Вы уже состоите в этой организации' }, { status: 409 });
        }
        if (existing?.status === 'invited') {
            return NextResponse.json({ error: 'Для вас уже есть приглашение в эту организацию' }, { status: 409 });
        }
        if (existing?.status === 'requested') {
            return NextResponse.json({ error: 'Запрос уже отправлен' }, { status: 409 });
        }

        const body = (await req.json().catch(() => ({}))) as RequestBody;
        const requestedRole: OrgRole = body?.role === 'manager' ? 'manager' : 'manager';

        const requesterDoc = await UserModel.findOne({ email: requesterEmail }, { name: 1 })
            .lean<{ name?: string }>();

        const membership = await Membership.create({
            orgId: org._id,
            userEmail: requesterEmail,
            userName: requesterDoc?.name ?? me?.fullName ?? me?.username ?? requesterEmail,
            role: requestedRole,
            status: 'requested',
        });

        const ownerEmail = normalizeEmail(org.ownerEmail);
        const owner = ownerEmail
            ? await UserModel.findOne({ email: ownerEmail }, { _id: 1, name: 1 }).lean<{ _id: Types.ObjectId; name?: string }>()
            : null;

        if (owner?._id) {
            const requesterName = requesterDoc?.name || me?.fullName || me?.username || requesterEmail;
            const orgName = org.name ?? org.orgSlug;
            try {
                const membershipId = membership?._id ? String(membership._id) : '';
                const requestLink = membershipId
                    ? `/org/${encodeURIComponent(org.orgSlug)}/requests/${encodeURIComponent(membershipId)}`
                    : `/org/${encodeURIComponent(org.orgSlug)}`;
                await createNotification({
                    recipientUserId: owner._id,
                    type: 'org_join_request',
                    title: 'Запрос на присоединение',
                    message: `${requesterName} хочет присоединиться к «${orgName}» как менеджер проекта.`,
                    link: requestLink,
                    orgId: org._id,
                    orgSlug: org.orgSlug,
                    orgName,
                    senderName: requesterName,
                    senderEmail: requesterEmail,
                    metadata: {
                        role: requestedRole,
                        requesterEmail,
                        membershipId,
                    },
                });
            } catch (notifyError) {
                console.error('Failed to create org_join_request notification', notifyError);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE /api/org/:org/members/request — отменить запрос на вступление
export async function DELETE(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<RequestResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const requesterEmail = normalizeEmail(me?.emailAddresses?.[0]?.emailAddress);
        if (!requesterEmail || !me?.id) {
            return NextResponse.json({ error: 'Auth required' }, { status: 401 });
        }

        const org = await Organization.findOne({ orgSlug }).lean<{
            _id: Types.ObjectId;
            name: string;
            orgSlug: string;
        }>();
        if (!org) return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });

        const membership = await Membership.findOne({
            orgId: org._id,
            userEmail: requesterEmail,
            status: 'requested',
        }).lean();
        if (!membership) {
            return NextResponse.json({ error: 'Активного запроса нет' }, { status: 404 });
        }

        await Membership.deleteOne({ _id: membership._id });

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
