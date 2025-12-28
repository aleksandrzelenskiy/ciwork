import { NextRequest } from 'next/server';
import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { currentUser } from '@clerk/nextjs/server';
import { handleReportUpload } from '@/server/reports/upload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const user = await currentUser();

    await dbConnect();

    const result = await handleReportUpload(request, user);
    if (!result.ok) {
        return jsonError(result.error ?? 'Unknown error', result.status ?? 500, result.data);
    }

    return jsonData(result.data);
}
