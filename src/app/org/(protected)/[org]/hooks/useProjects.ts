import * as React from 'react';

import type { ProjectDTO } from '@/types/org';

type SnackSetter = (state: { open: boolean; msg: string; sev: 'success' | 'error' | 'info' }) => void;

type UseProjectsState = {
    projects: ProjectDTO[];
    projectsLoading: boolean;
    projectPreview: ProjectDTO[];
    activeProjectsCount: number;
    projectNameById: Map<string, string>;
    fetchProjects: () => Promise<void>;
};

export default function useProjects(
    org: string | undefined,
    canManage: boolean,
    setSnack: SnackSetter
): UseProjectsState {
    const [projects, setProjects] = React.useState<ProjectDTO[]>([]);
    const [projectsLoading, setProjectsLoading] = React.useState(false);

    const fetchProjects = React.useCallback(async () => {
        if (!org || !canManage) return;
        setProjectsLoading(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/projects`, { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as { projects?: ProjectDTO[]; error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                return;
            }
            setProjects(Array.isArray(data?.projects) ? data.projects : []);
        } finally {
            setProjectsLoading(false);
        }
    }, [org, canManage, setSnack]);

    const projectNameById = React.useMemo(() => {
        const map = new Map<string, string>();
        projects.forEach((project) => {
            map.set(project._id, project.name);
        });
        return map;
    }, [projects]);

    return {
        projects,
        projectsLoading,
        projectPreview: projects.slice(0, 3),
        activeProjectsCount: projects.length,
        projectNameById,
        fetchProjects,
    };
}
