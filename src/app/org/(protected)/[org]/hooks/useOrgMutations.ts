import * as React from 'react';

import type { OrgRole } from '@/types/org';

type SnackSetter = (state: { open: boolean; msg: string; sev: 'success' | 'error' | 'info' }) => void;

type UseOrgMutationsArgs = {
    org: string | undefined;
    canManage: boolean;
    setSnack: SnackSetter;
    refreshMembers: () => Promise<void>;
    refreshProjects: () => Promise<void>;
    refreshApplications: () => Promise<void>;
};

type UseOrgMutationsState = {
    updateMemberRole: (memberId: string, role: OrgRole) => Promise<boolean>;
    removeMember: (memberId: string) => Promise<boolean>;
    removeProject: (projectId: string) => Promise<boolean>;
    removeApplication: (applicationId: string) => Promise<boolean>;
};

export default function useOrgMutations({
    org,
    canManage,
    setSnack,
    refreshMembers,
    refreshProjects,
    refreshApplications,
}: UseOrgMutationsArgs): UseOrgMutationsState {
    const updateMemberRole = React.useCallback(
        async (memberId: string, role: OrgRole) => {
            if (!org || !memberId) return false;
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(org)}/members/${memberId}`,
                    {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role }),
                    }
                );
                const data = await res.json();
                if (!res.ok) {
                    setSnack({ open: true, msg: data?.error || 'Ошибка изменения роли', sev: 'error' });
                    return false;
                }
                setSnack({ open: true, msg: 'Роль обновлена', sev: 'success' });
                await refreshMembers();
                return true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Ошибка сети';
                setSnack({ open: true, msg, sev: 'error' });
                return false;
            }
        },
        [org, setSnack, refreshMembers]
    );

    const removeMember = React.useCallback(
        async (memberId: string) => {
            if (!org || !memberId || !canManage) return false;
            try {
                const res = await fetch(`/api/org/${encodeURIComponent(org)}/members/${memberId}`, { method: 'DELETE' });
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                    setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                    return false;
                }
                setSnack({ open: true, msg: 'Участник удалён', sev: 'success' });
                await refreshMembers();
                return true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Ошибка сети';
                setSnack({ open: true, msg, sev: 'error' });
                return false;
            }
        },
        [org, canManage, setSnack, refreshMembers]
    );

    const removeProject = React.useCallback(
        async (projectId: string) => {
            if (!org || !projectId || !canManage) return false;
            try {
                const res = await fetch(`/api/org/${encodeURIComponent(org)}/projects/${projectId}`, {
                    method: 'DELETE',
                });
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                    setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                    return false;
                }
                setSnack({ open: true, msg: 'Проект удалён', sev: 'success' });
                await refreshProjects();
                return true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Ошибка сети';
                setSnack({ open: true, msg, sev: 'error' });
                return false;
            }
        },
        [org, canManage, setSnack, refreshProjects]
    );

    const removeApplication = React.useCallback(
        async (applicationId: string) => {
            if (!org || !applicationId || !canManage) return false;
            try {
                const res = await fetch(`/api/org/${encodeURIComponent(org)}/applications`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ applicationId }),
                });
                const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
                if (!res.ok || data.error) {
                    setSnack({ open: true, msg: data.error || res.statusText, sev: 'error' });
                    return false;
                }
                setSnack({ open: true, msg: 'Отклик удалён', sev: 'success' });
                await refreshApplications();
                return true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Ошибка сети';
                setSnack({ open: true, msg, sev: 'error' });
                return false;
            }
        },
        [org, canManage, setSnack, refreshApplications]
    );

    return {
        updateMemberRole,
        removeMember,
        removeProject,
        removeApplication,
    };
}
