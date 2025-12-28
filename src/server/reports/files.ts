import 'server-only';

import { currentUser } from '@clerk/nextjs/server';
import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import { deleteTaskFile } from '@/utils/s3';

type DeleteFileParams = {
    taskId: string;
    baseId: string;
    url?: string;
    user: Awaited<ReturnType<typeof currentUser>> | null;
};

const normalizeParams = (params: { taskId: string; baseId: string }) => {
    const taskIdDecoded = decodeURIComponent(params.taskId).toUpperCase();
    const baseIdDecoded = decodeURIComponent(params.baseId);
    return { taskIdDecoded, baseIdDecoded };
};

export const deleteReportFile = async ({
    taskId,
    baseId,
    url,
    user,
}: DeleteFileParams) => {
    const { taskIdDecoded, baseIdDecoded } = normalizeParams({ taskId, baseId });

    if (!taskIdDecoded || !baseIdDecoded) {
        return { ok: false, error: 'Missing parameters in URL', status: 400 } as const;
    }

    if (!user) {
        return { ok: false, error: 'Пользователь не авторизован', status: 401 } as const;
    }

    const targetUrl = typeof url === 'string' ? url.trim() : '';
    if (!targetUrl) {
        return { ok: false, error: 'URL файла обязателен', status: 400 } as const;
    }

    const report = await ReportModel.findOne({
        baseId: baseIdDecoded,
        taskId: taskIdDecoded,
    });

    if (!report) {
        return { ok: false, error: 'Отчёт не найден', status: 404 } as const;
    }

    const beforeFiles = Array.isArray(report.files) ? (report.files as string[]) : [];
    const beforeFixedFiles = Array.isArray(report.fixedFiles)
        ? (report.fixedFiles as string[])
        : [];
    const wasInMain = beforeFiles.includes(targetUrl);
    const wasInFix = beforeFixedFiles.includes(targetUrl);

    if (!wasInMain && !wasInFix) {
        return { ok: false, error: 'Файл не найден в отчёте', status: 404 } as const;
    }

    report.files = beforeFiles.filter((fileUrl) => fileUrl !== targetUrl);
    report.fixedFiles = beforeFixedFiles.filter((fileUrl) => fileUrl !== targetUrl);
    report.events = Array.isArray(report.events) ? report.events : [];
    report.events.push({
        action: 'PHOTO_REMOVED',
        author: `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim(),
        authorId: user.id,
        date: new Date(),
        details: {
            removedFrom: wasInMain ? 'main' : 'fix',
            url: targetUrl,
        },
    });

    await report.save();
    await deleteTaskFile(targetUrl);

    const task = await TaskModel.findOne({ taskId: taskIdDecoded })
        .select('status events')
        .exec();
    if (task && task.status !== 'Done') {
        if (!Array.isArray(task.events)) task.events = [];
        task.events.push({
            action: 'STATUS_CHANGED',
            author: `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim(),
            authorId: user.id,
            date: new Date(),
            details: {
                oldStatus: task.status,
                newStatus: 'Done',
                comment: 'Статус изменен после удаления фотоотчета',
            },
        });
        task.status = 'Done';
        await task.save();
    }

    return {
        ok: true,
        data: {
            success: true,
            files: report.files,
            fixedFiles: report.fixedFiles,
        },
    } as const;
};
