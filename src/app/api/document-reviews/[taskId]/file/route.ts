import { jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { deleteDocumentReviewFile, getDocumentReviewDetails } from '@/server/documents/review';
import { fetchFileByPublicUrl } from '@/utils/s3';
import { extractFileNameFromUrl } from '@/utils/taskFiles';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        await dbConnect();
        const { taskId } = await params;
        const url = new URL(request.url);
        const fileUrl = url.searchParams.get('url')?.trim() || '';
        const download = url.searchParams.get('download') === '1';
        const token = url.searchParams.get('token')?.trim() || '';

        if (!fileUrl) {
            return jsonError('File url is required', 400);
        }

        const details = await getDocumentReviewDetails({ taskId, token });
        if (!details.ok) {
            return jsonError(details.error, details.status);
        }

        const allowedFiles = new Set([
            ...(details.data.publishedFiles ?? []),
            ...(details.data.previousFiles ?? []),
        ]);
        if (details.data.role === 'executor' || details.data.role === 'manager') {
            (details.data.currentFiles ?? []).forEach((file) => allowedFiles.add(file));
        }
        if (!allowedFiles.has(fileUrl)) {
            return jsonError('Недостаточно прав для файла', 403);
        }

        const file = await fetchFileByPublicUrl(fileUrl);
        if (!file) {
            return jsonError('Файл не найден', 404);
        }

        const filename = extractFileNameFromUrl(fileUrl, 'file');
        const headers = new Headers();
        headers.set('Content-Type', file.contentType || 'application/octet-stream');
        if (file.contentLength) {
            headers.set('Content-Length', String(file.contentLength));
        }
        const disposition = download ? 'attachment' : 'inline';
        headers.set(
            'Content-Disposition',
            `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`
        );

        return new Response(file.buffer, { headers });
    } catch (error) {
        console.error('Ошибка при получении файла документации:', error);
        return jsonError('Не удалось получить файл', 500);
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        await dbConnect();
        const { taskId } = await params;
        const url = new URL(request.url);
        const fileUrl = url.searchParams.get('url')?.trim() || '';
        if (!fileUrl) {
            return jsonError('File url is required', 400);
        }
        const result = await deleteDocumentReviewFile({ taskId, url: fileUrl });
        if (!result.ok) {
            return jsonError(result.error || 'Не удалось удалить файл', result.status);
        }
        return new Response(JSON.stringify(result.data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Ошибка при удалении файла документации:', error);
        return jsonError('Не удалось удалить файл', 500);
    }
}
