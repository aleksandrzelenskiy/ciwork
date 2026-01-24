import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/I18nProvider';

type UseOrgNavigationArgs = {
    org: string | undefined;
    onError: (message: string) => void;
};

type UseOrgNavigationState = {
    goToProjectsPage: () => void;
    goToProjectTasks: (projectKey: string | undefined) => void;
    goToTaskDetails: (projectKey: string | undefined, taskId: string | undefined) => void;
};

export default function useOrgNavigation({
    org,
    onError,
}: UseOrgNavigationArgs): UseOrgNavigationState {
    const { t } = useI18n();
    const router = useRouter();

    const goToProjectsPage = React.useCallback(() => {
        if (!org) return;
        router.push(`/org/${encodeURIComponent(org)}/projects`);
    }, [org, router]);

    const goToProjectTasks = React.useCallback(
        (projectKey: string | undefined) => {
            if (!org || !projectKey) return;
            router.push(
                `/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(projectKey)}/tasks`
            );
        },
        [org, router]
    );

    const goToTaskDetails = React.useCallback(
        (projectKey: string | undefined, taskId: string | undefined) => {
            if (!org || !taskId) return;
            if (!projectKey) {
                onError(t('org.navigation.error.projectMissing', 'Не удалось определить проект задачи'));
                return;
            }
            router.push(
                `/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(projectKey)}/tasks/${taskId}`
            );
        },
        [org, onError, router, t]
    );

    return {
        goToProjectsPage,
        goToProjectTasks,
        goToTaskDetails,
    };
}
