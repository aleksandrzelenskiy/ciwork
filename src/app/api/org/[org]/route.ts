// src/app/api/org/[org]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import Membership from '@/server/models/MembershipModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toHttpError(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not found/i.test(msg)) return NextResponse.json({ error: 'Org not found' }, { status: 404 });
    if (/forbidden/i.test(msg)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
}

// GET /api/org/:org — краткая информация об организации + твоя роль
export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await ctx.params;
        const orgSlug = org?.trim().toLowerCase();
        if (!orgSlug) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        const orgDoc = await Organization.findOne(
            { orgSlug },
            { name: 1, orgSlug: 1 }
        ).lean();
        if (!orgDoc) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        // скрываем существование организации для не-членов
        const membership = await Membership.findOne(
            { orgId: orgDoc._id, userEmail: email },
            { role: 1 }
        ).lean();
        if (!membership) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        return NextResponse.json({
            org: { _id: String(orgDoc._id), name: orgDoc.name, orgSlug: orgDoc.orgSlug },
            role: membership.role,
        });
    } catch (e) {
        return toHttpError(e);
    }
}
