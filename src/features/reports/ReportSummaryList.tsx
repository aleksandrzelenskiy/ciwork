import React from 'react';
import NextLink from 'next/link';
import { Box, Button, Chip, Link, Stack, Typography } from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import type { PhotoReportSummary } from '@/app/types/reportTypes';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel, normalizeStatusTitle } from '@/utils/statusLabels';

type ReportSummaryListProps = {
    items: PhotoReportSummary[];
    taskId: string;
    token?: string;
    mode?: 'pill' | 'list';
    activeBaseId?: string;
    emptyText?: string;
};

const buildReportHref = (taskId: string, baseId: string, token?: string) => {
    const href = `/reports/${encodeURIComponent(taskId)}/${encodeURIComponent(baseId)}`;
    if (!token) return href;
    const params = new URLSearchParams({ token });
    return `${href}?${params.toString()}`;
};

export default function ReportSummaryList({
    items,
    taskId,
    token,
    mode = 'pill',
    activeBaseId,
    emptyText = 'Нет фотоотчетов.',
}: ReportSummaryListProps) {
    if (!items.length) {
        return (
            <Typography variant="body2" color="text.secondary">
                {emptyText}
            </Typography>
        );
    }

    if (mode === 'list') {
        return (
            <Stack spacing={1}>
                {items.map((item) => {
                    const normalizedStatus = normalizeStatusTitle(item.status);
                    const statusColor = getStatusColor(normalizedStatus);
                    const statusChipSx =
                        statusColor === 'default'
                            ? {
                                  fontWeight: 600,
                                  backgroundColor: (theme) =>
                                      theme.palette.mode === 'dark'
                                          ? 'rgba(148,163,184,0.2)'
                                          : 'rgba(15,23,42,0.08)',
                                  color: (theme) => theme.palette.text.primary,
                              }
                            : { backgroundColor: statusColor, color: '#fff', fontWeight: 600 };
                    const isActive = activeBaseId?.toLowerCase() === item.baseId.toLowerCase();
                    return (
                        <Button
                            key={item.baseId}
                            component={NextLink}
                            href={buildReportHref(taskId, item.baseId, token)}
                            variant="outlined"
                            disabled={isActive}
                            sx={{
                                justifyContent: 'space-between',
                                textTransform: 'none',
                                borderRadius: 2,
                                px: 2,
                                py: 1,
                                ...(isActive
                                    ? {
                                          borderColor: 'rgba(59,130,246,0.4)',
                                          backgroundColor: (theme) =>
                                              theme.palette.mode === 'dark'
                                                  ? 'rgba(59,130,246,0.18)'
                                                  : 'rgba(59,130,246,0.08)',
                                      }
                                    : null),
                            }}
                        >
                            <Stack direction="row" spacing={1} alignItems="center">
                                <FolderOutlinedIcon
                                    fontSize="small"
                                    sx={{
                                        color:
                                            statusColor === 'default'
                                                ? (theme) =>
                                                      theme.palette.mode === 'dark'
                                                          ? 'rgba(226,232,240,0.6)'
                                                          : 'rgba(15,23,42,0.45)'
                                                : statusColor,
                                    }}
                                />
                                <Box>
                                    <Typography variant="body2" fontWeight={600}>
                                        БС {item.baseId}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Основные: {item.filesCount} · Исправления: {item.fixedCount}
                                    </Typography>
                                </Box>
                            </Stack>
                            <Chip label={getStatusLabel(normalizedStatus)} size="small" sx={statusChipSx} />
                        </Button>
                    );
                })}
            </Stack>
        );
    }

    return (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {items.map((item) => {
                const normalizedStatus = normalizeStatusTitle(item.status);
                const statusColor = getStatusColor(normalizedStatus);
                const isActive = activeBaseId?.toLowerCase() === item.baseId.toLowerCase();
                const chipSx =
                    statusColor === 'default'
                        ? {
                              fontWeight: 500,
                              backgroundColor: (theme) =>
                                  theme.palette.mode === 'dark'
                                      ? 'rgba(148,163,184,0.2)'
                                      : 'rgba(15,23,42,0.08)',
                              color: (theme) => theme.palette.text.primary,
                          }
                        : { bgcolor: statusColor, color: '#fff', fontWeight: 500 };
                return (
                    <Link
                        key={item.baseId}
                        component={NextLink}
                        href={buildReportHref(taskId, item.baseId, token)}
                        underline="none"
                        color="inherit"
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1,
                            py: 0.5,
                            borderRadius: 999,
                            backgroundColor: isActive
                                ? 'rgba(59,130,246,0.12)'
                                : (theme) =>
                                      theme.palette.mode === 'dark'
                                          ? 'rgba(148,163,184,0.16)'
                                          : 'rgba(15,23,42,0.04)',
                            border: isActive ? '1px solid rgba(59,130,246,0.35)' : '1px solid transparent',
                            '&:hover': {
                                backgroundColor: isActive
                                    ? 'rgba(59,130,246,0.18)'
                                    : (theme) =>
                                          theme.palette.mode === 'dark'
                                              ? 'rgba(148,163,184,0.26)'
                                              : 'rgba(15,23,42,0.08)',
                            },
                        }}
                    >
                        <FolderOutlinedIcon fontSize="small" />
                        <Box>
                            <Typography variant="body2" fontWeight={600}>
                                БС {item.baseId}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Основные: {item.filesCount} · Исправления: {item.fixedCount}
                            </Typography>
                        </Box>
                        <Chip
                            label={getStatusLabel(normalizedStatus)}
                            size="small"
                            sx={chipSx}
                        />
                    </Link>
                );
            })}
        </Stack>
    );
}
