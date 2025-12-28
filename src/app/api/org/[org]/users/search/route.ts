// app/api/org/[org]/users/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import UserModel from '@/server/models/UserModel';
import { requireOrgRole } from '@/server/org/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UserPick = { email: string; name?: string; profilePic?: string };

type SearchResp =
    | { users: Array<UserPick> }
    | { error: string };

function errMsg(e: unknown) { return e instanceof Error ? e.message : 'Server error'; }
function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<SearchResp>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const myEmail = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!myEmail) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // доступ только менеджменту
        await requireOrgRole(orgSlug, myEmail, ['owner', 'org_admin', 'manager']);

        const { searchParams } = new URL(req.url);
        const q = (searchParams.get('q') || '').trim().toLowerCase();
        const limit = Math.min(Number(searchParams.get('limit') || 8), 20);

        if (!q) return NextResponse.json({ users: [] });

        // Ищем по email (prefix) + лёгкий поиск по имени
        const emailRegex = new RegExp('^' + escapeRegex(q)); // prefix
        const nameRegex = new RegExp(escapeRegex(q), 'i');

        const users = await UserModel.find(
            { $or: [{ email: emailRegex }, { name: nameRegex }] }
        )
            .select({ email: 1, name: 1, profilePic: 1 })
            .limit(limit)
            .lean<UserPick[]>();

        return NextResponse.json({
            users: users.map(({ email, name, profilePic }) => ({ email, name, profilePic })),
        });
    } catch (e) {
        return NextResponse.json({ error: errMsg(e) }, { status: 500 });
    }
}
