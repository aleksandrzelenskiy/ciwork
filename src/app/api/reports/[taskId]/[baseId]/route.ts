// app/api/reports/[taskId]/[baseId]/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import ReportModel from '@/app/models/ReportModel';
import TaskModel from '@/app/models/TaskModel';
import ProjectModel from '@/app/models/ProjectModel';
import ReportDeletionLog from '@/app/models/ReportDeletionLog';
import UserModel from '@/app/models/UserModel';
import { createNotification } from '@/app/utils/notificationService';
import { currentUser } from '@clerk/nextjs/server';
import { GetUserContext } from '@/server-actions/user-context';
import { mapRoleToLegacy } from '@/utils/roleMapping';
import { verifyInitiatorAccessToken } from '@/utils/initiatorAccessToken';
import path from 'path';
import {
  deleteStoragePrefix,
  deleteTaskFile,
  storageKeyFromPublicUrl,
} from '@/utils/s3';
import { adjustStorageBytes } from '@/utils/storageUsage';

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
    const taskIdDecoded = decodeURIComponent(taskId).toUpperCase();
    const baseIdDecoded = decodeURIComponent(baseId);

    if (!taskIdDecoded || !baseIdDecoded) {
      return NextResponse.json(
          { error: 'Missing parameters in URL' },
          { status: 400 }
      );
    }

    const report = await ReportModel.findOne({
      baseId: baseIdDecoded,
      taskId: taskIdDecoded,
    });

    if (!report) {
      return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
    }

    const taskRecord = await TaskModel.findOne({ taskId: taskIdDecoded })
      .select('taskName bsNumber executorName initiatorEmail initiatorName')
      .lean();

    const url = new URL(request.url);
    const token = url.searchParams.get('token')?.trim() || '';
    const guestAccess = token ? verifyInitiatorAccessToken(token) : null;
    const initiatorEmail = taskRecord?.initiatorEmail?.trim().toLowerCase() || '';
    const isGuestAllowed =
        !!guestAccess &&
        guestAccess.taskId === taskIdDecoded &&
        initiatorEmail &&
        initiatorEmail === guestAccess.email;

    let role: ReturnType<typeof mapRoleToLegacy> = null;
    if (isGuestAllowed) {
      role = 'viewer';
    } else {
      const userContext = await GetUserContext();
      if (!userContext.success || !userContext.data) {
        const errorMessage = userContext.success
          ? 'Нет активной сессии пользователя'
          : userContext.message || 'Нет активной сессии пользователя';
        return NextResponse.json(
            { error: errorMessage },
            { status: 401 }
        );
      }
      role =
          mapRoleToLegacy(
              userContext.data.effectiveOrgRole ||
              userContext.data.activeMembership?.role ||
              null
          );
    }

    return NextResponse.json({
      taskId: report.taskId,
      taskName: report.taskName || taskRecord?.taskName,
      bsNumber: taskRecord?.bsNumber,
      files: report.files,
      createdAt: report.createdAt,
      executorName: taskRecord?.executorName ?? report.createdByName,
      reviewerName: report.initiatorName,
      status: report.status,
      issues: report.issues || [],
      fixedFiles: report.fixedFiles || [],
      events: report.events || [],
      role,
    });
  } catch (error) {
    console.error('Ошибка при получении отчёта:', error);
    return NextResponse.json(
        { error: 'Не удалось получить отчёт' },
        { status: 500 }
    );
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
    const taskIdDecoded = decodeURIComponent(taskId).toUpperCase();
    const baseIdDecoded = decodeURIComponent(baseId);

    if (!taskIdDecoded || !baseIdDecoded) {
      return NextResponse.json(
          { error: 'Missing parameters in URL' },
          { status: 400 }
      );
    }

    const url = new URL(request.url);
    const token = url.searchParams.get('token')?.trim() || '';
    const guestAccess = token ? verifyInitiatorAccessToken(token) : null;

    const body: {
      status?: string;
      issues?: string[];
    } = await request.json();

    const { status, issues } = body;

    // Находим отчёт
    const report = await ReportModel.findOne({
      baseId: baseIdDecoded,
      taskId: taskIdDecoded,
    });

    if (!report) {
      return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
    }

    let actorName = '';
    let actorId = '';
    let actorEmail: string | undefined;
    const allowedGuestStatuses = new Set(['Agreed', 'Issues', 'Pending']);
    if (guestAccess) {
      const taskRecord = await TaskModel.findOne({ taskId: taskIdDecoded })
        .select('initiatorEmail initiatorName')
        .lean();
      const initiatorEmail = taskRecord?.initiatorEmail?.trim().toLowerCase() || '';
      if (
        guestAccess.taskId !== taskIdDecoded ||
        !initiatorEmail ||
        initiatorEmail !== guestAccess.email
      ) {
        return NextResponse.json(
            { error: 'Недостаточно прав для обновления отчёта' },
            { status: 403 }
        );
      }
      if (status && !allowedGuestStatuses.has(status)) {
        return NextResponse.json(
            { error: 'Недопустимый статус для инициатора' },
            { status: 403 }
        );
      }
      actorName = taskRecord?.initiatorName?.trim() || guestAccess.email;
      actorId = `guest:${guestAccess.email}`;
      actorEmail = guestAccess.email;
    } else {
      const user = await currentUser();
      if (!user) {
        return NextResponse.json(
            { error: 'Пользователь не авторизован' },
            { status: 401 }
        );
      }
      actorName = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();
      actorId = user.id;
      actorEmail = user.emailAddresses?.[0]?.emailAddress;
    }

    const oldStatus = report.status;
    const oldIssues = [...report.issues];

    // Обновляем статус
    if (status && status !== oldStatus) {
      report.status = status;
      report.events = report.events || [];
      report.events.push({
        action: 'STATUS_CHANGED',
        author: actorName,
        authorId: actorId,
        date: new Date(),
        details: {
          oldStatus,
          newStatus: status,
        },
      });
    }

    // Обновление массива issues
    let issuesChanged = false;
    if (Array.isArray(issues)) {
      const oldIssuesSet = new Set(oldIssues);
      const newIssuesSet = new Set(issues);

      const addedIssues = issues.filter((i) => !oldIssuesSet.has(i));
      const removedIssues = oldIssues.filter((i) => !newIssuesSet.has(i));

      if (addedIssues.length > 0 || removedIssues.length > 0) {
        issuesChanged = true;
        report.issues = Array.from(newIssuesSet);
      }
    }

    // Если список issues был изменён, добавляем событие
    if (issuesChanged) {
      report.events = report.events || [];
      report.events.push({
        action: 'ISSUES_UPDATED',
        author: actorName,
        authorId: actorId,
        date: new Date(),
        details: {
          oldIssues,
          newIssues: report.issues,
        },
      });
    }

    // Сохраняем сам отчёт
    await report.save();

    // Синхронизируем статус с задачей
    const relatedTask = await TaskModel.findOne({ taskId: report.taskId });
    if (relatedTask && relatedTask.status !== report.status) {
      const allowedPublicStatuses = new Set(['open', 'in_review', 'assigned', 'closed']);
      if (relatedTask.publicStatus && !allowedPublicStatuses.has(relatedTask.publicStatus)) {
        // normalize legacy/invalid values before save
        relatedTask.publicStatus = 'closed';
      }
      const oldTaskStatus = relatedTask.status;
      relatedTask.status = report.status;

      relatedTask.events = relatedTask.events || [];
      relatedTask.events.push({
        action: 'STATUS_CHANGED',
        author: actorName,
        authorId: actorId,
        date: new Date(),
        details: {
          oldStatus: oldTaskStatus,
          newStatus: report.status,
          comment: 'Статус синхронизирован с фотоотчетом',
        },
      });

      await relatedTask.save();
    }

    const statusChanged = Boolean(status && status !== oldStatus);
    const hasIssuesNow = Array.isArray(report.issues) && report.issues.length > 0;
    const shouldNotifyAgreed = statusChanged && report.status === 'Agreed';
    const shouldNotifyIssues =
        !shouldNotifyAgreed &&
        ((statusChanged && report.status === 'Issues') || (issuesChanged && hasIssuesNow));

    if ((shouldNotifyIssues || shouldNotifyAgreed) && relatedTask) {
      const recipientClerkIds = new Set<string>();
      if (typeof relatedTask.authorId === 'string' && relatedTask.authorId.trim()) {
        recipientClerkIds.add(relatedTask.authorId.trim());
      }
      if (typeof relatedTask.executorId === 'string' && relatedTask.executorId.trim()) {
        recipientClerkIds.add(relatedTask.executorId.trim());
      }
      if (actorId && !actorId.startsWith('guest:')) {
        recipientClerkIds.delete(actorId);
      }

      if (recipientClerkIds.size > 0) {
        const recipients = await UserModel.find({
          clerkUserId: { $in: Array.from(recipientClerkIds) },
        })
          .select('_id')
          .lean()
          .exec();

        const bsInfo = relatedTask.bsNumber ? ` (БС ${relatedTask.bsNumber})` : '';
        const baseInfo = baseIdDecoded ? ` БС ${baseIdDecoded}` : '';
        const taskTitle = relatedTask.taskName || relatedTask.taskId;
        const link = `/reports/${encodeURIComponent(taskIdDecoded)}/${encodeURIComponent(
            baseIdDecoded
        )}`;

        const metadata = {
          taskId: relatedTask.taskId,
          baseId: baseIdDecoded,
          status: report.status,
          issuesCount: report.issues?.length ?? 0,
        };

        const title = shouldNotifyAgreed
            ? `Фотоотчет согласован${bsInfo}`
            : `Замечания по фотоотчету${bsInfo}`;
        const message = shouldNotifyAgreed
            ? `${actorName} согласовал фотоотчет по задаче «${taskTitle}»${baseInfo}.`
            : `${actorName} оставил замечания по фотоотчету по задаче «${taskTitle}»${baseInfo}.`;

        await Promise.all(
            recipients.map((recipient) =>
                createNotification({
                  recipientUserId: recipient._id,
                  type: 'task_status_change',
                  title,
                  message,
                  link,
                  orgId: relatedTask.orgId ?? undefined,
                  senderName: actorName,
                  senderEmail: actorEmail,
                  metadata,
                })
            )
        );
      }
    }

    return NextResponse.json({ message: 'Отчёт успешно обновлён' });
  } catch (error) {
    console.error('Ошибка при обновлении отчёта:', error);
    return NextResponse.json(
        { error: 'Не удалось обновить отчёт' },
        { status: 500 }
    );
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
    const taskIdDecoded = decodeURIComponent(taskId).toUpperCase();
    const baseIdDecoded = decodeURIComponent(baseId);

    if (!taskIdDecoded || !baseIdDecoded) {
      return NextResponse.json(
          { error: 'Missing parameters in URL' },
          { status: 400 }
      );
    }

    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data) {
      const errorMessage = userContext.success
          ? 'Нет активной сессии пользователя'
          : userContext.message || 'Нет активной сессии пользователя';
      return NextResponse.json(
          { error: errorMessage },
          { status: 401 }
      );
    }

    const userEmail = userContext.data.user.email?.trim().toLowerCase();
    if (!userEmail) {
      return NextResponse.json(
          { error: 'Не удалось определить пользователя' },
          { status: 401 }
      );
    }

    const report = await ReportModel.findOne({
      baseId: baseIdDecoded,
      taskId: taskIdDecoded,
    });

    if (!report) {
      return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
    }

    const taskRecord = await TaskModel.findOne({ taskId: taskIdDecoded })
      .select('orgId projectId taskName bsNumber')
      .lean();
    const projectId =
      report.projectId?.toString?.() ?? taskRecord?.projectId?.toString?.() ?? null;
    if (!projectId) {
      return NextResponse.json(
          { error: 'Проект для отчёта не найден' },
          { status: 404 }
      );
    }

    const project = await ProjectModel.findById(projectId)
      .select('managers')
      .lean();
    const managers = Array.isArray(project?.managers) ? project?.managers : [];
    const managesProject = managers.some(
      (manager) => typeof manager === 'string' && manager.trim().toLowerCase() === userEmail
    );
    if (!managesProject) {
      return NextResponse.json(
          { error: 'Недостаточно прав для удаления отчёта' },
          { status: 403 }
      );
    }

    const allFiles = [...report.files, ...report.fixedFiles].filter(
      (file): file is string => typeof file === 'string' && file.length > 0
    );

    const prefixSet = new Set<string>();
    const fallbackDeletes: Promise<void>[] = [];

    const safeOrgFolder =
      (taskRecord?.orgId ?? report.orgId)?.toString?.()
        ?.replace(/[\\/]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/\.+/g, '.')
        .trim() || 'unknown-org';
    const safeProjectFolder =
      (taskRecord?.projectId ?? report.projectId)?.toString?.()
        ?.replace(/[\\/]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/\.+/g, '.')
        .trim() || 'unknown-project';
    const safeBaseFolder =
      baseIdDecoded
        .replace(/[\\/]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/\.+/g, '.')
        .trim() || 'base';
    const safeTaskFolder =
      taskIdDecoded
        .replace(/[\\/]/g, '_')
        .replace(/\s+/g, '_')
        .trim() || 'task';

    const reportFolder = path.posix.join(
      'uploads',
      safeOrgFolder,
      safeProjectFolder,
      safeTaskFolder,
      `${safeTaskFolder}-reports`,
      safeBaseFolder
    );
    prefixSet.add(`${reportFolder.replace(/\/+$/, '')}/`);

    const reportFolderWithoutOrg = path.posix.join(
      'uploads',
      safeTaskFolder,
      `${safeTaskFolder}-reports`,
      safeBaseFolder
    );
    prefixSet.add(`${reportFolderWithoutOrg.replace(/\/+$/, '')}/`);

    for (const fileUrl of allFiles) {
      const key = storageKeyFromPublicUrl(fileUrl);
      if (!key) {
        fallbackDeletes.push(deleteTaskFile(fileUrl));
        continue;
      }

      const dir = path.posix.dirname(key);
      if (dir && dir !== '.') {
        prefixSet.add(`${dir.replace(/\/+$/, '')}/`);
      }
    }

    await Promise.all([
      ...Array.from(prefixSet).map((prefix) => deleteStoragePrefix(prefix)),
      ...fallbackDeletes,
    ]);

    if (report.storageBytes && report.orgId) {
      await adjustStorageBytes(report.orgId.toString(), -Math.abs(report.storageBytes));
    }

    await ReportDeletionLog.create({
      orgId: report.orgId ?? taskRecord?.orgId,
      projectId: report.projectId ?? taskRecord?.projectId,
      taskId: report.taskId,
      taskName: report.taskName || taskRecord?.taskName,
      baseId: report.baseId,
      deletedById: userContext.data.user.clerkUserId,
      deletedByEmail: userContext.data.user.email,
      deletedAt: new Date(),
    });

    await ReportModel.deleteOne({ _id: report._id });

    return NextResponse.json({ message: 'Отчёт успешно удалён' });
  } catch (error) {
    console.error('Ошибка при удалении отчёта:', error);
    return NextResponse.json(
        { error: 'Не удалось удалить отчёт' },
        { status: 500 }
    );
  }
}
