// app/api/reports/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Report from '@/app/models/ReportModel';
import TaskModel from '@/app/models/TaskModel';
import ProjectModel from '@/app/models/ProjectModel';
import { GetUserContext } from '@/server-actions/user-context';
import { mapRoleToLegacy } from '@/utils/roleMapping';

export async function GET() {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');
  } catch (error: unknown) {
    console.error('Failed to connect to MongoDB:', error);
    return NextResponse.json(
      { error: 'Failed to connect to database' },
      { status: 500 }
    );
  }

  const userContext = await GetUserContext();
  if (!userContext.success || !userContext.data) {
    const errorMessage = userContext.success
      ? 'No active user session found'
      : userContext.message || 'No active user session found';
    return NextResponse.json(
      { error: errorMessage },
      { status: 401 }
    );
  }

  const {
    user,
    effectiveOrgRole,
    isSuperAdmin,
    activeMembership,
  } = userContext.data;
  const clerkUserId = user.clerkUserId;
  const userRole = effectiveOrgRole || activeMembership?.role || null;

  const query: Record<string, unknown> = {};
  const activeOrgId =
      userContext.data.activeOrgId ||
      userContext.data.activeMembership?.orgId ||
      null;
  if (activeOrgId) {
    query.orgId = activeOrgId;
  }
  if (!isSuperAdmin && userRole === 'executor') {
    query.createdById = clerkUserId;
  }

  let rawReports;
  try {
    rawReports = await Report.find(query).lean();
  } catch (error: unknown) {
    console.error('Error during report fetch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }

  const taskIds = Array.from(
    new Set(
      rawReports
        .map((report) => (typeof report.taskId === 'string' ? report.taskId : ''))
        .filter((taskId) => taskId.length > 0)
    )
  );

  const taskMeta = taskIds.length
    ? await TaskModel.find({ taskId: { $in: taskIds } })
        .select('taskId bsNumber executorName projectId')
        .lean()
    : [];
  const taskMetaMap = new Map(
    taskMeta.map((task) => [
      task.taskId,
      {
        bsNumber: task.bsNumber,
        executorName: task.executorName,
        projectId: task.projectId ? task.projectId.toString() : null,
      },
    ])
  );

  const projectIds = new Set<string>();
  rawReports.forEach((report) => {
    const reportProjectId = report.projectId?.toString?.() ?? null;
    const taskProjectId = taskMetaMap.get(report.taskId)?.projectId ?? null;
    const projectId = reportProjectId || taskProjectId;
    if (projectId) projectIds.add(projectId);
  });

  const projects = projectIds.size > 0
    ? await ProjectModel.find({ _id: { $in: Array.from(projectIds) } })
        .select('managers')
        .lean()
    : [];
  const projectManagersMap = new Map(
    projects.map((project) => [project._id.toString(), project.managers ?? []])
  );

  const normalizedEmail =
    userContext.data.user.email?.trim().toLowerCase() ?? '';

  type BaseStatus = {
    baseId: string;
    status: string;
    latestStatusChangeDate: Date;
    fileCount?: number;
  };
  type TaskEntry = {
    taskId: string;
    taskName?: string;
    bsNumber?: string;
    createdById?: string;
    createdByName?: string;
    executorName?: string;
    initiatorName?: string;
    createdAt: Date;
    canDelete?: boolean;
    baseStatuses: BaseStatus[];
  };

  const taskMap = new Map<string, TaskEntry>();

  rawReports.forEach((report) => {
    const taskId = report.taskId;
    const createdAt = report.createdAt ?? new Date();
    const latestEventDate = Array.isArray(report.events) && report.events.length > 0
      ? report.events.reduce((latest: Date, evt: { date: Date }) => {
          const eventDate = evt?.date ? new Date(evt.date) : latest;
          return eventDate > latest ? eventDate : latest;
        }, createdAt)
      : createdAt;
    const taskMetaEntry = taskMetaMap.get(taskId);
    const projectId =
      report.projectId?.toString?.() ??
      taskMetaEntry?.projectId ??
      null;
    const managers = projectId
      ? projectManagersMap.get(projectId) ?? []
      : [];
    const canDelete = normalizedEmail.length > 0
      ? managers.some(
          (manager) =>
            typeof manager === 'string' &&
            manager.trim().toLowerCase() === normalizedEmail
        )
      : false;
    const entry = taskMap.get(taskId) ?? {
      taskId,
      taskName: report.taskName,
      bsNumber: taskMetaEntry?.bsNumber,
      createdById: report.createdById,
      createdByName: report.createdByName,
      executorName: taskMetaEntry?.executorName ?? report.createdByName,
      initiatorName: report.initiatorName,
      createdAt,
      canDelete,
      baseStatuses: [] as BaseStatus[],
    };
    entry.baseStatuses.push({
      baseId: report.baseId,
      status: report.status,
      latestStatusChangeDate: latestEventDate,
      fileCount:
        (Array.isArray(report.files) ? report.files.length : 0) +
        (Array.isArray(report.fixedFiles) ? report.fixedFiles.length : 0),
    });
    taskMap.set(taskId, entry);
  });

  const reports = Array.from(taskMap.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  return NextResponse.json({
    reports,
    userRole: mapRoleToLegacy(userRole),
    isSuperAdmin,
  });
}
