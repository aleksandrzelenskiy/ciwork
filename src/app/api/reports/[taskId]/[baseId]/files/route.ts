import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import ReportModel from '@/app/models/ReportModel';
import { currentUser } from '@clerk/nextjs/server';
import { deleteTaskFile } from '@/utils/s3';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string; baseId: string }> }
) {
    try {
        await dbConnect();

        const { taskId, baseId } = await params;
        const taskIdDecoded = decodeURIComponent(taskId).toUpperCase();
        const baseIdDecoded = decodeURIComponent(baseId);

        if (!taskIdDecoded || !baseIdDecoded) {
            return NextResponse.json({ error: 'Missing parameters in URL' }, { status: 400 });
        }

        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Пользователь не авторизован' }, { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as { url?: string };
        const targetUrl = typeof body.url === 'string' ? body.url.trim() : '';
        if (!targetUrl) {
            return NextResponse.json({ error: 'URL файла обязателен' }, { status: 400 });
        }

        const report = await ReportModel.findOne({
            baseId: baseIdDecoded,
            taskId: taskIdDecoded,
        });

        if (!report) {
            return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
        }

        const beforeFiles = Array.isArray(report.files) ? (report.files as string[]) : [];
        const beforeFixedFiles = Array.isArray(report.fixedFiles)
            ? (report.fixedFiles as string[])
            : [];
        const wasInMain = beforeFiles.includes(targetUrl);
        const wasInFix = beforeFixedFiles.includes(targetUrl);

        if (!wasInMain && !wasInFix) {
            return NextResponse.json({ error: 'Файл не найден в отчёте' }, { status: 404 });
        }

        report.files = beforeFiles.filter((url) => url !== targetUrl);
        report.fixedFiles = beforeFixedFiles.filter((url) => url !== targetUrl);
        report.events = Array.isArray(report.events) ? report.events : [];
        report.events.push({
            action: 'PHOTO_REMOVED',
            author: `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim(),
            authorId: user.id,
            date: new Date(),
            details: {
                removedFrom: wasInMain ? 'main' : 'fix',
                url: targetUrl,
            },
        });

        await report.save();
        await deleteTaskFile(targetUrl);

        return NextResponse.json({
            success: true,
            files: report.files,
            fixedFiles: report.fixedFiles,
        });
    } catch (error) {
        console.error('Ошибка при удалении файла отчёта:', error);
        return NextResponse.json({ error: 'Не удалось удалить файл' }, { status: 500 });
    }
}
