import 'server-only';

import sharp from 'sharp';
import heicConvert from 'heic-convert';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';

export type OptimizedMedia = {
    buffer: Buffer;
    filename: string;
    contentType: string;
    size: number;
    width?: number;
    height?: number;
    kind: 'image' | 'video';
    poster?: {
        buffer: Buffer;
        filename: string;
        contentType: string;
        size: number;
        width?: number;
        height?: number;
    };
};

const MAX_IMAGE_EDGE = 1920;
const IMAGE_QUALITY = 82;
const MAX_VIDEO_EDGE = 1280;
const VIDEO_CRF = 28;
const VIDEO_AUDIO_BITRATE = '128k';
const MAX_POSTER_EDGE = 640;

const getFileExtension = (name: string, fallback = '') => {
    const parts = name.split('.');
    if (parts.length < 2) return fallback;
    return parts.pop()?.toLowerCase() ?? fallback;
};

const resolveFfmpegPath = () => process.env.FFMPEG_PATH || 'ffmpeg';

const runFfmpeg = async (args: string[]): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(resolveFfmpegPath(), args);
        let stderr = '';
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
        });
        child.on('error', (error) => {
            reject(error);
        });
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(stderr || `ffmpeg exited with code ${code}`));
        });
    });
};

export const optimizeImageFile = async (file: File): Promise<OptimizedMedia> => {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = getFileExtension(file.name || '', '');
    const mime = file.type || '';
    const isHeic = /heic|heif/i.test(mime) || ['heic', 'heif'].includes(ext);
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
            console.warn('messenger media: HEIC convert failed, using original buffer.', error);
        }
    }

    try {
        const { data, info } = await sharp(sourceBuffer, { failOnError: false })
            .rotate()
            .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, {
                fit: sharp.fit.inside,
                withoutEnlargement: true,
            })
            .jpeg({ quality: IMAGE_QUALITY, mozjpeg: true, progressive: true })
            .toBuffer({ resolveWithObject: true });

        return {
            buffer: data,
            filename: `${uuidv4()}.jpg`,
            contentType: 'image/jpeg',
            size: data.length,
            width: info?.width,
            height: info?.height,
            kind: 'image',
        };
    } catch (error) {
        console.warn('messenger media: image optimization failed.', error);
        throw new Error('MEDIA_IMAGE_OPTIMIZATION_FAILED');
    }
};

export const optimizeVideoFile = async (file: File): Promise<OptimizedMedia> => {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = getFileExtension(file.name || '', 'mp4');

    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `messenger-${uuidv4()}.${ext}`);
    const outputPath = path.join(tempDir, `messenger-${uuidv4()}.mp4`);
    const posterPath = path.join(tempDir, `messenger-${uuidv4()}.jpg`);

    try {
        await fs.writeFile(inputPath, buffer);
        await runFfmpeg([
            '-y',
            '-i',
            inputPath,
            '-vf',
            `scale='min(${MAX_VIDEO_EDGE},iw)':-2`,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            String(VIDEO_CRF),
            '-c:a',
            'aac',
            '-b:a',
            VIDEO_AUDIO_BITRATE,
            '-movflags',
            '+faststart',
            outputPath,
        ]);
        await runFfmpeg([
            '-y',
            '-ss',
            '0.5',
            '-i',
            inputPath,
            '-frames:v',
            '1',
            '-vf',
            `scale='min(${MAX_POSTER_EDGE},iw)':-2`,
            posterPath,
        ]);
        const optimized = await fs.readFile(outputPath);
        let poster: OptimizedMedia['poster'] | undefined;
        try {
            const posterBuffer = await fs.readFile(posterPath);
            const posterMeta = await sharp(posterBuffer, { failOnError: false })
                .metadata()
                .catch(() => null);
            poster = {
                buffer: posterBuffer,
                filename: `${uuidv4()}.jpg`,
                contentType: 'image/jpeg',
                size: posterBuffer.length,
                width: posterMeta?.width,
                height: posterMeta?.height,
            };
        } catch (error) {
            console.warn('messenger media: poster generation failed', error);
        }
        return {
            buffer: optimized,
            filename: `${uuidv4()}.mp4`,
            contentType: 'video/mp4',
            size: optimized.length,
            kind: 'video',
            poster,
        };
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code !== 'ENOENT') {
            console.warn('messenger media: video optimization failed.', error);
        } else {
            console.warn('messenger media: ffmpeg is unavailable for video optimization.');
        }
        throw new Error('MEDIA_VIDEO_OPTIMIZATION_FAILED');
    } finally {
        await fs.rm(inputPath, { force: true });
        await fs.rm(outputPath, { force: true });
        await fs.rm(posterPath, { force: true });
    }
};
