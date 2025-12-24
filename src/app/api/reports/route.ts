// app/api/reports/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Report from '@/app/models/ReportModel';
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

  const taskMap = new Map<string, {
    taskId: string;
    taskName?: string;
    createdById?: string;
    createdByName?: string;
    initiatorName?: string;
    createdAt: Date;
    baseStatuses: Array<{ baseId: string; status: string; latestStatusChangeDate: Date }>;
  }>();

  rawReports.forEach((report) => {
    const taskId = report.taskId;
    const createdAt = report.createdAt ?? new Date();
    const latestEventDate = Array.isArray(report.events) && report.events.length > 0
      ? report.events.reduce((latest: Date, evt: { date: Date }) => {
          const eventDate = evt?.date ? new Date(evt.date) : latest;
          return eventDate > latest ? eventDate : latest;
        }, createdAt)
      : createdAt;
    const entry = taskMap.get(taskId) ?? {
      taskId,
      taskName: report.taskName,
      createdById: report.createdById,
      createdByName: report.createdByName,
      initiatorName: report.initiatorName,
      createdAt,
      baseStatuses: [],
    };
    entry.baseStatuses.push({
      baseId: report.baseId,
      status: report.status,
      latestStatusChangeDate: latestEventDate,
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
