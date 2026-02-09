import * as React from 'react';

import type { ProjectDTO } from '@/types/org';
import type { ProjectDialogValues } from '@/app/workspace/components/ProjectDialog';
import { useI18n } from '@/i18n/I18nProvider';

type SnackSetter = (state: { open: boolean; msg: string; sev: 'success' | 'error' | 'info' }) => void;

type UseProjectDialogArgs = {
    org: string | undefined;
    subscriptionLoading: boolean;
    isSubscriptionActive: boolean;
    setSnack: SnackSetter;
    refreshProjects: () => Promise<void>;
};

type UseProjectDialogState = {
    projectDialogOpen: boolean;
    projectDialogMode: 'create' | 'edit';
    projectDialogLoading: boolean;
    projectToEdit: ProjectDTO | null;
    openProjectDialog: (project?: ProjectDTO) => void;
    closeProjectDialog: () => void;
    submitProjectDialog: (values: ProjectDialogValues) => Promise<void>;
};

export default function useProjectDialog({
    org,
    subscriptionLoading,
    isSubscriptionActive,
    setSnack,
    refreshProjects,
}: UseProjectDialogArgs): UseProjectDialogState {
    const { t } = useI18n();
    const [projectDialogOpen, setProjectDialogOpen] = React.useState(false);
    const [projectDialogMode, setProjectDialogMode] = React.useState<'create' | 'edit'>('create');
    const [projectDialogLoading, setProjectDialogLoading] = React.useState(false);
    const [projectToEdit, setProjectToEdit] = React.useState<ProjectDTO | null>(null);

    const openProjectDialog = (project?: ProjectDTO) => {
        if (!project && (subscriptionLoading || !isSubscriptionActive)) {
            const msg = subscriptionLoading
                ? t('org.subscription.waitCheck', 'Подождите завершения проверки подписки')
                : t('org.subscription.inactiveAction', 'Подписка не активна. Активируйте тариф или пробный период');
            setSnack({ open: true, msg, sev: 'error' });
            return;
        }
        if (project) {
            setProjectDialogMode('edit');
            setProjectToEdit(project);
        } else {
            setProjectDialogMode('create');
            setProjectToEdit(null);
        }
        setProjectDialogOpen(true);
    };

    const closeProjectDialog = () => {
        if (projectDialogLoading) return;
        setProjectDialogOpen(false);
        setProjectToEdit(null);
    };

    const submitProjectDialog = async (values: ProjectDialogValues) => {
        if (!org) return;
        if (projectDialogMode === 'create' && (subscriptionLoading || !isSubscriptionActive)) {
            const msg = subscriptionLoading
                ? t('org.subscription.waitCheck', 'Подождите завершения проверки подписки')
                : t('org.subscription.inactiveAction', 'Подписка не активна. Активируйте тариф или пробный период');
            setSnack({ open: true, msg, sev: 'error' });
            return;
        }
        setProjectDialogLoading(true);
        try {
            const payload = {
                name: values.name,
                key: values.key,
                description: values.description,
                projectType: values.projectType,
                regionCode: values.regionCode,
                operator: values.operator,
                managers: values.managers,
                photoReportFolders: values.photoReportFolders ?? [],
            };
            const projectRef = projectToEdit?.key || projectToEdit?._id;
            const url =
                projectDialogMode === 'edit' && projectRef
                    ? `/api/org/${encodeURIComponent(org)}/projects/${projectRef}`
                    : `/api/org/${encodeURIComponent(org)}/projects`;
            const method = projectDialogMode === 'edit' ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data || data.error) {
                const msg = data?.error || t('org.projects.error.save', 'Не удалось сохранить проект');
                setSnack({ open: true, msg, sev: 'error' });
                return;
            }
            setSnack({
                open: true,
                msg:
                    projectDialogMode === 'create'
                        ? t('org.projects.success.created', 'Проект создан')
                        : t('org.projects.success.updated', 'Проект обновлён'),
                sev: 'success',
            });
            setProjectDialogOpen(false);
            setProjectToEdit(null);
            await refreshProjects();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : t('common.error.network', 'Ошибка сети');
            setSnack({ open: true, msg, sev: 'error' });
        } finally {
            setProjectDialogLoading(false);
        }
    };

    return {
        projectDialogOpen,
        projectDialogMode,
        projectDialogLoading,
        projectToEdit,
        openProjectDialog,
        closeProjectDialog,
        submitProjectDialog,
    };
}
