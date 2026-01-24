// src/app/api/org/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import Membership from '@/server/models/MembershipModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrgSearchItem = {
    _id: string;
    name: string;
    orgSlug: string;
    membershipStatus?: 'active' | 'invited' | 'requested';
};

type SearchResponse = { orgs: OrgSearchItem[] } | { error: string };

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function GET(req: NextRequest): Promise<NextResponse<SearchResponse>> {
    try {
        await dbConnect();
        const me = await currentUser();
        const email = me?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const url = new URL(req.url);
        const q = (url.searchParams.get('q') || '').trim();
        const limitRaw = Number(url.searchParams.get('limit') || 8);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 8;

        if (!q || q.length < 2) {
            return NextResponse.json({ orgs: [] });
        }

        const regex = new RegExp(escapeRegex(q), 'i');
        const orgsRaw = await Organization.find(
            { $or: [{ name: regex }, { orgSlug: regex }] },
            { name: 1, orgSlug: 1 }
        )
            .limit(limit)
            .lean();

        const orgIds = orgsRaw.map((org) => org._id);
        const memberships = await Membership.find(
            { orgId: { $in: orgIds }, userEmail: email },
            { orgId: 1, status: 1 }
        ).lean();

        const statusByOrgId = new Map<string, OrgSearchItem['membershipStatus']>();
        for (const membership of memberships) {
            statusByOrgId.set(String(membership.orgId), membership.status);
        }

        const orgs: OrgSearchItem[] = orgsRaw.map((org) => ({
            _id: String(org._id),
            name: org.name,
            orgSlug: org.orgSlug,
            membershipStatus: statusByOrgId.get(String(org._id)),
        }));

        return NextResponse.json({ orgs });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
