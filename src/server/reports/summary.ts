import 'server-only';

import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import { GetUserContext } from '@/server-actions/user-context';
import { verifyInitiatorAccessToken } from '@/utils/initiatorAccessToken';

export const getReportSummariesForTask = async (params: {
    taskId: string;
    token?: string;
}) => {
    const taskId = params.taskId.trim().toUpperCase();
    if (!taskId) {
        return { ok: false, error: 'Не указан идентификатор задачи', status: 400 } as const;
    }

    const trimmedToken = params.token?.trim() ?? '';
    const guestAccess = trimmedToken ? verifyInitiatorAccessToken(trimmedToken) : null;
    if (guestAccess) {
        if (guestAccess.taskId !== taskId) {
            return { ok: false, error: 'Недостаточно прав для просмотра отчетов', status: 403 } as const;
        }
        const taskRecord = await TaskModel.findOne({ taskId })
            .select('initiatorEmail')
            .lean();
        const initiatorEmail = taskRecord?.initiatorEmail?.trim().toLowerCase() || '';
        if (!initiatorEmail || initiatorEmail !== guestAccess.email) {
            return { ok: false, error: 'Недостаточно прав для просмотра отчетов', status: 403 } as const;
        }
    } else {
        const userContext = await GetUserContext();
        if (!userContext.success || !userContext.data) {
            const errorMessage = userContext.success
                ? 'Нет активной сессии пользователя'
                : userContext.message || 'Нет активной сессии пользователя';
            return { ok: false, error: errorMessage, status: 401 } as const;
        }
    }

    const reports = await ReportModel.find({ taskId })
        .select('baseId status files fixedFiles updatedAt createdAt')
        .lean();

    const summaries = reports
        .map((report) => ({
            baseId: report.baseId,
            status: report.status,
            filesCount: Array.isArray(report.files) ? report.files.length : 0,
            fixedCount: Array.isArray(report.fixedFiles) ? report.fixedFiles.length : 0,
            updatedAt: report.updatedAt
                ? new Date(report.updatedAt).toISOString()
                : report.createdAt
                  ? new Date(report.createdAt).toISOString()
                  : undefined,
        }))
        .sort((a, b) => a.baseId.localeCompare(b.baseId, 'ru'));

    return { ok: true, summaries } as const;
};
