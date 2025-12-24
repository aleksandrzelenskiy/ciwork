// pages/api/upload.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import TaskModel from '@/app/models/TaskModel';
import UserModel from '@/app/models/UserModel';
import dbConnect from '@/utils/mongoose';
import { uploadBuffer, deleteTaskFile, buildTaskFileKey, TaskFileSubfolder } from '@/utils/s3';
import Busboy from 'busboy';
import type { FileInfo } from 'busboy';
import path from 'path';

export const config = {
    api: {
        bodyParser: false,
        sizeLimit: '100mb',
    },
};

type ParsedFile = {
    buffer: Buffer;
    filename: string;
    mimetype: string;
};

const SUSPECT_LATIN1_PATTERN = /[ÃÐÒÑÂäöüÄÖÜß]/;

// пробуем восстановить UTF-8 из latin1, если видим типичные артефакты
function decodeMaybeLatin1(value: string): string {
    if (!SUSPECT_LATIN1_PATTERN.test(value)) return value;
    try {
        const decoded = Buffer.from(value, 'latin1').toString('utf8');
        return decoded || value;
    } catch {
        return value;
    }
}

// безопасно приводим имя файла
function safeBasename(name: string): string {
    const base = path.basename(name).replace(/[\r\n]/g, '_');
    return decodeMaybeLatin1(base);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'DELETE') {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ error: 'User is not authenticated' });
        }

        const taskId = (req.query.taskId as string | undefined)?.trim();
        const url = (req.query.url as string | undefined)?.trim();
        const mode = (req.query.mode as string | undefined)?.trim().toLowerCase();

        if (!taskId || !url) {
            return res.status(400).json({ error: 'taskId and url are required' });
        }

        try {
            await dbConnect();
            // убираем URL из attachments
            const pullQuery: Record<string, string> = { attachments: url };
            if (mode === 'documents') {
                pullQuery.documents = url;
            }
            await TaskModel.updateOne({ taskId }, { $pull: pullQuery }).exec();

            // удаляем сам файл
            await deleteTaskFile(url);

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error('DELETE /api/upload error:', error);
            return res.status(500).json({ error: 'Failed to delete attachment' });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('>>>> /api/upload called', new Date().toISOString());

    const { userId } = getAuth(req);
    if (!userId) {
        console.error('Authentication error: User is not authenticated');
        return res.status(401).json({ error: 'User is not authenticated' });
    }

    const fields: Record<string, string> = {};
    const files: ParsedFile[] = [];

    try {
        const bb = Busboy({ headers: req.headers });

        bb.on('field', (fieldName: string, val: string) => {
            fields[fieldName] = val;
        });

        bb.on('file', (_field: string, stream, info: FileInfo) => {
            const filename = info?.filename ?? 'file';
            const mimeType =
                (info as FileInfo & { mimeType?: string }).mimeType ??
                'application/octet-stream';

            const chunks: Buffer[] = [];
            stream.on('data', (c: Buffer) => chunks.push(c));
            stream.on('end', () => {
                files.push({
                    buffer: Buffer.concat(chunks),
                    filename,
                    mimetype: mimeType,
                });
            });
        });

        await new Promise<void>((resolve, reject) => {
            bb.on('finish', resolve);
            bb.on('error', reject);
            req.pipe(bb);
        });

        if (files.length === 0) {
            console.error('Validation error: No files uploaded');
            return res.status(400).json({ error: 'No files uploaded' });
        }
    } catch (err) {
        console.error('Multipart parse error:', err);
        return res.status(400).json({ error: 'Invalid multipart form data' });
    }

    // РЕЖИМ ВЛОЖЕНИЙ К ЗАДАЧЕ / ДОКУМЕНТОВ
    const rawSubfolder = fields.subfolder?.trim();
    const taskIdForAttachments = fields.taskId?.trim();
    const orgSlug = fields.orgSlug?.trim();
    const projectKey = fields.projectKey?.trim();
    const allowedSubfolders: TaskFileSubfolder[] = [
        'estimate',
        'attachments',
        'order',
        'comments',
        'ncw',
        'documents',
    ];
    const subfolder: TaskFileSubfolder =
        allowedSubfolders.includes(rawSubfolder as TaskFileSubfolder)
            ? (rawSubfolder as TaskFileSubfolder)
            : 'attachments';

    if (rawSubfolder && taskIdForAttachments) {
        try {
            await dbConnect();

            const user = await UserModel.findOne({ clerkUserId: userId }).lean().exec();
            if (!user) {
                console.warn(
                    '[upload attachments] user not found in database, but continuing upload for task attachments'
                );
            }

            const uploadedUrls: string[] = [];
            const targetField = subfolder === 'documents' ? 'documents' : 'attachments';

            for (const f of files) {
                const filename = safeBasename(f.filename || 'file');

                const key = buildTaskFileKey(taskIdForAttachments, subfolder, filename, {
                    orgSlug: orgSlug || undefined,
                    projectKey: projectKey || undefined,
                });

                const url = await uploadBuffer(
                    f.buffer,
                    key,
                    f.mimetype || 'application/octet-stream'
                );

                uploadedUrls.push(url);
            }

            if (uploadedUrls.length) {
                await TaskModel.updateOne(
                    { taskId: taskIdForAttachments },
                    {
                        $push: {
                            [targetField]: {
                                $each: uploadedUrls,
                            },
                        },
                    }
                ).exec();
            }

            return res.status(200).json({
                success: true,
                mode: targetField,
                message: `Uploaded ${uploadedUrls.length} file(s) to ${subfolder}`,
                subfolder,
                taskId: taskIdForAttachments,
                orgSlug: orgSlug || null,
                urls: uploadedUrls,
            });
        } catch (error) {
            console.error('Attachment upload error:', error);
            return res.status(500).json({ error: 'Failed to upload attachments' });
        }
    }

    return res.status(400).json({
        error: 'Photo report uploads moved to /api/reports/upload',
    });
}