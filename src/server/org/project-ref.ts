// src/server/org/project-ref.ts

import 'server-only';
import Organization from '@/server/models/OrganizationModel';
import Project from '@/server/models/ProjectModel';
import { Types } from 'mongoose';

export async function getOrgAndProjectByRef(orgSlug: string, projectRef: string) {
    const trimmedOrg = orgSlug?.trim() || '';
    const normalizedOrg = trimmedOrg.toLowerCase();

    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const orgCaseInsensitiveFilter =
        trimmedOrg.length > 0
            ? { orgSlug: { $regex: `^${escapeRegex(trimmedOrg)}$`, $options: 'i' as const } }
            : null;

    let orgDoc = await Organization.findOne({ orgSlug: normalizedOrg })
        .select('_id orgSlug name')
        .lean();

    if (!orgDoc && orgCaseInsensitiveFilter) {
        orgDoc = await Organization.findOne(orgCaseInsensitiveFilter)
            .select('_id orgSlug name')
            .lean();
    }

    if (!orgDoc) return { error: 'Org not found' as const };

    // Проект — по _id или по KEY (KEY => UPPERCASE)
    const trimmedProjectRef = projectRef?.trim() || '';
    const isId = Types.ObjectId.isValid(trimmedProjectRef);
    let projectDoc: Awaited<ReturnType<typeof Project.findOne>> | null;

    if (isId) {
        projectDoc = await Project.findOne({ _id: trimmedProjectRef, orgId: orgDoc._id })
            .select('_id name orgId key regionCode operator')
            .lean();
    } else {
        const normalizedProjectKey = trimmedProjectRef.toUpperCase();
        projectDoc = await Project.findOne({
            key: normalizedProjectKey,
            orgId: orgDoc._id,
        })
            .select('_id name orgId key regionCode operator')
            .lean();

        if (!projectDoc && trimmedProjectRef.length > 0) {
            const projectCaseInsensitiveFilter = {
                key: { $regex: `^${escapeRegex(trimmedProjectRef)}$`, $options: 'i' as const },
                orgId: orgDoc._id,
            };
            projectDoc = await Project.findOne(projectCaseInsensitiveFilter)
                .select('_id name orgId key regionCode operator')
                .lean();
        }
    }

    if (!projectDoc) return { error: 'Project not found' as const };

    return { orgDoc, projectDoc };
}
