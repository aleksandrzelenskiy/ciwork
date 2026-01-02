import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import { requireOrgRole } from '@/server/org/permissions';
import { listActivePackages, purchaseStoragePackage } from '@/utils/storagePackages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager', 'executor', 'viewer']);
        const packages = await listActivePackages(org._id);
        return NextResponse.json({
            packages: packages.map((pkg) => ({
                id: String(pkg._id),
                packageGb: pkg.packageGb,
                priceRubMonthly: pkg.priceRubMonthly,
                periodStart: pkg.periodStart?.toISOString?.() ?? null,
                periodEnd: pkg.periodEnd?.toISOString?.() ?? null,
                status: pkg.status,
                autoRenew: pkg.autoRenew,
            })),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin']);
        const body = (await req.json().catch(() => null)) as { quantity?: number } | null;
        const quantity = Number.isFinite(body?.quantity) ? Number(body?.quantity) : 1;

        const result = await purchaseStoragePackage(org._id, { quantity });
        if (!result.ok) {
            return NextResponse.json({ error: 'Недостаточно средств для покупки пакета' }, { status: 402 });
        }

        return NextResponse.json({
            ok: true,
            charged: result.charged,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
