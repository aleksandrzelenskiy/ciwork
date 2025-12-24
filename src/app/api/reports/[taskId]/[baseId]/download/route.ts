import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import ReportModel from '@/app/models/ReportModel';
import archiver from 'archiver';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const filenameFromUrl = (fileUrl: string) => {
    try {
        const url = new URL(fileUrl);
        const pathname = url.pathname.split('?')[0];
        return decodeURIComponent(path.basename(pathname));
    } catch {
        return path.basename(fileUrl);
    }
};

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ taskId: string; baseId: string }> }
) {
    const { taskId, baseId } = await params;
    const taskIdDecoded = decodeURIComponent(taskId).toUpperCase();
    const baseIdDecoded = decodeURIComponent(baseId);

    try {
        if (!taskIdDecoded || !baseIdDecoded) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        await dbConnect();
        const report = await ReportModel.findOne({
            taskId: taskIdDecoded,
            baseId: baseIdDecoded,
        }).lean();

        if (!report) {
            return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
        }

        const allFiles = [...(report.files ?? []), ...(report.fixedFiles ?? [])];
        if (allFiles.length === 0) {
            return NextResponse.json(
                { error: 'No files available for download.' },
                { status: 400 }
            );
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

        return new NextResponse(webStream, { headers });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error.' },
            { status: 500 }
        );
    }
}
