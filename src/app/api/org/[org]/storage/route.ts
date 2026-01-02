import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import { requireOrgRole } from '@/server/org/permissions';
import ReportModel from '@/server/models/ReportModel';
import { ensureStorageUsage, GB_BYTES, getStorageAccess } from '@/utils/storageUsage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StorageUsageDTO = {
    totalBytes: number;
    reportBytes: number;
    attachmentBytes: number;
    limitBytes: number | null;
    includedGb: number | null;
    packageGb: number;
    hourlyCharge: number;
    overageGb: number;
    readOnly: boolean;
    readOnlyReason?: string;
    updatedAt: string;
};

type StorageUsageResponse = { usage: StorageUsageDTO } | { error: string };

const toIso = (value: Date | string | null | undefined) => {
    if (!value) return new Date().toISOString();
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
    return parsed.toISOString();
};

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<StorageUsageResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager', 'executor', 'viewer']);

        const [usage, access] = await Promise.all([
            ensureStorageUsage(org._id),
            getStorageAccess(org._id),
        ]);
        const totalBytes = usage.bytesUsed ?? 0;

        const reportAgg = await ReportModel.aggregate<{ total: number }>([
            { $match: { orgId: org._id } },
            { $group: { _id: null, total: { $sum: '$storageBytes' } } },
        ]);
        const reportBytesRaw = reportAgg?.[0]?.total ?? 0;
        const reportBytes = Math.min(reportBytesRaw, totalBytes);
        const attachmentBytes = Math.max(0, totalBytes - reportBytes);

        const limitGb = Number.isFinite(access.includedGb) ? access.includedGb : null;
        const limitBytes = limitGb && limitGb > 0 ? limitGb * GB_BYTES : null;

        return NextResponse.json({
            usage: {
                totalBytes,
                reportBytes,
                attachmentBytes,
                limitBytes,
                includedGb: limitGb,
                packageGb: access.packageGb,
                hourlyCharge: access.hourlyCharge,
                overageGb: access.overageGb,
                readOnly: access.readOnly,
                readOnlyReason: access.readOnlyReason ?? undefined,
                updatedAt: toIso(usage.updatedAt),
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
