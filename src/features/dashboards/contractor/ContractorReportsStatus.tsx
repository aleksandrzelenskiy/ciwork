'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Chip, CircularProgress, Typography } from '@mui/material';
import type { ReportClient } from '@/app/types/reportTypes';
import { getStatusLabel } from '@/utils/statusLabels';
import { getStatusColor } from '@/utils/statusColors';

const REPORT_STATUSES = ['Pending', 'Issues', 'Fixed', 'Agreed'] as const;

type ReportStatus = (typeof REPORT_STATUSES)[number];

export default function ContractorReportsStatus() {
    const [reports, setReports] = useState<ReportClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchReports() {
            try {
                const res = await fetch('/api/reports');
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
        reports.forEach((report) => {
            report.baseStatuses?.forEach((base) => {
                const status = base.status as ReportStatus;
                if (status in counts) {
                    counts[status] += 1;
                }
            });
        });
        return counts;
    }, [reports]);

    if (loading) {
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
                            color: '#fff',
                        }}
                        size='small'
                    />
                ))}
            </Box>
        </Box>
    );
}
