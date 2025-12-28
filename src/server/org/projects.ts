// src/server/org/projects.ts

import 'server-only';

import { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import ProjectModel from '@/server/models/ProjectModel';

// Минимальные lean-типы
type OrgLean = {
    _id: Types.ObjectId;
    orgSlug: string;
};

type ProjectLean = {
    _id: Types.ObjectId;
    orgId: Types.ObjectId;
    name: string;
    key: string;
    regionCode?: string;
    operator?: string;
    managers?: string[];
};

type Ok = { orgDoc: OrgLean; projectDoc: ProjectLean };
type Err = { error: string };

function isObjectIdLike(v: string): boolean {
    return /^[a-fA-F0-9]{24}$/.test(v);
}

export async function getOrgAndProjectByRef(
    orgRef: string,
    projectRef: string
): Promise<Ok | Err> {
    await dbConnect();

    // Организация по orgSlug ИЛИ _id
    const orgQuery = isObjectIdLike(orgRef)
        ? { _id: new Types.ObjectId(orgRef) }
        : { orgSlug: orgRef.trim().toLowerCase() };

    const orgDoc = await Organization.findOne(orgQuery).lean<OrgLean>();
    if (!orgDoc) return { error: 'Organization not found' };

    // Проект: по _id ИЛИ по key (key хранится UPPERCASE)
    const projectDoc = isObjectIdLike(projectRef)
        ? await ProjectModel.findOne(
            {
                _id: new Types.ObjectId(projectRef),
                orgId: orgDoc._id,
            },
            { _id: 1, orgId: 1, name: 1, key: 1, regionCode: 1, operator: 1, managers: 1 }
        ).lean<ProjectLean>()
        : await ProjectModel.findOne(
            {
                orgId: orgDoc._id,
                key: projectRef.trim().toUpperCase(),
            },
            { _id: 1, orgId: 1, name: 1, key: 1, regionCode: 1, operator: 1, managers: 1 }
        ).lean<ProjectLean>();

    if (!projectDoc) return { error: 'Project not found' };

    return { orgDoc, projectDoc };
}
