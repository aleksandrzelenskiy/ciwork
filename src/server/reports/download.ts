import 'server-only';

import path from 'path';
import archiver from 'archiver';
import { currentUser } from '@clerk/nextjs/server';
import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import { verifyInitiatorAccessToken } from '@/utils/initiatorAccessToken';

const filenameFromUrl = (fileUrl: string) => {
    try {
        const url = new URL(fileUrl);
        const pathname = url.pathname.split('?')[0];
        return decodeURIComponent(path.basename(pathname));
    } catch {
        return path.basename(fileUrl);
    }
};

const safeFolderName = (value: string) =>
    value.replace(/[\\/]/g, '_').replace(/\s+/g, '_').trim() || 'base';

const authorizeDownload = async ({
    taskIdDecoded,
    token,
    user,
    errorMessage,
}: {
    taskIdDecoded: string;
    token?: string;
    user: Awaited<ReturnType<typeof currentUser>> | null;
    errorMessage: string;
}) => {
    const trimmedToken = token?.trim() ?? '';
    const guestAccess = trimmedToken ? verifyInitiatorAccessToken(trimmedToken) : null;
    if (guestAccess) {
        const taskRecord = await TaskModel.findOne({ taskId: taskIdDecoded })
            .select('initiatorEmail')
            .lean();
        const initiatorEmail = taskRecord?.initiatorEmail?.trim().toLowerCase() || '';
        if (
            guestAccess.taskId !== taskIdDecoded ||
            !initiatorEmail ||
            initiatorEmail !== guestAccess.email
        ) {
            return { ok: false, error: errorMessage, status: 403 } as const;
        }
        return { ok: true } as const;
    }

    if (!user) {
        return { ok: false, error: 'Пользователь не авторизован', status: 401 } as const;
    }

    return { ok: true } as const;
};

export const downloadBaseReportZip = async ({
    taskId,
    baseId,
    token,
    user,
}: {
    taskId: string;
    baseId: string;
    token?: string;
    user: Awaited<ReturnType<typeof currentUser>> | null;
}) => {
    const taskIdDecoded = decodeURIComponent(taskId).toUpperCase();
    const baseIdDecoded = decodeURIComponent(baseId);

    if (!taskIdDecoded || !baseIdDecoded) {
        return { ok: false, error: 'Missing required parameters', status: 400 } as const;
    }

    const auth = await authorizeDownload({
        taskIdDecoded,
        token,
        user,
        errorMessage: 'Недостаточно прав для скачивания отчёта',
    });
    if (!auth.ok) return auth;

    const report = await ReportModel.findOne({
        taskId: taskIdDecoded,
        baseId: baseIdDecoded,
    }).lean();

    if (!report || Array.isArray(report)) {
        return { ok: false, error: 'Report not found.', status: 404 } as const;
    }

    const allFiles = [...(report.files ?? []), ...(report.fixedFiles ?? [])];
    if (allFiles.length === 0) {
        return { ok: false, error: 'No files available for download.', status: 400 } as const;
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
        throw err;
    });

    const headers = new Headers({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="report-${baseIdDecoded}.zip"`,
    });

    const webStream = new ReadableStream({
        start(controller) {
            archive.on('data', (chunk) => {
                controller.enqueue(chunk);
            });
            archive.on('end', () => {
                controller.close();
            });
            archive.on('error', (err) => {
                controller.error(err);
            });

            (async () => {
                for (const fileUrl of allFiles) {
                    const response = await fetch(fileUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${fileUrl}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    const name = filenameFromUrl(fileUrl);
                    archive.append(Buffer.from(arrayBuffer), { name });
                }
                await archive.finalize();
            })().catch((err) => {
                controller.error(err);
            });
        },
    });

    return { ok: true, data: { headers, webStream } } as const;
};

export const downloadTaskReportsZip = async ({
    taskId,
    token,
    user,
}: {
    taskId: string;
    token?: string;
    user: Awaited<ReturnType<typeof currentUser>> | null;
}) => {
    const taskIdDecoded = decodeURIComponent(taskId).toUpperCase();

    if (!taskIdDecoded) {
        return { ok: false, error: 'Missing required parameters', status: 400 } as const;
    }

    const auth = await authorizeDownload({
        taskIdDecoded,
        token,
        user,
        errorMessage: 'Недостаточно прав для скачивания отчётов',
    });
    if (!auth.ok) return auth;

    const reports = await ReportModel.find({
        taskId: taskIdDecoded,
    }).lean();

    if (!Array.isArray(reports) || reports.length === 0) {
        return { ok: false, error: 'Reports not found.', status: 404 } as const;
    }

    const reportEntries = reports
        .map((report) => {
            const baseId =
                typeof report.baseId === 'string' ? report.baseId : 'base';
            const baseFolder = safeFolderName(baseId);
            const files = Array.isArray(report.files) ? report.files : [];
            const fixedFiles = Array.isArray(report.fixedFiles) ? report.fixedFiles : [];
            return { baseFolder, files, fixedFiles };
        })
        .filter((entry) => entry.files.length > 0 || entry.fixedFiles.length > 0);

    if (reportEntries.length === 0) {
        return { ok: false, error: 'No files available for download.', status: 400 } as const;
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
        throw err;
    });

    const headers = new Headers({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="reports-${taskIdDecoded}.zip"`,
    });

    const webStream = new ReadableStream({
        start(controller) {
            archive.on('data', (chunk) => {
                controller.enqueue(chunk);
            });
            archive.on('end', () => {
                controller.close();
            });
            archive.on('error', (err) => {
                controller.error(err);
            });

            (async () => {
                for (const entry of reportEntries) {
                    for (const fileUrl of entry.files) {
                        const response = await fetch(fileUrl);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch ${fileUrl}`);
                        }
                        const arrayBuffer = await response.arrayBuffer();
                        const name = filenameFromUrl(fileUrl);
                        archive.append(Buffer.from(arrayBuffer), {
                            name: `${entry.baseFolder}/main/${name}`,
                        });
                    }
                    for (const fileUrl of entry.fixedFiles) {
                        const response = await fetch(fileUrl);
                        if (!response.ok) {
                            throw new Error(`Failed to fetch ${fileUrl}`);
                        }
                        const arrayBuffer = await response.arrayBuffer();
                        const name = filenameFromUrl(fileUrl);
                        archive.append(Buffer.from(arrayBuffer), {
                            name: `${entry.baseFolder}/fixed/${name}`,
                        });
                    }
                }
                await archive.finalize();
            })().catch((err) => {
                controller.error(err);
            });
        },
    });

    return { ok: true, data: { headers, webStream } } as const;
};
