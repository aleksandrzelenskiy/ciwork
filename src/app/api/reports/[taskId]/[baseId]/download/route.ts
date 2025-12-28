import { NextRequest, NextResponse } from 'next/server';
import { jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { currentUser } from '@clerk/nextjs/server';
import { downloadBaseReportZip } from '@/server/reports/download';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string; baseId: string }> }
) {
    const { taskId, baseId } = await params;

    try {
        await dbConnect();

        const url = new URL(request.url);
        const token = url.searchParams.get('token')?.trim() || '';
        const user = await currentUser();
        const result = await downloadBaseReportZip({
            taskId,
            baseId,
            token,
            user,
        });
        if (!result.ok) {
            return jsonError(result.error, result.status);
        }

        return new NextResponse(result.data.webStream, { headers: result.data.headers });
    } catch (error) {
        console.error('Error:', error);
        return jsonError('Internal Server Error.', 500);
    }
}
