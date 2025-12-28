import React from 'react';
import type { PhotoReportSummary } from '@/app/types/reportTypes';

type CacheEntry = {
    data: PhotoReportSummary[];
    error: string | null;
    timestamp: number;
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

const buildKey = (taskId: string, token?: string) => `${taskId.toUpperCase()}::${token ?? ''}`;

export const usePhotoReports = (taskId?: string, token?: string) => {
    const key = taskId ? buildKey(taskId, token) : '';
    const cached = key ? cache.get(key) : undefined;
    const [data, setData] = React.useState<PhotoReportSummary[]>(cached?.data ?? []);
    const [loading, setLoading] = React.useState<boolean>(!!taskId && !cached);
    const [error, setError] = React.useState<string | null>(cached?.error ?? null);

    const fetchReports = React.useCallback(
        async (force?: boolean) => {
            if (!taskId) return;
            const entry = cache.get(key);
            const isFresh = entry && Date.now() - entry.timestamp < CACHE_TTL_MS;
            if (!force && isFresh) {
                setData(entry.data);
                setError(entry.error);
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const params = new URLSearchParams({ taskId });
                if (token) {
                    params.set('token', token);
                }
                const response = await fetch(`/api/reports/summary?${params.toString()}`, {
                    cache: 'no-store',
                });
                const payload = (await response.json().catch(() => null)) as
                    | { summaries?: PhotoReportSummary[]; error?: string }
                    | null;
                if (!response.ok) {
                    const message = payload?.error || 'Не удалось загрузить фотоотчеты';
                    setError(message);
                    setData([]);
                    cache.set(key, { data: [], error: message, timestamp: Date.now() });
                    return;
                }
                const summaries = Array.isArray(payload?.summaries) ? payload?.summaries ?? [] : [];
                setData(summaries);
                setError(null);
                cache.set(key, { data: summaries, error: null, timestamp: Date.now() });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Не удалось загрузить фотоотчеты';
                setError(message);
                setData([]);
                cache.set(key, { data: [], error: message, timestamp: Date.now() });
            } finally {
                setLoading(false);
            }
        },
        [key, taskId, token]
    );

    React.useEffect(() => {
        if (!taskId) return;
        void fetchReports();
    }, [fetchReports, taskId]);

    const refresh = React.useCallback(() => fetchReports(true), [fetchReports]);

    return { data, loading, error, refresh };
};
