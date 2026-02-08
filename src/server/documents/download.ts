import 'server-only';

import path from 'path';
import archiver from 'archiver';
import { currentUser } from '@clerk/nextjs/server';
import { getDocumentReviewDetails } from '@/server/documents/review';

const filenameFromUrl = (fileUrl: string) => {
    try {
        const url = new URL(fileUrl);
        const pathname = url.pathname.split('?')[0];
        return decodeURIComponent(path.basename(pathname));
    } catch {
        return path.basename(fileUrl);
    }
};

const normalizeTaskId = (taskId: string) => decodeURIComponent(taskId).trim().toUpperCase();

export const downloadAgreedDocumentPackageZip = async ({
    taskId,
    token,
    user,
}: {
    taskId: string;
    token?: string;
    user: Awaited<ReturnType<typeof currentUser>> | null;
}) => {
    const taskIdDecoded = normalizeTaskId(taskId);
    if (!taskIdDecoded) {
        return { ok: false, error: 'Missing required parameters', status: 400 } as const;
    }

    if (!user && !(token?.trim() || '')) {
        return { ok: false, error: 'Пользователь не авторизован', status: 401 } as const;
    }

    const details = await getDocumentReviewDetails({ taskId: taskIdDecoded, token });
    if (!details.ok) {
        return { ok: false, error: details.error, status: details.status } as const;
    }

    const files = Array.isArray(details.data.publishedFiles)
        ? details.data.publishedFiles.filter((file) => typeof file === 'string' && file.trim())
        : [];
    if (!files.length) {
        return { ok: false, error: 'Нет файлов для скачивания', status: 400 } as const;
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
        throw err;
    });

    const usedNames = new Set<string>();
    const headers = new Headers({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="agreed-documents-${taskIdDecoded}.zip"`,
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
                for (const fileUrl of files) {
                    const response = await fetch(fileUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch ${fileUrl}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();
                    const baseName = filenameFromUrl(fileUrl) || 'file';
                    let archiveName = baseName;
                    let copyIndex = 1;
                    while (usedNames.has(archiveName)) {
                        const ext = path.extname(baseName);
                        const nameWithoutExt = ext ? baseName.slice(0, -ext.length) : baseName;
                        archiveName = `${nameWithoutExt} (${copyIndex})${ext}`;
                        copyIndex += 1;
                    }
                    usedNames.add(archiveName);
                    archive.append(Buffer.from(arrayBuffer), { name: archiveName });
                }
                await archive.finalize();
            })().catch((err) => {
                controller.error(err);
            });
        },
    });

    return { ok: true, data: { headers, webStream } } as const;
};
