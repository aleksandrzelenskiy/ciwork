import { Box, Button, Chip, Link, Typography, Stack } from '@mui/material';
import NextLink from 'next/link';
import ReportStatusPill from '@/features/reports/ReportStatusPill';
import type { PhotoReportSummary } from '@/app/types/reportTypes';
import { getStatusColor } from '@/utils/statusColors';
import { normalizeStatusTitle } from '@/utils/statusLabels';
import { useI18n } from '@/i18n/I18nProvider';

type ReportHeaderProps = {
    taskId: string;
    taskName?: string | null;
    bsNumber?: string | null;
    baseId: string;
    orgSlug?: string | null;
    projectKey?: string | null;
    createdByName?: string | null;
    createdById?: string | null;
    createdAt?: string;
    status: string;
    onOpenProfile?: (clerkUserId?: string | null) => void;
    relatedBases?: PhotoReportSummary[];
    token?: string;
};

const buildReportHref = (taskId: string, baseId: string, token?: string) => {
    const href = `/reports/${encodeURIComponent(taskId)}/${encodeURIComponent(baseId)}`;
    if (!token) return href;
    const params = new URLSearchParams({ token });
    return `${href}?${params.toString()}`;
};

export default function ReportHeader({
    taskId,
    taskName,
    bsNumber,
    baseId,
    orgSlug,
    projectKey,
    createdByName,
    createdById,
    createdAt,
    status,
    onOpenProfile,
    relatedBases = [],
    token,
}: ReportHeaderProps) {
    const { t } = useI18n();
    const title = `${taskName || taskId}${bsNumber ? ` ${bsNumber}` : ''}`;

    return (
        <Stack spacing={1.5}>
            <Typography
                variant="overline"
                sx={(theme) => ({
                    letterSpacing: 2,
                    color:
                        theme.palette.mode === 'dark'
                            ? 'rgba(226,232,240,0.6)'
                            : 'rgba(15,23,42,0.55)',
                })}
            >
                {t('reports.header.title', 'Фотоотчет')}
            </Typography>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
            >
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {title}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={(theme) => ({
                            color:
                                theme.palette.mode === 'dark'
                                    ? 'rgba(226,232,240,0.68)'
                                    : 'rgba(15,23,42,0.6)',
                        })}
                    >
                        {t('reports.header.task', 'Задача')}{' '}
                        {orgSlug && projectKey ? (
                            <Link
                                component={NextLink}
                                href={`/org/${encodeURIComponent(orgSlug)}/projects/${encodeURIComponent(
                                    projectKey
                                )}/tasks/${encodeURIComponent(taskId)}`}
                                underline="hover"
                                color="inherit"
                            >
                                {taskId}
                            </Link>
                        ) : (
                            taskId
                        )}{' '}
                        · {t('reports.base', 'БС {baseId}', { baseId })}
                    </Typography>
                </Box>
                <ReportStatusPill status={status} />
            </Stack>
            {relatedBases.length > 1 && (
                <Stack spacing={1}>
                    <Typography
                        variant="caption"
                        sx={(theme) => ({
                            color:
                                theme.palette.mode === 'dark'
                                    ? 'rgba(226,232,240,0.65)'
                                    : 'rgba(15,23,42,0.6)',
                        })}
                    >
                        {t('reports.header.quickNav', 'Быстрый переход по БС')}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {relatedBases.map((item) => {
                            const isActive = item.baseId.toLowerCase() === baseId.toLowerCase();
                            const normalizedStatus = normalizeStatusTitle(item.status);
                            const statusColor = getStatusColor(normalizedStatus);
                            return (
                                <Chip
                                    key={item.baseId}
                                    label={
                                        isActive
                                            ? t('reports.header.baseActive', 'БС {baseId} · текущая', { baseId: item.baseId })
                                            : t('reports.base', 'БС {baseId}', { baseId: item.baseId })
                                    }
                                    component={NextLink}
                                    href={buildReportHref(taskId, item.baseId, token)}
                                    clickable
                                    sx={{
                                        fontWeight: 600,
                                        borderRadius: 999,
                                        border: isActive ? '1px solid rgba(59,130,246,0.6)' : '1px solid transparent',
                                        backgroundColor: isActive
                                            ? 'rgba(59,130,246,0.18)'
                                            : statusColor === 'default'
                                                  ? (theme) =>
                                                        theme.palette.mode === 'dark'
                                                            ? 'rgba(148,163,184,0.2)'
                                                            : 'rgba(15,23,42,0.08)'
                                                  : statusColor,
                                        color: isActive
                                            ? (theme) => theme.palette.text.primary
                                            : statusColor === 'default'
                                                  ? (theme) => theme.palette.text.primary
                                                  : '#fff',
                                    }}
                                />
                            );
                        })}
                    </Stack>
                </Stack>
            )}
            <Typography
                variant="body2"
                sx={(theme) => ({
                    color:
                        theme.palette.mode === 'dark'
                            ? 'rgba(226,232,240,0.7)'
                            : 'rgba(15,23,42,0.65)',
                })}
            >
                {t('reports.header.createdAt', 'Создан {date} ·', { date: createdAt || '—' })}{' '}
                {createdById && onOpenProfile ? (
                    <Button
                        variant="text"
                        size="small"
                        onClick={() => onOpenProfile(createdById)}
                        sx={{ textTransform: 'none', px: 0, minWidth: 0 }}
                    >
                        {createdByName || t('reports.header.executor', 'Исполнитель')}
                    </Button>
                ) : (
                    createdByName || t('reports.header.executor', 'Исполнитель')
                )}
            </Typography>
        </Stack>
    );
}
