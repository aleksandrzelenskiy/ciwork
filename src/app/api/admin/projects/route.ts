import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import ProjectModel from '@/server/models/ProjectModel';
import OrganizationModel from '@/server/models/OrganizationModel';
import { GetUserContext } from '@/server-actions/user-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AdminProjectRow = {
    _id: string;
    orgId: string;
    orgName?: string;
    orgSlug?: string;
    name: string;
    key: string;
    projectType?: 'installation' | 'document';
    regionCode?: string;
    operator?: string;
    managers?: string[];
    createdByEmail?: string;
    createdAt?: string;
    updatedAt?: string;
};

type ResponsePayload = { projects: AdminProjectRow[]; error?: string };

export async function GET(): Promise<NextResponse<ResponsePayload>> {
    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data?.isSuperAdmin) {
        return NextResponse.json({ projects: [], error: 'Доступ запрещен' }, { status: 403 });
    }

    await dbConnect();

    const [projects, organizations] = await Promise.all([
        ProjectModel.find({})
            .sort({ updatedAt: -1 })
            .select('orgId name key projectType regionCode operator managers createdByEmail createdAt updatedAt')
            .lean(),
        OrganizationModel.find({})
            .select('_id name orgSlug')
            .lean(),
    ]);

    const orgMap = new Map(
        organizations.map((org) => [org._id.toString(), { name: org.name, orgSlug: org.orgSlug }])
    );

    const normalizedProjects: AdminProjectRow[] = projects.map((project) => {
        const orgId = project.orgId?.toString?.() ?? '';
        const orgInfo = orgMap.get(orgId);

        return {
            _id: project._id.toString(),
            orgId,
            orgName: orgInfo?.name,
            orgSlug: orgInfo?.orgSlug,
            name: project.name,
            key: project.key,
            projectType: project.projectType,
            regionCode: project.regionCode,
            operator: project.operator,
            managers: Array.isArray(project.managers) ? project.managers : [],
            createdByEmail: project.createdByEmail,
            createdAt: project.createdAt?.toISOString?.(),
            updatedAt: project.updatedAt?.toISOString?.(),
        };
    });

    return NextResponse.json({ projects: normalizedProjects });
}
