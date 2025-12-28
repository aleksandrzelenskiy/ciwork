import { NextRequest } from 'next/server';
import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { currentUser } from '@clerk/nextjs/server';
import { handleFixUpload } from '@/server/reports/upload-fix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const user = await currentUser();

    await dbConnect();
    const result = await handleFixUpload(request, user);
    if (!result.ok) {
        return jsonError(result.error, result.status, result.data);
    }

    return jsonData(result.data);
}
