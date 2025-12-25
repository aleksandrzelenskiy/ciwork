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

const safeFolderName = (value: string) =>
    value.replace(/[\\/]/g, '_').replace(/\s+/g, '_').trim() || 'base';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    const taskIdDecoded = decodeURIComponent(taskId).toUpperCase();

    try {
        if (!taskIdDecoded) {
            return NextResponse.json(
                { error: 'Missing required parameters' },
                { status: 400 }
            );
        }

        await dbConnect();
        const reports = await ReportModel.find({
            taskId: taskIdDecoded,
        }).lean();

        if (!Array.isArray(reports) || reports.length === 0) {
            return NextResponse.json({ error: 'Reports not found.' }, { status: 404 });
        }

        const reportEntries = reports
            .map((report) => {
                const baseId = typeof report.baseId === 'string' ? report.baseId : 'base';
                const baseFolder = safeFolderName(baseId);
                const files = Array.isArray(report.files) ? report.files : [];
                const fixedFiles = Array.isArray(report.fixedFiles) ? report.fixedFiles : [];
                return { baseFolder, files, fixedFiles };
            })
            .filter((entry) => entry.files.length > 0 || entry.fixedFiles.length > 0);

        if (reportEntries.length === 0) {
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

        return new NextResponse(webStream, { headers });
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error.' },
            { status: 500 }
        );
    }
}
