// src/app/api/org/[org]/members/requests/[memberId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Membership from '@/server/models/MembershipModel';
import { requireOrgRole } from '@/server/org/permissions';
import { Types } from 'mongoose';
import UserModel from '@/server/models/UserModel';
import { createNotification } from '@/server/notifications/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const normalizeEmail = (value: string | undefined | null) => value?.trim().toLowerCase() || '';

// PATCH: approve join request
export async function PATCH(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string; memberId: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlug, memberId } = await ctx.params;

        const me = await currentUser();
        const meEmail = normalizeEmail(me?.emailAddresses?.[0]?.emailAddress);
        if (!meEmail) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, meEmail, ['owner']);

        if (!Types.ObjectId.isValid(memberId)) {
            return NextResponse.json({ error: 'Некорректный memberId' }, { status: 400 });
        }

        const membership = await Membership.findOne({ _id: memberId, orgId: org._id });
        if (!membership) return NextResponse.json({ error: 'Запрос не найден' }, { status: 404 });

        if (membership.status !== 'requested') {
            return NextResponse.json({ error: 'Запрос уже обработан' }, { status: 409 });
        }

        membership.status = 'active';
        await membership.save();

        const requesterEmail = normalizeEmail(membership.userEmail);
        if (requesterEmail) {
            const requester = await UserModel.findOne({ email: requesterEmail }, { _id: 1 }).lean<{ _id: Types.ObjectId }>();
            if (requester?._id) {
                try {
                    await createNotification({
                        recipientUserId: requester._id,
                        type: 'org_join_approved',
                        title: 'Запрос одобрен',
                        message: `Ваш запрос на присоединение к «${org.name ?? org.orgSlug}» одобрен.`,
                        link: `/org/${encodeURIComponent(org.orgSlug)}`,
                        orgId: org._id,
                        orgSlug: org.orgSlug,
                        orgName: org.name ?? org.orgSlug,
                        senderName: me?.fullName || me?.username || meEmail,
                        senderEmail: meEmail,
                    });
                } catch (notifyError) {
                    console.error('Failed to create org_join_approved notification', notifyError);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// DELETE: decline join request
export async function DELETE(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string; memberId: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlug, memberId } = await ctx.params;

        const me = await currentUser();
        const meEmail = normalizeEmail(me?.emailAddresses?.[0]?.emailAddress);
        if (!meEmail) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, meEmail, ['owner']);

        if (!Types.ObjectId.isValid(memberId)) {
            return NextResponse.json({ error: 'Некорректный memberId' }, { status: 400 });
        }

        const membership = await Membership.findOne({ _id: memberId, orgId: org._id });
        if (!membership) return NextResponse.json({ error: 'Запрос не найден' }, { status: 404 });

        if (membership.status !== 'requested') {
            return NextResponse.json({ error: 'Запрос уже обработан' }, { status: 409 });
        }

        const requesterEmail = normalizeEmail(membership.userEmail);
        await Membership.deleteOne({ _id: membership._id });

        if (requesterEmail) {
            const requester = await UserModel.findOne({ email: requesterEmail }, { _id: 1 }).lean<{ _id: Types.ObjectId }>();
            if (requester?._id) {
                try {
                    await createNotification({
                        recipientUserId: requester._id,
                        type: 'org_join_declined',
                        title: 'Запрос отклонён',
                        message: `Ваш запрос на присоединение к «${org.name ?? org.orgSlug}» отклонён.`,
                        link: `/org/${encodeURIComponent(org.orgSlug)}`,
                        orgId: org._id,
                        orgSlug: org.orgSlug,
                        orgName: org.name ?? org.orgSlug,
                        senderName: me?.fullName || me?.username || meEmail,
                        senderEmail: meEmail,
                    });
                } catch (notifyError) {
                    console.error('Failed to create org_join_declined notification', notifyError);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
