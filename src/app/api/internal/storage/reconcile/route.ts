import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import OrganizationModel from '@/server/models/OrganizationModel';
import StorageUsageModel from '@/server/models/StorageUsageModel';
import { sumStorageBytesByOrg } from '@/utils/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sanitizeOrgSlug = (value: string): string =>
    value.replace(/[^a-zA-Z0-9_-]/g, '').trim();

export async function POST(request: NextRequest) {
    const secret = process.env.STORAGE_RECONCILE_CRON_SECRET ?? process.env.BILLING_CRON_SECRET;
    const provided = request.headers.get('x-cron-secret');
    if (!secret || provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const orgs = await OrganizationModel.find({}, { _id: 1, orgSlug: 1 }).lean();
    const slugs = orgs.map((org) => org.orgSlug).filter(Boolean);
    const totals = await sumStorageBytesByOrg(slugs);
    const now = new Date();

    const ops = orgs
        .map((org) => {
            const safeSlug = sanitizeOrgSlug(org.orgSlug ?? '');
            const bytes = safeSlug ? (totals.get(safeSlug) ?? 0) : 0;
            return {
                updateOne: {
                    filter: { orgId: org._id },
                    update: { $set: { bytesUsed: bytes, updatedAt: now }, $setOnInsert: { orgId: org._id } },
                    upsert: true,
                },
            };
        })
        .filter(Boolean);

    if (!ops.length) {
        return NextResponse.json({ ok: true, processed: 0, modified: 0, upserted: 0 });
    }

    const result = await StorageUsageModel.bulkWrite(ops, { ordered: false });

    return NextResponse.json({
        ok: true,
        processed: ops.length,
        modified: result.modifiedCount,
        upserted: result.upsertedCount,
    });
}
