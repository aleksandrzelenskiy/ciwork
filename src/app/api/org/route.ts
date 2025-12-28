// src/app/api/org/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import Membership from '@/server/models/MembershipModel';
import Subscription from '@/server/models/SubscriptionModel';
import { slugify } from '@/app/utils/slugify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

type OrganizationDTO = { _id: string; name: string; orgSlug: string };
type GetOrganizationsResponse = { orgs: OrganizationDTO[] } | { error: string };
type CreateOrgBody = { name: string; orgSlug?: string; slug?: string };
type CreateOrgResponse = { ok: true; org: OrganizationDTO } | { error: string };

// GET /api/org — организации текущего пользователя
export async function GET(): Promise<NextResponse<GetOrganizationsResponse>> {
    try {
        await dbConnect();
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const memberships = await Membership.find(
            { userEmail: email },
            { orgId: 1 } // проекция
        ).lean();

        const orgIds = memberships.map((m) => m.orgId);
        if (orgIds.length === 0) return NextResponse.json({ orgs: [] });

        const organizationsRaw = await Organization.find(
            { _id: { $in: orgIds } },
            { name: 1, orgSlug: 1 } // проекция
        ).lean();

        const orgs: OrganizationDTO[] = organizationsRaw.map((o) => ({
            _id: String(o._id),
            name: o.name,
            orgSlug: o.orgSlug,
        }));

        return NextResponse.json({ orgs });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// POST /api/org — создать организацию (поддерживает body.orgSlug и body.slug)
export async function POST(request: NextRequest): Promise<NextResponse<CreateOrgResponse>> {
    try {
        await dbConnect();
        const user = await currentUser();
        const rawEmail = user?.emailAddresses?.[0]?.emailAddress;
        const email = rawEmail?.trim().toLowerCase();
        const ownerName = user?.fullName || user?.username || 'Owner';
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const body = (await request.json()) as CreateOrgBody;
        const orgName = body?.name?.trim();
        if (!orgName || orgName.length < 2) {
            return NextResponse.json({ error: 'Укажите корректное название' }, { status: 400 });
        }

        // Приоритет: явный orgSlug (или legacy `slug`) → slugify(name)
        const provided = (body.orgSlug ?? body.slug ?? '').trim().toLowerCase();
        const candidateRaw = provided || slugify(orgName) || slugify(`org-${Date.now()}`);

        // нормализация: [a-z0-9-], без крайних дефисов, без повторов
        const base = candidateRaw
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/--+/g, '-')
            .replace(/^-+|-+$/g, '');

        if (base.length < 3) {
            return NextResponse.json(
                { error: 'Некорректный orgSlug (минимум 3 символа, латиница/цифры/дефис)' },
                { status: 400 }
            );
        }

        // (опц.) запретим зарезервированные слаги
        const reserved = new Set(['api', 'admin', 'org', 'organizations', 'project', 'projects']);
        if (reserved.has(base)) {
            return NextResponse.json({ error: `orgSlug "${base}" недоступен` }, { status: 409 });
        }

        // проверка уникальности
        let orgSlug = base;
        let i = 2;
        while (await Organization.findOne({ orgSlug }).lean()) {
            if (provided) {
                return NextResponse.json({ error: `orgSlug "${provided}" уже занят` }, { status: 409 });
            }
            orgSlug = `${base}-${i++}`;
        }

        const created = await Organization.create({
            name: orgName,
            orgSlug,
            slug: orgSlug,
            ownerEmail: email,
            createdByEmail: email,
        });

        await Membership.create({
            orgId: created._id,
            userEmail: email, // нормализованный
            userName: ownerName,
            role: 'owner',
            status: 'active',
        });

        await Subscription.create({
            orgId: created._id,
            plan: 'basic',
            status: 'inactive', // админ активирует вручную после оплаты
            seats: 10,
            projectsLimit: 10,
            note: 'Создано автоматически',
        });

        const org: OrganizationDTO = {
            _id: String(created._id),
            name: created.name,
            orgSlug: created.orgSlug,
        };

        return NextResponse.json({ ok: true, org });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
