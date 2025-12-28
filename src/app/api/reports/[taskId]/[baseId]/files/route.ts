import { NextRequest } from 'next/server';
import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { currentUser } from '@clerk/nextjs/server';
import { deleteReportFile } from '@/server/reports/files';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string; baseId: string }> }
) {
    try {
        await dbConnect();

        const { taskId, baseId } = await params;

        const user = await currentUser();

        const body = (await request.json().catch(() => ({}))) as { url?: string };
        const result = await deleteReportFile({
            taskId,
            baseId,
            url: body.url,
            user,
        });
        if (!result.ok) {
            return jsonError(result.error, result.status);
        }

        return jsonData(result.data);
    } catch (error) {
        console.error('Ошибка при удалении файла отчёта:', error);
        return jsonError('Не удалось удалить файл', 500);
    }
}
