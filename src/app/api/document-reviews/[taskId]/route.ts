import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { getDocumentReviewDetails } from '@/server/documents/review';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        await dbConnect();
        const { taskId } = await params;
        const url = new URL(request.url);
        const token = url.searchParams.get('token')?.trim() || '';
        const result = await getDocumentReviewDetails({ taskId, token });
        if (!result.ok) {
            return jsonError(result.error, result.status);
        }
        return jsonData(result.data);
    } catch (error) {
        console.error('Ошибка при получении документации:', error);
        return jsonError('Не удалось получить документацию', 500);
    }
}
