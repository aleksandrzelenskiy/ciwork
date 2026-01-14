// src/app/api/admin/reports/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import ReportModel from '@/server/models/ReportModel';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import OrganizationModel from '@/server/models/OrganizationModel';
import { GetUserContext } from '@/server-actions/user-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AdminReport = {
    taskId: string;
    taskName?: string;
    bsNumber?: string;
    createdById?: string;
    createdByName?: string;
    executorName?: string;
    initiatorName?: string;
    createdAt: string;
    orgId?: string;
    orgName?: string;
    orgSlug?: string;
    projectId?: string;
    projectKey?: string;
    projectName?: string;
    projectRegionCode?: string;
    projectOperator?: string;
    baseStatuses: Array<{
        baseId: string;
        status: string;
        latestStatusChangeDate: string;
        fileCount?: number;
    }>;
};

type ResponsePayload = { reports: AdminReport[] };

export async function GET(): Promise<NextResponse<ResponsePayload>> {
    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data?.isSuperAdmin) {
        return NextResponse.json({ reports: [] }, { status: 403 });
    }

    await dbConnect();

    const rawReports = await ReportModel.find({})
        .sort({ createdAt: -1 })
        .lean();

    const taskIds = Array.from(
        new Set(
            rawReports
                .map((report) =>
                    typeof report.taskId === 'string' ? report.taskId : ''
                )
                .filter((taskId) => taskId.length > 0)
        )
    );

    const tasks = taskIds.length
        ? await TaskModel.find({ taskId: { $in: taskIds } })
              .select('taskId bsNumber executorName projectId orgId taskName')
              .lean()
        : [];
    const taskMetaMap = new Map(
        tasks.map((task) => [
            task.taskId,
            {
                bsNumber: task.bsNumber,
                executorName: task.executorName,
                projectId: task.projectId ? task.projectId.toString() : null,
                orgId: task.orgId ? task.orgId.toString() : null,
                taskName: task.taskName,
            },
        ])
    );

    const projectIds = new Set<string>();
    const orgIds = new Set<string>();
    rawReports.forEach((report) => {
        const reportProjectId = report.projectId?.toString?.() ?? null;
        const reportOrgId = report.orgId?.toString?.() ?? null;
        const taskMeta = taskMetaMap.get(report.taskId);
        const projectId = reportProjectId || taskMeta?.projectId || null;
        const orgId = reportOrgId || taskMeta?.orgId || null;
        if (projectId) projectIds.add(projectId);
        if (orgId) orgIds.add(orgId);
    });

    const [projects, orgs] = await Promise.all([
        projectIds.size > 0
            ? ProjectModel.find({ _id: { $in: Array.from(projectIds) } })
                  .select('key name regionCode operator')
                  .lean()
            : [],
        orgIds.size > 0
            ? OrganizationModel.find({ _id: { $in: Array.from(orgIds) } })
                  .select('name orgSlug')
                  .lean()
            : [],
    ]);

    const projectInfoMap = new Map(
        projects.map((project) => [
            project._id.toString(),
            {
                key: project.key,
                name: project.name,
                regionCode: project.regionCode,
                operator: project.operator,
            },
        ])
    );
    const orgInfoMap = new Map(
        orgs.map((org) => [
            org._id.toString(),
            {
                name: org.name,
                orgSlug: org.orgSlug,
            },
        ])
    );

    const taskMap = new Map<string, AdminReport>();

    rawReports.forEach((report) => {
        const taskId = report.taskId;
        const createdAt = report.createdAt ?? new Date();
        const latestEventDate =
            Array.isArray(report.events) && report.events.length > 0
                ? report.events.reduce((latest: Date, evt: { date: Date }) => {
                      const eventDate = evt?.date ? new Date(evt.date) : latest;
                      return eventDate > latest ? eventDate : latest;
                  }, createdAt)
                : createdAt;
        const taskMeta = taskMetaMap.get(taskId);
        const reportProjectId = report.projectId?.toString?.() ?? null;
        const reportOrgId = report.orgId?.toString?.() ?? null;
        const projectId = reportProjectId || taskMeta?.projectId || null;
        const orgId = reportOrgId || taskMeta?.orgId || null;
        const projectInfo = projectId ? projectInfoMap.get(projectId) : undefined;
        const orgInfo = orgId ? orgInfoMap.get(orgId) : undefined;
        const entry = taskMap.get(taskId) ?? {
            taskId,
            taskName: report.taskName || taskMeta?.taskName,
            bsNumber: taskMeta?.bsNumber,
            createdById: report.createdById,
            createdByName: report.createdByName,
            executorName: taskMeta?.executorName ?? report.createdByName,
            initiatorName: report.initiatorName,
            createdAt: createdAt.toISOString(),
            orgId: orgId ?? undefined,
            orgName: orgInfo?.name,
            orgSlug: orgInfo?.orgSlug,
            projectId: projectId ?? undefined,
            projectKey: projectInfo?.key,
            projectName: projectInfo?.name,
            projectRegionCode: projectInfo?.regionCode,
            projectOperator: projectInfo?.operator,
            baseStatuses: [],
        };
        entry.baseStatuses.push({
            baseId: report.baseId,
            status: report.status,
            latestStatusChangeDate: latestEventDate.toISOString(),
            fileCount:
                (Array.isArray(report.files) ? report.files.length : 0) +
                (Array.isArray(report.fixedFiles) ? report.fixedFiles.length : 0),
        });
        taskMap.set(taskId, entry);
    });

    const reports = Array.from(taskMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ reports });
}
