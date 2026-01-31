import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { submitDocumentReview } from '@/server/documents/review';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        await dbConnect();
        const { taskId } = await params;
        const body = (await request.json().catch(() => null)) as { changeLog?: string } | null;
        const result = await submitDocumentReview({
            taskId,
            changeLog: body?.changeLog ?? '',
        });
        if (!result.ok) {
            return jsonError(result.error, result.status);
        }
        return jsonData(result.data);
    } catch (error) {
        console.error('Ошибка при отправке документации:', error);
        return jsonError('Не удалось отправить документацию', 500);
    }
}
