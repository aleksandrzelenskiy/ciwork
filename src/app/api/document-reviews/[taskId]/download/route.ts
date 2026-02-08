import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import { jsonError } from '@/server/http/response';
import { downloadAgreedDocumentPackageZip } from '@/server/documents/download';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;

    try {
        await dbConnect();

        const url = new URL(request.url);
        const token = url.searchParams.get('token')?.trim() || '';
        const user = await currentUser();

        const result = await downloadAgreedDocumentPackageZip({
            taskId,
            token,
            user,
        });
        if (!result.ok) {
            return jsonError(result.error, result.status);
        }

        return new NextResponse(result.data.webStream, { headers: result.data.headers });
    } catch (error) {
        console.error('Ошибка при скачивании согласованной документации:', error);
        return jsonError('Не удалось скачать архив документации', 500);
    }
}
