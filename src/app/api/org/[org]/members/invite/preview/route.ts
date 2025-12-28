import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import Membership from '@/server/models/MembershipModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown) {
    return err instanceof Error ? err.message : 'Server error';
}

type PreviewResponse =
    | {
          ok: true;
          orgName: string;
          orgSlug: string;
          expiresAt: string | null;
          invitedEmail?: string;
          role?: string;
      }
    | { error: string };

export async function GET(req: NextRequest, ctx: { params: Promise<{ org: string }> }) {
    try {
        await dbConnect();
        const { org } = await ctx.params;
        const orgSlug = org?.trim().toLowerCase();
        const searchParams = req.nextUrl.searchParams;
        const token = searchParams.get('token')?.trim();

        if (!orgSlug) {
            return NextResponse.json({ error: 'org обязателен' } as PreviewResponse, { status: 400 });
        }
        if (!token) {
            return NextResponse.json({ error: 'token обязателен' } as PreviewResponse, { status: 400 });
        }

        const orgDoc = await Organization.findOne(
            { orgSlug },
            { _id: 1, name: 1, orgSlug: 1 }
        ).lean();
        if (!orgDoc) {
            return NextResponse.json({ error: 'Приглашение не найдено' } as PreviewResponse, { status: 404 });
        }

        const membership = await Membership.findOne(
            {
                orgId: orgDoc._id,
                status: 'invited',
                inviteToken: token,
                inviteExpiresAt: { $gt: new Date() },
            },
            { inviteExpiresAt: 1, userEmail: 1, role: 1 }
        ).lean();

        if (!membership) {
            return NextResponse.json({ error: 'Приглашение не найдено' } as PreviewResponse, { status: 404 });
        }

        return NextResponse.json({
            ok: true,
            orgName: orgDoc.name,
            orgSlug: orgDoc.orgSlug,
            expiresAt: membership.inviteExpiresAt ? membership.inviteExpiresAt.toISOString() : null,
            invitedEmail: membership.userEmail,
            role: membership.role,
        } as PreviewResponse);
    } catch (err) {
        return NextResponse.json({ error: errorMessage(err) } as PreviewResponse, { status: 500 });
    }
}
