import 'server-only';

import sharp from 'sharp';
import ExifReader from 'exifreader';
import { v4 as uuidv4 } from 'uuid';
import heicConvert from 'heic-convert';
import OrganizationModel from '@/server/models/OrganizationModel';
import ProjectModel from '@/server/models/ProjectModel';

export type UploadPayload = {
    taskId: string;
    baseId: string;
    files: File[];
};

export const MAX_REPORT_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const MAX_REPORT_BATCH_FILES = 5;
export const MAX_REPORT_BATCH_BYTES = 20 * 1024 * 1024;

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
    'jpg',
    'jpeg',
    'png',
    'webp',
    'heic',
    'heif',
]);

export const isSupportedImage = (file: File) => {
    if (file.type?.startsWith('image/')) return true;
    const ext = file.name?.split('.').pop()?.toLowerCase() || '';
    return SUPPORTED_IMAGE_EXTENSIONS.has(ext);
};

export const validateUploadFiles = (files: File[]) => {
    if (files.length > MAX_REPORT_BATCH_FILES) {
        return {
            ok: false,
            error: `Слишком много файлов за раз. Максимум: ${MAX_REPORT_BATCH_FILES}.`,
            status: 400,
        } as const;
    }
    let totalBytes = 0;
    for (const file of files) {
        const size = Math.max(0, file.size || 0);
        if (size > MAX_REPORT_FILE_SIZE_BYTES) {
            return {
                ok: false,
                error: `Файл "${file.name}" превышает ${Math.round(
                    MAX_REPORT_FILE_SIZE_BYTES / (1024 * 1024)
                )} МБ.`,
                status: 413,
            } as const;
        }
        totalBytes += size;
    }
    if (totalBytes > MAX_REPORT_BATCH_BYTES) {
        return {
            ok: false,
            error: `Суммарный размер партии превышает ${Math.round(
                MAX_REPORT_BATCH_BYTES / (1024 * 1024)
            )} МБ.`,
            status: 413,
        } as const;
    }
    return { ok: true } as const;
};

export const normalizeTaskId = (value: string) => value.trim().toUpperCase();

export const extractUploadPayload = async (request: Request): Promise<UploadPayload> => {
    const formData = await request.formData();
    const taskIdRaw = String(formData.get('taskId') ?? '').trim();
    const baseIdRaw = String(formData.get('baseId') ?? '').trim();
    const files = Array.from(formData.values()).filter(
        (value): value is File => value instanceof File
    );
    return {
        taskId: normalizeTaskId(taskIdRaw),
        baseId: baseIdRaw,
        files,
    };
};

export const resolveStorageScope = async (task: {
    orgId?: unknown;
    projectId?: unknown;
}) => {
    const scope: {
        orgSlug?: string;
        orgName?: string;
        projectKey?: string;
        projectName?: string;
    } = {};
    const lookups: Promise<void>[] = [];

    if (task?.orgId) {
        lookups.push(
            OrganizationModel.findById(task.orgId)
                .select('orgSlug name companyProfile.organizationName')
                .lean()
                .then((org) => {
                    if (!org) return;
                    if (org.orgSlug) scope.orgSlug = org.orgSlug;
                    if (org.name) scope.orgName = org.name;
                })
                .catch(() => undefined)
        );
    }

    if (task?.projectId) {
        lookups.push(
            ProjectModel.findById(task.projectId)
                .select('key name')
                .lean()
                .then((project) => {
                    if (!project) return;
                    if (project.key) scope.projectKey = project.key;
                    if (project.name) scope.projectName = project.name;
                })
                .catch(() => undefined)
        );
    }

    if (lookups.length) {
        await Promise.all(lookups);
    }

    return scope;
};

export const buildReportKey = (params: {
    orgSlug?: string;
    projectKey?: string;
    taskId: string;
    baseId: string;
    filename: string;
    isFix?: boolean;
}) => {
    const safe = (value?: string) =>
        (value ?? '').replace(/[\\/]/g, '_').replace(/\s+/g, '_').trim();
    const parts = ['uploads'];
    const orgSlug = safe(params.orgSlug);
    const projectKey = safe(params.projectKey);
    if (orgSlug) parts.push(orgSlug);
    if (projectKey) parts.push(projectKey);
    const taskId = safe(params.taskId);
    const baseId = safe(params.baseId);
    const reportFolder = `${taskId}-reports`;
    const filename = safe(params.filename);
    parts.push(taskId, reportFolder, baseId);
    if (params.isFix) {
        parts.push('Fix');
    }
    parts.push(filename);
    return parts.join('/');
};

type OverlayContext = {
    taskId: string;
    taskName?: string | null;
    baseId?: string | null;
    bsNumber?: string | null;
    executorName?: string | null;
    orgName?: string | null;
    projectId?: string | null;
    projectKey?: string | null;
};

const escapeSvgText = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

const normalizeExifDate = (value: string) => {
    const trimmed = value.trim();
    const match = trimmed.match(
        /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (match) {
        const [, y, m, d, hh, mm, ss] = match;
        return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss ?? '00'}`);
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toNumber = (value: unknown) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    if (value && typeof value === 'object') {
        const rec = value as { numerator?: number; denominator?: number };
        if (typeof rec.numerator === 'number' && typeof rec.denominator === 'number') {
            return rec.denominator === 0 ? null : rec.numerator / rec.denominator;
        }
    }
    return null;
};

const toDecimalCoord = (parts: unknown, ref?: string | null) => {
    if (!Array.isArray(parts) || parts.length < 2) return null;
    const degrees = toNumber(parts[0]);
    const minutes = toNumber(parts[1]);
    const seconds = toNumber(parts[2] ?? 0);
    if (degrees === null || minutes === null || seconds === null) return null;
    let decimal = degrees + minutes / 60 + seconds / 3600;
    if (ref && ['S', 'W'].includes(ref)) {
        decimal *= -1;
    }
    return decimal;
};

const parseCoordFromDescription = (value: string) => {
    const numbers = value.match(/-?\d+(?:\.\d+)?/g);
    if (!numbers || numbers.length === 0) return null;
    const degrees = Number.parseFloat(numbers[0]);
    if (!Number.isFinite(degrees)) return null;
    const minutes = numbers.length > 1 ? Number.parseFloat(numbers[1]) : 0;
    const seconds = numbers.length > 2 ? Number.parseFloat(numbers[2]) : 0;
    const hasMinSec = numbers.length > 1;
    let decimal = hasMinSec ? degrees + minutes / 60 + seconds / 3600 : degrees;
    if (/[SW]/i.test(value)) {
        decimal = -Math.abs(decimal);
    }
    return decimal;
};

const readTagValue = (tag: unknown) => {
    if (!tag) return null;
    if (typeof tag === 'string' || typeof tag === 'number') return tag;
    if (typeof tag === 'object') {
        const candidate = tag as { description?: unknown; value?: unknown };
        if (typeof candidate.description === 'string' || typeof candidate.description === 'number') {
            return candidate.description;
        }
        if (candidate.value !== undefined) return candidate.value;
    }
    return null;
};

const readGpsValue = (tag: unknown) => {
    if (!tag) return null;
    if (typeof tag === 'object') {
        const candidate = tag as { value?: unknown; description?: unknown };
        if (candidate.value !== undefined) return candidate.value;
        if (typeof candidate.description === 'string' || typeof candidate.description === 'number') {
            return candidate.description;
        }
    }
    return readTagValue(tag);
};

const getExifTag = (tags: Record<string, unknown>, key: string) => {
    if (key in tags) return tags[key];
    const groups = ['gps', 'exif', 'image'] as const;
    for (const group of groups) {
        const bucket = tags[group];
        if (bucket && typeof bucket === 'object' && key in (bucket as Record<string, unknown>)) {
            return (bucket as Record<string, unknown>)[key];
        }
    }
    return null;
};

const extractOverlayMeta = (buffer: Buffer) => {
    try {
        const tags = ExifReader.load(buffer, { expanded: true }) as Record<string, unknown>;
        const dateTag =
            getExifTag(tags, 'DateTimeOriginal') ??
            getExifTag(tags, 'DateTimeDigitized') ??
            getExifTag(tags, 'DateTime');
        const dateValue = readTagValue(dateTag);
        const date =
            typeof dateValue === 'string'
                ? normalizeExifDate(dateValue)
                : dateValue instanceof Date
                    ? dateValue
                    : null;

        const latTag = getExifTag(tags, 'GPSLatitude') ?? getExifTag(tags, 'Latitude');
        const lonTag = getExifTag(tags, 'GPSLongitude') ?? getExifTag(tags, 'Longitude');
        const latRefTag = getExifTag(tags, 'GPSLatitudeRef') ?? getExifTag(tags, 'LatitudeRef');
        const lonRefTag = getExifTag(tags, 'GPSLongitudeRef') ?? getExifTag(tags, 'LongitudeRef');

        const latValue = readGpsValue(latTag);
        const lonValue = readGpsValue(lonTag);
        const latRef = readTagValue(latRefTag);
        const lonRef = readTagValue(lonRefTag);

        const lat =
            typeof latValue === 'string'
                ? parseCoordFromDescription(latValue) ?? Number.parseFloat(latValue)
                : toDecimalCoord(latValue, typeof latRef === 'string' ? latRef : null);
        const lon =
            typeof lonValue === 'string'
                ? parseCoordFromDescription(lonValue) ?? Number.parseFloat(lonValue)
                : toDecimalCoord(lonValue, typeof lonRef === 'string' ? lonRef : null);

        return {
            date,
            lat: Number.isFinite(lat) ? lat : null,
            lon: Number.isFinite(lon) ? lon : null,
        };
    } catch {
        return { date: null, lat: null, lon: null };
    }
};

const buildOverlaySvg = (params: {
    width: number;
    height: number;
    lines: string[];
}) => {
    const fontSize = Math.max(12, Math.round(params.width * 0.012));
    const lineHeight = Math.round(fontSize * 1.2);
    const padding = Math.round(fontSize * 0.45);
    const contentHeight = lineHeight * params.lines.length;
    const overlayHeight = Math.min(
        params.height,
        contentHeight + padding * 2
    );
    const textLines = params.lines.map((line, idx) => {
        const y = padding + lineHeight * (idx + 0.8);
        return `<text x="${padding}" y="${y}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#ffffff">${escapeSvgText(line)}</text>`;
    });
    return {
        svg: Buffer.from(
            `<svg width="${params.width}" height="${overlayHeight}" xmlns="http://www.w3.org/2000/svg">
                <rect x="0" y="0" width="${params.width}" height="${overlayHeight}" fill="rgba(0,0,0,0.32)" />
                ${textLines.join('')}
            </svg>`
        ),
        height: overlayHeight,
    };
};

export const prepareImageBuffer = async (file: File, overlayContext?: OverlayContext) => {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name?.split('.').pop()?.toLowerCase() || '';
    const mime = file.type || '';
    const isHeic = /heic|heif/i.test(mime) || ['heic', 'heif'].includes(ext);
    const nameBase = `${uuidv4()}.jpg`;
    const maxEdge = 2048;
    const outputQuality = 85;
    let sourceBuffer = buffer;

    if (isHeic) {
        try {
            const converted = await heicConvert({
                buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
                format: 'JPEG',
                quality: 0.92,
            });
            sourceBuffer = Buffer.from(converted);
        } catch (error) {
            console.warn('Failed to convert HEIC image, using original buffer.', error);
        }
    }
    try {
        const resized = sharp(sourceBuffer, { failOnError: false })
            .rotate()
            .resize(maxEdge, maxEdge, { fit: sharp.fit.inside, withoutEnlargement: true });
        const overlayMeta = overlayContext ? extractOverlayMeta(buffer) : null;
        const lines = overlayContext
            ? [
                `Дата: ${
                    overlayMeta?.date
                        ? overlayMeta.date.toLocaleDateString('ru-RU', { dateStyle: 'short' })
                        : new Date().toLocaleDateString('ru-RU', { dateStyle: 'short' })
                }`,
                `Организация: ${overlayContext.orgName || '—'}`,
                `ID проекта: ${overlayContext.projectKey || overlayContext.projectId || '—'}`,
                `Task ID: ${overlayContext.taskId}`,
                `Задача: ${(overlayContext.taskName || '—').trim()}`,
                `БС: ${overlayContext.baseId || overlayContext.bsNumber || '—'}`,
                `Координаты: ${
                    overlayMeta?.lat != null && overlayMeta?.lon != null
                        ? `${overlayMeta.lat.toFixed(6)}, ${overlayMeta.lon.toFixed(6)}`
                        : '—'
                }`,
                `Исполнитель: ${overlayContext.executorName || '—'}`,
            ]
            : [];
        let width = maxEdge;
        let height = maxEdge;

        if (overlayContext && lines.length > 0) {
            try {
                const { info } = await resized.clone().toBuffer({ resolveWithObject: true });
                if (info?.width) width = info.width;
                if (info?.height) height = info.height;
            } catch {
                const metadata = await resized.metadata().catch(() => null);
                if (metadata?.width) width = metadata.width;
                if (metadata?.height) height = metadata.height;
            }
        }

        const overlay =
            overlayContext && lines.length > 0
                ? buildOverlaySvg({ width, height, lines })
                : null;

        const converted = await resized
            .composite(
                overlay
                    ? [
                        {
                            input: overlay.svg,
                            top: Math.max(0, height - overlay.height),
                            left: 0,
                        },
                    ]
                    : []
            )
            .jpeg({ quality: outputQuality, mozjpeg: true, progressive: true })
            .toBuffer();
        return {
            buffer: converted,
            filename: nameBase,
            size: converted.length,
            contentType: 'image/jpeg',
        };
    } catch (error) {
        console.warn('Failed to apply overlay, retrying without it.', error);
        try {
            const fallback = await sharp(sourceBuffer, { failOnError: false })
                .rotate()
                .resize(maxEdge, maxEdge, { fit: sharp.fit.inside, withoutEnlargement: true })
                .jpeg({ quality: outputQuality, mozjpeg: true, progressive: true })
                .toBuffer();
            return {
                buffer: fallback,
                filename: nameBase,
                size: fallback.length,
                contentType: 'image/jpeg',
            };
        } catch (fallbackError) {
            console.warn('Failed to convert image to JPEG.', fallbackError);
            const fallbackExt = ext || (isHeic ? 'heic' : 'bin');
            const fallbackFilename = `${uuidv4()}.${fallbackExt}`;
            const fallbackType =
                file.type || (isHeic ? 'image/heic' : 'application/octet-stream');
            return {
                buffer: sourceBuffer,
                filename: fallbackFilename,
                size: sourceBuffer.length,
                contentType: fallbackType,
            };
        }
    }
};
