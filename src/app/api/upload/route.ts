import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import TaskModel from '@/app/models/TaskModel';
import UserModel from '@/app/models/UserModel';
import dbConnect from '@/utils/mongoose';
import {
    uploadBuffer,
    deleteTaskFile,
    buildTaskFileKey,
    TaskFileSubfolder,
} from '@/utils/s3';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

const parseAttachmentPayload = async (request: NextRequest) => {
    const formData = await request.formData();
    const fields: Record<string, string> = {};
    const files: ParsedFile[] = [];

    for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
            const buffer = Buffer.from(await value.arrayBuffer());
            files.push({
                buffer,
                filename: value.name || 'file',
                mimetype: value.type || 'application/octet-stream',
            });
        } else {
            fields[key] = String(value);
        }
    }

    return { fields, files };
};

export async function DELETE(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'User is not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId')?.trim();
    const url = searchParams.get('url')?.trim();
    const mode = searchParams.get('mode')?.trim().toLowerCase();

    if (!taskId || !url) {
        return NextResponse.json({ error: 'taskId and url are required' }, { status: 400 });
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/upload error:', error);
        return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: 'User is not authenticated' }, { status: 401 });
    }

    const { fields, files } = await parseAttachmentPayload(request);

    if (files.length === 0) {
        return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
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

    if (!rawSubfolder || !taskIdForAttachments) {
        return NextResponse.json(
            { error: 'Photo report uploads moved to /api/reports/upload' },
            { status: 400 }
        );
    }

    try {
        await dbConnect();

        const dbUser = await UserModel.findOne({ clerkUserId: user.id }).lean().exec();
        if (!dbUser) {
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

        return NextResponse.json({
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
        return NextResponse.json({ error: 'Failed to upload attachments' }, { status: 500 });
    }
}
