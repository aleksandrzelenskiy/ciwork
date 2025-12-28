import { NextRequest } from 'next/server';
import { jsonData, jsonError } from '@/server/http/response';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import dbConnect from '@/server/db/mongoose';
import { submitReport } from '@/server/reports/submit';
import { currentUser } from '@clerk/nextjs/server';

const getActorName = (user: Awaited<ReturnType<typeof currentUser>>) => {
    if (!user) return 'Исполнитель';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    return name || user.username || user.id;
};

export async function POST(req: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return jsonError('User is not authenticated', 401);
    }

    const payload = (await req.json().catch(() => null)) as {
        taskId?: string;
        baseIds?: string[];
    } | null;

    await dbConnect();
    const result = await submitReport(
        payload ?? {},
        {
            clerkUserId: user.id,
            name: getActorName(user),
            email: user.emailAddresses?.[0]?.emailAddress,
        }
    );

    if (!result.ok) {
        return jsonError(result.error, result.status);
    }

    return jsonData(result.data);
}
