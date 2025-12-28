import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { getReportSummariesForTask } from '@/server/reports/summary';

export async function GET(request: Request) {
    try {
        await dbConnect();
    } catch (error: unknown) {
        console.error('Failed to connect to MongoDB:', error);
        return jsonError('Failed to connect to database', 500);
    }

    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId')?.trim() || '';
    const token = url.searchParams.get('token')?.trim() || '';

    const result = await getReportSummariesForTask({ taskId, token });
    if (!result.ok) {
        return jsonError(result.error, result.status);
    }

    return jsonData({ summaries: result.summaries });
}
