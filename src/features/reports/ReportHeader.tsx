import { Box, Button, Link, Typography, Stack } from '@mui/material';
import NextLink from 'next/link';
import ReportStatusPill from '@/features/reports/ReportStatusPill';

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
}: ReportHeaderProps) {
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
                Фотоотчет
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
                        Задача{' '}
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
                        · БС {baseId}
                    </Typography>
                </Box>
                <ReportStatusPill status={status} />
            </Stack>
            <Typography
                variant="body2"
                sx={(theme) => ({
                    color:
                        theme.palette.mode === 'dark'
                            ? 'rgba(226,232,240,0.7)'
                            : 'rgba(15,23,42,0.65)',
                })}
            >
                Создан {createdAt || '—'} ·{' '}
                {createdById && onOpenProfile ? (
                    <Button
                        variant="text"
                        size="small"
                        onClick={() => onOpenProfile(createdById)}
                        sx={{ textTransform: 'none', px: 0, minWidth: 0 }}
                    >
                        {createdByName || 'Исполнитель'}
                    </Button>
                ) : (
                    createdByName || 'Исполнитель'
                )}
            </Typography>
        </Stack>
    );
}
