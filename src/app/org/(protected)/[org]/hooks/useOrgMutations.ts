import * as React from 'react';

import type { OrgRole } from '@/types/org';
import { useI18n } from '@/i18n/I18nProvider';

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
    approveJoinRequest: (memberId: string) => Promise<boolean>;
    declineJoinRequest: (memberId: string) => Promise<boolean>;
    pendingJoinRequest: { memberId: string; action: 'approve' | 'decline' } | null;
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
    const { t } = useI18n();
    const [pendingJoinRequest, setPendingJoinRequest] = React.useState<{
        memberId: string;
        action: 'approve' | 'decline';
    } | null>(null);
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
                    setSnack({
                        open: true,
                        msg: data?.error || t('org.members.error.updateRole', 'Ошибка изменения роли'),
                        sev: 'error',
                    });
                    return false;
                }
                setSnack({ open: true, msg: t('org.members.success.roleUpdated', 'Роль обновлена'), sev: 'success' });
                await refreshMembers();
                return true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : t('common.error.network', 'Ошибка сети');
                setSnack({ open: true, msg, sev: 'error' });
                return false;
            }
        },
        [org, setSnack, refreshMembers, t]
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
                setSnack({ open: true, msg: t('org.members.success.removed', 'Участник удалён'), sev: 'success' });
                await refreshMembers();
                return true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : t('common.error.network', 'Ошибка сети');
                setSnack({ open: true, msg, sev: 'error' });
                return false;
            }
        },
        [org, canManage, setSnack, refreshMembers, t]
    );

    const approveJoinRequest = React.useCallback(
        async (memberId: string) => {
            if (!org || !memberId) return false;
            setPendingJoinRequest({ memberId, action: 'approve' });
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(org)}/members/requests/${encodeURIComponent(memberId)}`,
                    { method: 'PATCH' }
                );
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                    setSnack({
                        open: true,
                        msg: data?.error || t('org.members.request.approveError', 'Ошибка одобрения запроса'),
                        sev: 'error',
                    });
                    return false;
                }
                setSnack({ open: true, msg: t('org.members.request.approveSuccess', 'Запрос одобрен'), sev: 'success' });
                await refreshMembers();
                return true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : t('common.error.network', 'Ошибка сети');
                setSnack({ open: true, msg, sev: 'error' });
                return false;
            } finally {
                setPendingJoinRequest(null);
            }
        },
        [org, setSnack, refreshMembers, t]
    );

    const declineJoinRequest = React.useCallback(
        async (memberId: string) => {
            if (!org || !memberId) return false;
            setPendingJoinRequest({ memberId, action: 'decline' });
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(org)}/members/requests/${encodeURIComponent(memberId)}`,
                    { method: 'DELETE' }
                );
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                    setSnack({
                        open: true,
                        msg: data?.error || t('org.members.request.declineError', 'Ошибка отклонения запроса'),
                        sev: 'error',
                    });
                    return false;
                }
                setSnack({ open: true, msg: t('org.members.request.declineSuccess', 'Запрос отклонён'), sev: 'info' });
                await refreshMembers();
                return true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : t('common.error.network', 'Ошибка сети');
                setSnack({ open: true, msg, sev: 'error' });
                return false;
            } finally {
                setPendingJoinRequest(null);
            }
        },
        [org, setSnack, refreshMembers, t]
    );

    const removeProject = React.useCallback(
        async (projectId: string) => {
            if (!org || !projectId || !canManage) return false;
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(projectId)}`,
                    {
                        method: 'DELETE',
                    }
                );
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                    setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                    return false;
                }
                setSnack({ open: true, msg: t('org.projects.success.deleted', 'Проект удалён'), sev: 'success' });
                await refreshProjects();
                return true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : t('common.error.network', 'Ошибка сети');
                setSnack({ open: true, msg, sev: 'error' });
                return false;
            }
        },
        [org, canManage, setSnack, refreshProjects, t]
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
                setSnack({ open: true, msg: t('org.applications.success.deleted', 'Отклик удалён'), sev: 'success' });
                await refreshApplications();
                return true;
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : t('common.error.network', 'Ошибка сети');
                setSnack({ open: true, msg, sev: 'error' });
                return false;
            }
        },
        [org, canManage, setSnack, refreshApplications, t]
    );

    return {
        updateMemberRole,
        removeMember,
        approveJoinRequest,
        declineJoinRequest,
        pendingJoinRequest,
        removeProject,
        removeApplication,
    };
}
