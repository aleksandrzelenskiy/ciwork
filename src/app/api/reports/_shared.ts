import sharp from 'sharp';
import ExifReader from 'exifreader';
import { v4 as uuidv4 } from 'uuid';
import heicConvert from 'heic-convert';
import OrganizationModel from '@/app/models/OrganizationModel';
import ProjectModel from '@/app/models/ProjectModel';

export type UploadPayload = {
    taskId: string;
    baseId: string;
    files: File[];
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
                    const orgName = org.companyProfile?.organizationName || org.name;
                    if (orgName) scope.orgName = orgName;
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

        const latTag = getExifTag(tags, 'GPSLatitude');
        const lonTag = getExifTag(tags, 'GPSLongitude');
        const latRefTag = getExifTag(tags, 'GPSLatitudeRef');
        const lonRefTag = getExifTag(tags, 'GPSLongitudeRef');

        const latValue = readTagValue(latTag);
        const lonValue = readTagValue(lonTag);
        const latRef = readTagValue(latRefTag);
        const lonRef = readTagValue(lonRefTag);

        const lat =
            typeof latValue === 'string'
                ? Number.parseFloat(latValue)
                : toDecimalCoord(latValue, typeof latRef === 'string' ? latRef : null);
        const lon =
            typeof lonValue === 'string'
                ? Number.parseFloat(lonValue)
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
    const fontSize = Math.max(20, Math.round(params.width * 0.02));
    const lineHeight = fontSize + Math.round(fontSize * 0.4);
    const padding = Math.round(fontSize * 0.6);
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
                <rect x="0" y="0" width="${params.width}" height="${overlayHeight}" fill="rgba(0,0,0,0.55)" />
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
        const metadata = await resized.metadata();
        const width = metadata.width ?? maxEdge;
        const height = metadata.height ?? maxEdge;
        const overlayMeta = overlayContext ? extractOverlayMeta(buffer) : null;
        const lines = overlayContext
            ? [
                `Дата: ${
                    overlayMeta?.date
                        ? overlayMeta.date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
                        : new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
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
            return {
                buffer: sourceBuffer,
                filename: nameBase,
                size: sourceBuffer.length,
                contentType: isHeic ? 'image/jpeg' : file.type || 'application/octet-stream',
            };
        }
    }
};
