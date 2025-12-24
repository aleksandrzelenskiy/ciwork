import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { requireOrgRole } from '@/app/utils/permissions';
import StorageUsageModel from '@/app/models/StorageUsageModel';
import { sumStorageBytes } from '@/utils/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StorageReconcileDTO = {
    prefix: string;
    bytesUsed: number;
    previousBytes: number;
    deltaBytes: number;
    updatedAt: string;
    checkedAt: string;
    dryRun: boolean;
};

type StorageReconcileResponse = { usage: StorageReconcileDTO } | { error: string };

const toIso = (value: Date | string | null | undefined) => {
    if (!value) return new Date().toISOString();
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
};

export async function POST(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<StorageReconcileResponse>> {
    try {
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgSlug } = await ctx.params;
        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const safeOrgSlug = org.orgSlug.replace(/[^a-zA-Z0-9_-]/g, '').trim();
        if (!safeOrgSlug) {
            return NextResponse.json({ error: 'Invalid orgSlug' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const dryRun = searchParams.get('dryRun') === 'true';
        const prefix = `uploads/${safeOrgSlug}/`;
        const actualBytes = await sumStorageBytes(prefix);

        const existing = await StorageUsageModel.findOne({ orgId: org._id }).lean();
        const previousBytes = existing?.bytesUsed ?? 0;

        let updatedAt = existing?.updatedAt ?? new Date();
        if (!dryRun) {
            const updated = await StorageUsageModel.findOneAndUpdate(
                { orgId: org._id },
                { $set: { bytesUsed: actualBytes, updatedAt: new Date() } },
                { new: true, upsert: true }
            );
            if (updated?.updatedAt) updatedAt = updated.updatedAt;
        }

        return NextResponse.json({
            usage: {
                prefix,
                bytesUsed: actualBytes,
                previousBytes,
                deltaBytes: actualBytes - previousBytes,
                updatedAt: toIso(updatedAt),
                checkedAt: new Date().toISOString(),
                dryRun,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
