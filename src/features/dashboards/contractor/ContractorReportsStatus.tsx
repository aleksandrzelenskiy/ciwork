'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Chip, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ReportClient } from '@/app/types/reportTypes';
import { getStatusLabel } from '@/utils/statusLabels';
import { getStatusColor } from '@/utils/statusColors';
import { fetchUserContext } from '@/app/utils/userContext';

const REPORT_STATUSES = ['Pending', 'Issues', 'Fixed', 'Agreed'] as const;

type ReportStatus = (typeof REPORT_STATUSES)[number];

export default function ContractorReportsStatus() {
    const theme = useTheme();
    const [reports, setReports] = useState<ReportClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [clerkUserId, setClerkUserId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchReports() {
            try {
                const [userContext, reportsResponse] = await Promise.all([
                    fetchUserContext(),
                    fetch('/api/reports'),
                ]);
                const userId = (userContext?.user as { clerkUserId?: string })?.clerkUserId ?? null;
                setClerkUserId(userId);

                const res = reportsResponse;
                if (!res.ok) {
                    setError('Ошибка при загрузке фотоотчетов');
                    return;
                }
                const data = await res.json();
                setReports(data.reports || []);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }
        fetchReports();
    }, []);

    const statusCounts = useMemo(() => {
        const counts: Record<ReportStatus, number> = {
            Pending: 0,
            Issues: 0,
            Fixed: 0,
            Agreed: 0,
        };
        const filteredReports = clerkUserId
            ? reports.filter((report) => report.createdById === clerkUserId)
            : reports;

        filteredReports.forEach((report) => {
            report.baseStatuses?.forEach((base) => {
                const status = base.status as ReportStatus;
                if (status in counts) {
                    counts[status] += 1;
                }
            });
        });
        return counts;
    }, [reports, clerkUserId]);

    if (loading || !clerkUserId) {
        return (
            <Box display='flex' justifyContent='center' alignItems='center' minHeight={120}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Typography color='error' textAlign='center'>
                {error}
            </Typography>
        );
    }

    const totalReports = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    return (
        <Box>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                {`Всего базовых станций в отчетах: ${totalReports}`}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {REPORT_STATUSES.map((status) => (
                    <Chip
                        key={status}
                        label={`${getStatusLabel(status)}: ${statusCounts[status]}`}
                        sx={{
                            backgroundColor: getStatusColor(status),
                            color: theme.palette.common.white,
                        }}
                        size='small'
                    />
                ))}
            </Box>
        </Box>
    );
}
