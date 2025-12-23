// app/api/reports/[taskId]/[baseId]/download/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Report from '@/app/models/ReportModel';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { IReport } from '@/app/types/reportTypes';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; baseId: string }> }
) {
  const { taskId, baseId } = await params;
  const taskIdDecoded = decodeURIComponent(taskId);
  const baseIdDecoded = decodeURIComponent(baseId);

  try {
    if (!taskIdDecoded || !baseIdDecoded) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    await dbConnect();
    const report = await Report.findOne({
      baseId: baseIdDecoded,
      $or: [
        { taskId: taskIdDecoded },
        { reportId: taskIdDecoded },
        { task: taskIdDecoded },
      ],
    }).lean<IReport>();

    if (!report) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }

    const allFiles = [...report.files, ...report.fixedFiles];
    if (allFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files available for download.' },
        { status: 400 }
      );
    }

    // Создаем архив
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      throw err;
    });

    // Заголовки для ответа
    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="report-${baseIdDecoded}.zip"`,
    });

    // Готовим поток данных (ReadableStream), куда собираем zip
    const webStream = new ReadableStream({
      start(controller) {
        // При каждом новом куске архива — отдаем его в поток
        archive.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        // Когда архив завершен — закрываем поток
        archive.on('end', () => {
          controller.close();
        });

        // Если возникает ошибка — пробрасываем ее в стрим
        archive.on('error', (err) => {
          controller.error(err);
        });

        // Добавляем все файлы в архив
        for (const filePath of allFiles) {
          const absolutePath = path.join(process.cwd(), 'public', filePath);
          if (fs.existsSync(absolutePath)) {
            archive.file(absolutePath, { name: path.basename(filePath) });
          }
        }

        // Стартуем финализацию архива
        archive.finalize();
      },
    });

    // Возвращаем поток зип-архива
    return new NextResponse(webStream, { headers });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
