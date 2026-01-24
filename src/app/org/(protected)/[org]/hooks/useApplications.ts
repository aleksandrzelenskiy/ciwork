import * as React from 'react';

import type { ApplicationRow } from '@/types/org';
import { useI18n } from '@/i18n/I18nProvider';

type UseApplicationsState = {
    applications: ApplicationRow[];
    applicationsLoading: boolean;
    applicationsError: string | null;
    applicationsPreview: ApplicationRow[];
    fetchApplications: () => Promise<void>;
};

export default function useApplications(
    org: string | undefined,
    canManage: boolean
): UseApplicationsState {
    const { t } = useI18n();
    const [applications, setApplications] = React.useState<ApplicationRow[]>([]);
    const [applicationsLoading, setApplicationsLoading] = React.useState(false);
    const [applicationsError, setApplicationsError] = React.useState<string | null>(null);

    const fetchApplications = React.useCallback(async () => {
        if (!org || !canManage) return;
        setApplicationsLoading(true);
        setApplicationsError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/applications`, { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as { applications?: ApplicationRow[]; error?: string };
            if (!res.ok || data.error) {
                setApplications([]);
                setApplicationsError(data.error || res.statusText);
                return;
            }
            setApplications(Array.isArray(data.applications) ? data.applications : []);
        } catch (error: unknown) {
            setApplicationsError(error instanceof Error ? error.message : t('org.applications.error.load', 'Ошибка загрузки откликов'));
            setApplications([]);
        } finally {
            setApplicationsLoading(false);
        }
    }, [org, canManage, t]);

    return {
        applications,
        applicationsLoading,
        applicationsError,
        applicationsPreview: applications.slice(0, 3),
        fetchApplications,
    };
}
