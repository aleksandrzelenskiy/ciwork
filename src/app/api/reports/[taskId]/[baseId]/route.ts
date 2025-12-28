// app/api/reports/[taskId]/[baseId]/route.ts

import { jsonData, jsonError } from '@/server/http/response';
import dbConnect from '@/server/db/mongoose';
import { currentUser } from '@clerk/nextjs/server';
import { deleteReport, getReportDetails, updateReport } from '@/server/reports/base';

/**
 * GET обработчик для получения информации о конкретном отчёте.
 * Дополнительно возвращаем `role` текущего пользователя.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ taskId: string; baseId: string }> }
) {
  try {
    await dbConnect();

    const { taskId, baseId } = await params;
    const url = new URL(request.url);
    const token = url.searchParams.get('token')?.trim() || '';
    const result = await getReportDetails({ taskId, baseId, token });
    if (!result.ok) {
      return jsonError(result.error, result.status);
    }

    return jsonData(result.data);
  } catch (error) {
    console.error('Ошибка при получении отчёта:', error);
    return jsonError('Не удалось получить отчёт', 500);
  }
}

/**
 * PATCH обработчик для обновления информации о конкретном отчёте.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ taskId: string; baseId: string }> }
) {
  try {
    await dbConnect();

    const { taskId, baseId } = await params;

    const url = new URL(request.url);
    const token = url.searchParams.get('token')?.trim() || '';

    const body: {
      status?: string;
      issues?: string[];
    } = await request.json();

    const user = await currentUser();
    const result = await updateReport({
      taskId,
      baseId,
      token,
      status: body.status,
      issues: body.issues,
      user,
    });
    if (!result.ok) {
      return jsonError(result.error, result.status);
    }

    return jsonData(result.data);
  } catch (error) {
    console.error('Ошибка при обновлении отчёта:', error);
    return jsonError('Не удалось обновить отчёт', 500);
  }
}

/**
 * DELETE обработчик для удаления фотоотчёта. Доступен только менеджеру проекта.
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ taskId: string; baseId: string }> }
) {
  try {
    await dbConnect();

    const { taskId, baseId } = await params;
    const result = await deleteReport({ taskId, baseId });
    if (!result.ok) {
      return jsonError(result.error, result.status);
    }

    return jsonData(result.data);
  } catch (error) {
    console.error('Ошибка при удалении отчёта:', error);
    return jsonError('Не удалось удалить отчёт', 500);
  }
}
