import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { uploadDocumentReviewFiles } from '@/server/documents/review';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        await dbConnect();
        const { taskId } = await params;
        const result = await uploadDocumentReviewFiles(request, taskId);
        if (!result.ok) {
            return jsonError(result.error, result.status);
        }
        return jsonData(result.data);
    } catch (error) {
        console.error('Ошибка при загрузке документации:', error);
        return jsonError('Не удалось загрузить документацию', 500);
    }
}
