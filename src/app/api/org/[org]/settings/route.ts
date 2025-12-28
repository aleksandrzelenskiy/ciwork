// src/app/api/org/[org]/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Organization, { CompanyProfile } from '@/server/models/OrganizationModel';
import { requireOrgRole } from '@/server/org/permissions';

type OrgPlan = 'basic' | 'pro' | 'business' | 'enterprise';
type LegalForm = 'ООО' | 'ИП' | 'АО' | 'ЗАО';

const PLAN_SET = new Set<OrgPlan>(['basic', 'pro', 'business', 'enterprise']);
const LEGAL_FORM_SET = new Set<LegalForm>(['ООО', 'ИП', 'АО', 'ЗАО']);

type OrgSettingsDTO = CompanyProfile | null;

function sanitizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
}

function sanitizePlan(value: unknown): OrgPlan | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim() as OrgPlan;
    if (!PLAN_SET.has(trimmed)) return undefined;
    return trimmed;
}

function sanitizeLegalForm(value: unknown): LegalForm | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim() as LegalForm;
    if (!LEGAL_FORM_SET.has(trimmed)) return undefined;
    return trimmed;
}

function toError(e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    if (/not found/i.test(message)) return NextResponse.json({ error: 'Org not found' }, { status: 404 });
    if (/forbidden/i.test(message)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlugRaw } = await ctx.params;
        const orgSlug = orgSlugRaw?.trim().toLowerCase();

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        if (!orgSlug) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);
        const orgDoc = await Organization.findById(org._id, { companyProfile: 1 }).lean();

        return NextResponse.json({ settings: (orgDoc?.companyProfile as OrgSettingsDTO) ?? null });
    } catch (e) {
        return toError(e);
    }
}

export async function PATCH(
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlugRaw } = await ctx.params;
        const orgSlug = orgSlugRaw?.trim().toLowerCase();

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });
        if (!orgSlug) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin']);
        const body = (await req.json()) as Partial<CompanyProfile>;

        const update: CompanyProfile = {
            plan: sanitizePlan(body.plan) ?? undefined,
            legalForm: sanitizeLegalForm(body.legalForm) ?? undefined,
            organizationName: sanitizeString(body.organizationName),
            legalAddress: sanitizeString(body.legalAddress),
            inn: sanitizeString(body.inn),
            kpp: sanitizeString(body.kpp),
            ogrn: sanitizeString(body.ogrn),
            okpo: sanitizeString(body.okpo),
            bik: sanitizeString(body.bik),
            bankName: sanitizeString(body.bankName),
            correspondentAccount: sanitizeString(body.correspondentAccount),
            settlementAccount: sanitizeString(body.settlementAccount),
            directorTitle: sanitizeString(body.directorTitle),
            directorName: sanitizeString(body.directorName),
            directorBasis: sanitizeString(body.directorBasis),
            contacts: sanitizeString(body.contacts),
        };

        const updated = await Organization.findByIdAndUpdate(
            org._id,
            { $set: { companyProfile: update } },
            { new: true, projection: { companyProfile: 1 } }
        ).lean();

        if (!updated) {
            return NextResponse.json({ error: 'Org not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, settings: (updated.companyProfile as OrgSettingsDTO) ?? null });
    } catch (e) {
        return toError(e);
    }
}
