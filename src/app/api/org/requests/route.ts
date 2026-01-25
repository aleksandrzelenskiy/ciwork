// src/app/api/org/requests/route.ts
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import type { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import Membership from '@/server/models/MembershipModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RequestItem = {
    orgId: string;
    orgSlug: string;
    name: string;
    requestedAt: string;
};

type RequestsResponse = { requests: RequestItem[] } | { error: string };

const normalizeEmail = (value: string | undefined | null) => value?.trim().toLowerCase() || '';

export async function GET(): Promise<NextResponse<RequestsResponse>> {
    try {
        await dbConnect();
        const me = await currentUser();
        const email = normalizeEmail(me?.emailAddresses?.[0]?.emailAddress);
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const memberships = await Membership.find(
            { userEmail: email, status: 'requested' },
            { orgId: 1, createdAt: 1 }
        ).lean<{ orgId: Types.ObjectId; createdAt?: Date }>();

        if (memberships.length === 0) {
            return NextResponse.json({ requests: [] });
        }

        const orgIds = memberships.map((m) => m.orgId);
        const orgs = await Organization.find(
            { _id: { $in: orgIds } },
            { name: 1, orgSlug: 1 }
        ).lean<{ _id: Types.ObjectId; name: string; orgSlug: string }>();

        const orgById = new Map<string, { name: string; orgSlug: string }>();
        for (const org of orgs) {
            orgById.set(String(org._id), { name: org.name, orgSlug: org.orgSlug });
        }

        const requests: RequestItem[] = memberships
            .map((membership) => {
                const org = orgById.get(String(membership.orgId));
                if (!org) return null;
                return {
                    orgId: String(membership.orgId),
                    name: org.name,
                    orgSlug: org.orgSlug,
                    requestedAt: membership.createdAt ? membership.createdAt.toISOString() : '',
                };
            })
            .filter(Boolean) as RequestItem[];

        return NextResponse.json({ requests });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
