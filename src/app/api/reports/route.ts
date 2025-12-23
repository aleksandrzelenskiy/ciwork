// app/api/reports/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Report from '@/app/models/ReportModel';
import { GetUserContext } from '@/server-actions/user-context';
import { mapRoleToLegacy } from '@/utils/roleMapping';
import type { PipelineStage } from 'mongoose';

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

  const pipeline: PipelineStage[] = [];

  if (!isSuperAdmin && userRole === 'executor') {
    pipeline.push({ $match: { executorId: clerkUserId } });
  }

  pipeline.push(
    { $unwind: '$events' },
    {
      $group: {
        _id: '$_id',
        taskId: {
          $first: {
            $ifNull: ['$taskId', { $ifNull: ['$reportId', '$task'] }],
          },
        },
        status: { $last: '$status' },
        latestStatusChangeDate: { $max: '$events.date' },
        executorId: { $first: '$executorId' },
        executorName: { $first: '$executorName' },
        executorAvatar: { $first: '$executorAvatar' },
        initiatorId: { $first: '$initiatorId' },
        initiatorName: { $first: '$initiatorName' },
        createdAt: { $first: '$createdAt' },
        task: { $first: '$task' },
        baseId: { $first: '$baseId' },
      },
    },
    {
      $group: {
        _id: '$taskId',
        taskId: { $first: '$taskId' },
        task: { $first: '$task' },
        executorId: { $first: '$executorId' },
        executorName: { $first: '$executorName' },
        executorAvatar: { $first: '$executorAvatar' },
        initiatorId: { $first: '$initiatorId' },
        initiatorName: { $first: '$initiatorName' },
        createdAt: { $first: '$createdAt' },
        baseStatuses: {
          $push: {
            baseId: '$baseId',
            status: '$status',
            latestStatusChangeDate: '$latestStatusChangeDate',
          },
        },
      },
    },
    { $sort: { createdAt: -1 } }
  );

  let rawReports;
  try {
    rawReports = await Report.aggregate(pipeline);
  } catch (error: unknown) {
    console.error('Error during aggregation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }

  const reports = rawReports.map((report) => ({
    _id: report._id,
    taskId: report.taskId || report.reportId || report.task,
    task: report.task,
    executorId: report.executorId,
    executorName: report.executorName,
    executorAvatar: report.executorAvatar || '',
    initiatorId: report.initiatorId || 'Unknown',
    initiatorName: report.initiatorName || 'Unknown',
    createdAt: report.createdAt,
    baseStatuses: report.baseStatuses.map(
      (bs: {
        baseId: unknown;
        status: unknown;
        latestStatusChangeDate: unknown;
      }) => ({
        baseId: bs.baseId,
        status: bs.status,
        latestStatusChangeDate: bs.latestStatusChangeDate,
      })
    ),
  }));

  return NextResponse.json({
    reports,
    userRole: mapRoleToLegacy(userRole),
    isSuperAdmin,
  });
}
