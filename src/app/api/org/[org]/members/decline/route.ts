// app/api/org/[org]/members/decline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import Membership from '@/server/models/MembershipModel';
import { Types, FilterQuery } from 'mongoose';
import { currentUser } from '@clerk/nextjs/server';
import UserModel from '@/server/models/UserModel';
import { createNotification } from '@/server/notifications/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown) { return err instanceof Error ? err.message : 'Server error'; }
type OrgLean = { _id: Types.ObjectId; orgSlug: string; name?: string };

export async function POST(req: NextRequest, ctx: { params: Promise<{ org: string }> }) {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const meEmail = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!meEmail) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { token } = (await req.json()) as { token?: string };
        if (!token) return NextResponse.json({ error: 'token обязателен' }, { status: 400 });

        const org = await Organization.findOne({ orgSlug }, { _id: 1, orgSlug: 1, name: 1 }).lean<OrgLean>();
        if (!org) return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });

        const filter: FilterQuery<typeof Membership> = {
            orgId: org._id,
            status: 'invited',
            inviteToken: token,
            inviteExpiresAt: { $gt: new Date() },
            userEmail: meEmail, // ключевое ограничение: только владелец e-mail может отклонить
        };

        const m = await Membership.findOne(filter);
        if (!m) {
            // Идемпотентность/без раскрытия: просто отвечаем ок
            return NextResponse.json({ ok: true });
        }

        // Вариант 1: удаляем приглашение
        await Membership.deleteOne({ _id: m._id });

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
                        type: 'invite_declined',
                        title: 'Приглашение отклонено',
                        message: `${actorName} отклонил приглашение в «${orgName}»`,
                        link: `/org/${org.orgSlug}`,
                        orgId: org._id,
                        orgSlug: org.orgSlug,
                        orgName,
                        senderName: actorName,
                        senderEmail: meEmail,
                        metadata: {
                            inviteeEmail: meEmail,
                            membershipId: m._id.toString(),
                            response: 'declined',
                        },
                    });
                } catch (notifyErr) {
                    console.error('Failed to create invite_declined notification', notifyErr);
                }
            }
        }

        // Вариант 2: инвалидируем токен, оставив след о факте инвайта
        // m.inviteToken = undefined;
        // m.inviteExpiresAt = undefined;
        // m.status = 'invited'; // или завести статус 'declined'
        // await m.save();

        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
