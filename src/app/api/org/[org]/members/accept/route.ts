// src/app/api/org/[org]/members/accept/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import MembershipModel, { type Membership as MembershipDoc } from '@/server/models/MembershipModel';
import { ensureSeatAvailable } from '@/utils/seats';
import { Types, type FilterQuery } from 'mongoose';
import { currentUser } from '@clerk/nextjs/server';
import UserModel from '@/server/models/UserModel';
import { createNotification } from '@/server/notifications/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown) {
    return err instanceof Error ? err.message : 'Server error';
}

type OrgLean = { _id: Types.ObjectId; orgSlug: string; name?: string };

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const meEmail = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!meEmail) {
            return NextResponse.json({ error: 'Auth required' }, { status: 401 });
        }

        const { token } = (await req.json()) as { token?: string };
        if (!token) {
            return NextResponse.json({ error: 'token обязателен' }, { status: 400 });
        }

        const org = await Organization.findOne(
            { orgSlug },
            { _id: 1, orgSlug: 1, name: 1 }
        ).lean<OrgLean>();
        if (!org) {
            return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
        }

        // Ищем приглашение строго на текущий email
        const filter: FilterQuery<MembershipDoc> = {
            orgId: org._id,
            status: 'invited',
            inviteToken: token,
            inviteExpiresAt: { $gt: new Date() },
            userEmail: meEmail,
        };

        const m = await MembershipModel.findOne(filter);
        if (!m) {
            return NextResponse.json({ error: 'Приглашение недействительно для этого аккаунта' }, { status: 400 });
        }

        // Проверка лимита мест (seats)
        const seat = await ensureSeatAvailable(org._id);
        if (!seat.ok) {
            return NextResponse.json(
                { error: `Достигнут лимит мест: ${seat.used}/${seat.limit}` },
                { status: 402 }
            );
        }

        // Активируем участника и стираем токен
        m.status = 'active';
        m.inviteToken = undefined;
        m.inviteExpiresAt = undefined;
        await m.save();

        const inviterEmail = m.invitedByEmail;
        if (inviterEmail) {
            const inviterUser = await UserModel.findOne(
                { email: inviterEmail },
                { _id: 1, name: 1 }
            ).lean<{ _id: Types.ObjectId; name?: string }>();

            if (inviterUser?._id) {
                const orgName = org.name ?? org.orgSlug;
                const actorName =
                    m.userName ||
                    me?.fullName ||
                    [me?.firstName, me?.lastName].filter(Boolean).join(' ') ||
                    meEmail;

                try {
                    await createNotification({
                        recipientUserId: inviterUser._id,
                        type: 'invite_accepted',
                        title: 'Приглашение принято',
                        message: `${actorName} принял приглашение в «${orgName}»`,
                        link: `/org/${org.orgSlug}`,
                        orgId: org._id,
                        orgSlug: org.orgSlug,
                        orgName,
                        senderName: actorName,
                        senderEmail: meEmail,
                        metadata: {
                            inviteeEmail: meEmail,
                            membershipId: m._id.toString(),
                            response: 'accepted',
                        },
                    });
                } catch (notifyErr) {
                    console.error('Failed to create invite_accepted notification', notifyErr);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
