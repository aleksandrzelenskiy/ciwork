import * as React from 'react';

type OrgUsage = {
    tasksUsed: number;
    publicTasksUsed: number;
    tasksLimit: number | null;
    publicTasksLimit: number | null;
    tasksPeriod: string;
    publicPeriod: string;
};

type UseOrgUsageState = {
    usage: OrgUsage | null;
    usageLoading: boolean;
    usageError: string | null;
    fetchUsage: () => Promise<void>;
};

export default function useOrgUsage(orgSlug?: string): UseOrgUsageState {
    const [usage, setUsage] = React.useState<OrgUsage | null>(null);
    const [usageLoading, setUsageLoading] = React.useState(true);
    const [usageError, setUsageError] = React.useState<string | null>(null);

    const fetchUsage = React.useCallback(async () => {
        if (!orgSlug) return;
        setUsageLoading(true);
        setUsageError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/usage`, {
                cache: 'no-store',
            });
            const data = (await res.json().catch(() => ({}))) as { usage?: OrgUsage; error?: string };
            if (!res.ok || !data.usage) {
                setUsage(null);
                setUsageError(data.error || 'Не удалось загрузить лимиты задач');
                return;
            }
            setUsage(data.usage);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Ошибка загрузки лимитов задач';
            setUsage(null);
            setUsageError(message);
        } finally {
            setUsageLoading(false);
        }
    }, [orgSlug]);

    React.useEffect(() => {
        if (!orgSlug) return;
        void fetchUsage();
    }, [fetchUsage, orgSlug]);

    return {
        usage,
        usageLoading,
        usageError,
        fetchUsage,
    };
}
