import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import {
    addIssueToDocumentReview,
    commentDocumentIssue,
    resolveDocumentIssueAction,
} from '@/server/documents/review';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        await dbConnect();
        const { taskId } = await params;
        const body = (await request.json().catch(() => null)) as { text?: string } | null;
        const result = await addIssueToDocumentReview({
            taskId,
            text: body?.text ?? '',
        });
        if (!result.ok) {
            return jsonError(result.error, result.status);
        }
        return jsonData(result.data);
    } catch (error) {
        console.error('Ошибка при добавлении замечания:', error);
        return jsonError('Не удалось добавить замечание', 500);
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ taskId: string }> }
) {
    try {
        await dbConnect();
        const { taskId } = await params;
        const body = (await request.json().catch(() => null)) as
            | { action?: 'resolve' | 'comment'; issueId?: string; text?: string; type?: 'comment' | 'fix-note' }
            | null;
        if (!body?.issueId || !body?.action) {
            return jsonError('issueId and action are required', 400);
        }
        if (body.action === 'resolve') {
            const result = await resolveDocumentIssueAction({ taskId, issueId: body.issueId });
            if (!result.ok) {
                return jsonError(result.error, result.status);
            }
            return jsonData(result.data);
        }
        const result = await commentDocumentIssue({
            taskId,
            issueId: body.issueId,
            text: body.text ?? '',
            type: body.type ?? 'comment',
        });
        if (!result.ok) {
            return jsonError(result.error, result.status);
        }
        return jsonData(result.data);
    } catch (error) {
        console.error('Ошибка при обновлении замечания:', error);
        return jsonError('Не удалось обновить замечание', 500);
    }
}
