// pages/api/upload.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import sharp from 'sharp';
import ExifReader from 'exifreader';
import Report from '@/app/models/ReportModel';
import User from '@/app/models/UserModel';
import TaskModel from '@/app/models/TaskModel';
import dbConnect from '@/utils/mongoose';
import { uploadBuffer, deleteTaskFile, buildTaskFileKey, TaskFileSubfolder } from '@/utils/s3';
import { v4 as uuidv4 } from 'uuid';
import Busboy from 'busboy';
import type { FileInfo } from 'busboy';
import { sendEmail } from '@/utils/mailer';
import path from 'path';

export const config = {
    api: {
        bodyParser: false,
        sizeLimit: '100mb',
    },
};

function toDMS(
    degrees: number,
    minutes: number,
    seconds: number,
    isLatitude: boolean
): string {
    const direction = isLatitude ? (degrees >= 0 ? 'N' : 'S') : (degrees >= 0 ? 'E' : 'W');
    const absDeg = Math.abs(degrees);
    return `${absDeg}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`;
}

function formatDateToDDMMYYYY(exifDateStr: string): string {
    const [datePart] = exifDateStr.split(' ');
    const [yyyy, mm, dd] = datePart.split(':');
    return `${dd}.${mm}.${yyyy}`;
}

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

            const user = await User.findOne({ clerkUserId: userId }).lean().exec();
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

    // режим ФОТООТЧЕТОВ
    try {
        await dbConnect();
    } catch (e) {
        console.error('DB connect error:', e);
        return res.status(500).json({ error: 'Database connection error' });
    }

    // для фотоотчётов нам нужен юзер из БД
    const user = await User.findOne({ clerkUserId: userId });
    if (!user) {
        console.error('User not found in database');
        return res.status(401).json({ error: 'User not found in database' });
    }
    const name = user.name || 'Unknown';

    const rawBaseId = fields.baseId;
    const rawTask = fields.task;
    const normalizedTaskId = ((fields.taskId ?? rawTask) || '').trim();
    const taskId = normalizedTaskId || 'unknown';

    if (!rawBaseId || !rawTask) {
        console.error('Validation error: Base ID or Task is missing');
        return res.status(400).json({ error: 'Base ID or Task is missing' });
    }

    const baseId = decodeURIComponent(rawBaseId).trim();
    const task = decodeURIComponent(rawTask).trim();

    const initiatorIdFromForm = fields.initiatorId ?? null;
    let initiatorId = fields.initiatorId || 'unknown';
    let initiatorName = fields.initiatorName || 'unknown';

    try {
        if (initiatorIdFromForm) {
            const initiatorUser = await User.findOne({
                clerkUserId: initiatorIdFromForm,
            });
            if (initiatorUser) {
                initiatorId = initiatorUser.clerkUserId;
                initiatorName = initiatorUser.name;
            } else {
                console.warn('Initiator user not found in database');
            }
        }
    } catch (error) {
        console.error('Error fetching initiator user:', error);
    }

    const fileUrls: string[] = [];

    for (const f of files) {
        let date = 'Unknown Date';
        let coordinates = 'Unknown Location';

        try {
            const tags = ExifReader.load(f.buffer);
            if (tags.DateTimeOriginal?.description) {
                date = formatDateToDDMMYYYY(tags.DateTimeOriginal.description);
            }

            const latitudeRaw = tags.GPSLatitude?.value;
            const longitudeRaw = tags.GPSLongitude?.value;

            if (
                Array.isArray(latitudeRaw) &&
                latitudeRaw.length === 3 &&
                Array.isArray(latitudeRaw[0]) &&
                Array.isArray(longitudeRaw) &&
                longitudeRaw.length === 3 &&
                Array.isArray(longitudeRaw[0])
            ) {
                const latitude = latitudeRaw as [
                    [number, number],
                    [number, number],
                    [number, number]
                ];
                const longitude = longitudeRaw as [
                    [number, number],
                    [number, number],
                    [number, number]
                ];

                const latDeg = latitude[0][0];
                const latMin = latitude[1][0];
                const latSec = latitude[2][0] / 100;

                const lonDeg = longitude[0][0];
                const lonMin = longitude[1][0];
                const lonSec = longitude[2][0] / 100;

                const latDMS = toDMS(latDeg, latMin, latSec, true);
                const lonDMS = toDMS(lonDeg, lonMin, lonSec, false);

                coordinates = `${latDMS} | ${lonDMS}`;
            }
        } catch (error) {
            console.warn('Error reading Exif data:', error);
        }

        const uniqueId = uuidv4();
        const outputFilename = `${baseId}-${uniqueId}.jpg`;

        try {
            const { data: resizedBuffer, info } = await sharp(f.buffer)
                .rotate()
                .resize(1920, 1920, {
                    fit: sharp.fit.inside,
                    withoutEnlargement: true,
                })
                .toBuffer({ resolveWithObject: true });

            const overlayHeight = 80;
            const overlaySvg = `
<svg width="${info.width}" height="${overlayHeight}">
  <rect width="100%" height="100%" fill="black" opacity="0.6"/>
  <text x="20" y="30" font-size="24" font-family="Arial" fill="white">
    ${date} | Task: ${task} | BS: ${baseId}
  </text>
  <text x="20" y="60" font-size="24" font-family="Arial" fill="white">
    Location: ${coordinates} | Executor: ${name}
  </text>
</svg>`;

            const processedBuffer = await sharp(resizedBuffer)
                .composite([{ input: Buffer.from(overlaySvg), gravity: 'south' }])
                .jpeg({ quality: 80 })
                .toBuffer();

            const safeBaseFolder =
                baseId.replace(/[\\/]/g, '_').replace(/\s+/g, '_').replace(/\.+/g, '.').trim() || 'base';
            const safeTaskFolder =
                (taskId || task || 'task').replace(/[\\/]/g, '_').replace(/\s+/g, '_').trim() || 'task';
            const reportFolder = `${safeTaskFolder}/${safeTaskFolder}-report/${safeBaseFolder}`;
            const s3Key = `${reportFolder}/${outputFilename}`;
            const fileUrl = await uploadBuffer(processedBuffer, s3Key, 'image/jpeg');
            fileUrls.push(fileUrl);
        } catch (error) {
            console.error('Error processing or uploading image:', error);
            return res.status(500).json({ error: 'Error processing one or more images' });
        }
    }

    try {
        let report = await Report.findOne({ reportId: taskId, task, baseId });

        if (report) {
            report.files.push(...fileUrls);
            report.events.push({
                action: 'REPORT_UPDATED',
                author: name,
                authorId: user.clerkUserId,
                date: new Date(),
                details: {
                    newFiles: fileUrls.length,
                    comment: 'Additional photos uploaded',
                },
            });
            report.status = 'Pending';
            await report.save();
        } else {
            report = new Report({
                reportId: taskId,
                task,
                baseId,
                executorId: user.clerkUserId,
                executorName: name,
                initiatorId,
                initiatorName,
                userAvatar: user.profilePic || '',
                createdAt: new Date(),
                status: 'Pending',
                files: fileUrls,
                events: [
                    {
                        action: 'REPORT_CREATED',
                        author: name,
                        authorId: user.clerkUserId,
                        date: new Date(),
                        details: { fileCount: fileUrls.length },
                    },
                ],
            });
            await report.save();
        }

        const relatedTask = await TaskModel.findOne({ taskId: report.reportId });
        if (relatedTask) {
            const oldStatus = relatedTask.status;
            relatedTask.status = 'Pending';

            // гарантируем массив событий у связанной задачи
            if (!Array.isArray(relatedTask.events)) {
                relatedTask.events = [];
            }

            relatedTask.events.push({
                action: 'STATUS_CHANGED',
                author: name,
                authorId: user.clerkUserId,
                date: new Date(),
                details: {
                    oldStatus,
                    newStatus: 'Pending',
                    comment: 'Статус изменен после загрузки фотоотчета',
                },
            });

            await relatedTask.save();
        }

        // уведомления авторам/исполнителям
        try {
            const frontendUrl = process.env.FRONTEND_URL || 'https://ciwork.ru';
            const taskLink = `${frontendUrl}/tasks/${relatedTask?.taskId}`;
            const recipients = [relatedTask?.authorEmail, relatedTask?.executorEmail]
                .filter((email) => !!email)
                .filter((v, i, arr) => arr.indexOf(v) === i);

            for (const email of recipients) {
                let roleText = `Информация по задаче "${relatedTask?.taskName} ${relatedTask?.bsNumber}" (${relatedTask?.taskId}).`;
                if (email === relatedTask?.authorEmail)
                    roleText = `Вы получили это письмо как автор задачи "${relatedTask?.taskName} ${relatedTask?.bsNumber}" (${relatedTask?.taskId}).`;
                if (email === relatedTask?.executorEmail)
                    roleText = `Вы получили это письмо как исполнитель задачи "${relatedTask?.taskName} ${relatedTask?.bsNumber}" (${relatedTask?.taskId}).`;

                const html = `
<p>${roleText}</p>
<p>Статус задачи <strong>${relatedTask?.taskId}</strong> был изменён на <strong>Pending</strong></p>
<p>Автор изменения: ${name}</p>
<p>Комментарий: Статус изменён после загрузки фотоотчёта</p>
<p><a href="${taskLink}">Перейти к задаче</a></p>
<p>Исполнитель задачи ${relatedTask?.taskId}, ${name} добавил фотоотчёт о выполненной работе.</p>
<p>Ссылка на фотоотчёт доступна на <a href="${taskLink}">странице задачи</a></p>`;

                await sendEmail({
                    to: email!,
                    subject: `Статус задачи "${relatedTask?.taskName} ${relatedTask?.bsNumber}" (${relatedTask?.taskId}) изменён`,
                    text: `${roleText}\n\nСсылка на задачу: ${taskLink}`,
                    html,
                });
            }
        } catch (error) {
            console.error('Ошибка при отправке уведомлений:', error);
        }

        return res.status(200).json({
            success: true,
            mode: 'reports',
            message: `Photo ${task} | Base ID: ${baseId} uploaded successfully`,
            paths: fileUrls,
        });
    } catch (error) {
        console.error('Error saving report to database:', error);
        return res.status(500).json({ error: 'Failed to save report' });
    }
}
