// app/api/org/[org]/members/[memberId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Membership from '@/server/models/MembershipModel';
import { requireOrgRole } from '@/server/org/permissions';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';

function errorMessage(err: unknown) {
    return err instanceof Error ? err.message : 'Server error';
}

// DELETE участника
export async function DELETE(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string; memberId: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlug, memberId } = await ctx.params;

        const me = await currentUser();
        const meEmail = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!meEmail) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, meEmail, ['owner', 'org_admin']);

        if (!Types.ObjectId.isValid(memberId)) {
            return NextResponse.json({ error: 'Некорректный memberId' }, { status: 400 });
        }

        const m = await Membership.findOne({ _id: memberId, orgId: org._id });
        if (!m) return NextResponse.json({ error: 'Участник не найден' }, { status: 404 });

        if (m.role === 'owner') {
            return NextResponse.json({ error: 'Нельзя удалить владельца организации' }, { status: 403 });
        }

        await Membership.deleteOne({ _id: m._id });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

//  PATCH: изменить роль
export async function PATCH(
    req: NextRequest,
    ctx: { params: Promise<{ org: string; memberId: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlug, memberId } = await ctx.params;

        const me = await currentUser();
        const meEmail = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!meEmail) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, meEmail, ['owner', 'org_admin']);

        if (!Types.ObjectId.isValid(memberId)) {
            return NextResponse.json({ error: 'Некорректный memberId' }, { status: 400 });
        }

        const body = (await req.json().catch(() => null)) as { role?: string } | null;
        const roleFromBody = body?.role;

        const allowedRoles: OrgRole[] = ['owner', 'org_admin', 'manager', 'executor', 'viewer'];
        if (!roleFromBody || !allowedRoles.includes(roleFromBody as OrgRole)) {
            return NextResponse.json({ error: 'Некорректная роль' }, { status: 400 });
        }

        const m = await Membership.findOne({ _id: memberId, orgId: org._id });
        if (!m) return NextResponse.json({ error: 'Участник не найден' }, { status: 404 });

        // нельзя менять роль владельца
        if (m.role === 'owner') {
            return NextResponse.json({ error: 'Нельзя изменить роль владельца организации' }, { status: 403 });
        }

        // запрещаем назначать owner этим роутом
        if (roleFromBody === 'owner') {
            return NextResponse.json({ error: 'Нельзя назначить владельцем таким способом' }, { status: 403 });
        }

        m.role = roleFromBody as OrgRole;
        await m.save();

        // приводим _id к строке
        const memberIdStr =
            typeof m._id === 'string'
                ? m._id
                : (m._id as Types.ObjectId).toHexString();

        return NextResponse.json({ ok: true, member: { _id: memberIdStr, role: m.role } });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
