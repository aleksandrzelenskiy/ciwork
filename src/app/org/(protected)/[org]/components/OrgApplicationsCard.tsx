import * as React from 'react';
import {
    Box,
    Button,
    CircularProgress,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import WavingHandIcon from '@mui/icons-material/WavingHand';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { ApplicationRow } from '@/types/org';
import { UI_RADIUS } from '@/config/uiTokens';

type OrgApplicationsCardProps = {
    applicationsLoading: boolean;
    applicationsPreview: ApplicationRow[];
    applicationsCount: number;
    onOpenDialog: () => void;
    onRefresh: () => void;
    masonryCardSx: SxProps<Theme>;
    cardBorder: string;
    isDarkMode: boolean;
    textSecondary: string;
    buttonRadius: number;
};

const statusLabel = (status: string) => {
    if (status === 'accepted') return 'Принят';
    if (status === 'rejected') return 'Отклонен';
    if (status === 'submitted') return 'Отправлен';
    return status || '—';
};

const statusColor = (status: string, fallback: string) => {
    if (status === 'accepted') return 'success.main';
    if (status === 'rejected') return 'error.main';
    if (status === 'submitted') return 'text.secondary';
    return fallback;
};

export default function OrgApplicationsCard({
    applicationsLoading,
    applicationsPreview,
    applicationsCount,
    onOpenDialog,
    onRefresh,
    masonryCardSx,
    cardBorder,
    isDarkMode,
    textSecondary,
    buttonRadius,
}: OrgApplicationsCardProps) {
    return (
        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                        <WavingHandIcon fontSize="small" />
                        <Typography variant="subtitle1" fontWeight={600}>
                            Отклики на задачи
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Открыть список">
                            <span>
                                <IconButton onClick={onOpenDialog}>
                                    <OpenInFullIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Обновить">
                            <span>
                                <IconButton onClick={onRefresh} disabled={applicationsLoading}>
                                    <RefreshIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                </Stack>
                <Typography variant="body2" color={textSecondary}>
                    Всего заявок: {applicationsCount}.
                </Typography>
                {applicationsLoading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={18} />
                        <Typography variant="body2">Загружаем отклики…</Typography>
                    </Stack>
                ) : applicationsPreview.length > 0 ? (
                    <Stack spacing={1}>
                        {applicationsPreview.map((app) => (
                            <Box
                                key={app._id}
                                sx={{
                                    borderRadius: UI_RADIUS.thin,
                                    p: 1.25,
                                    border: `1px solid ${cardBorder}`,
                                    backgroundColor: isDarkMode
                                        ? 'rgba(12,16,26,0.7)'
                                        : 'rgba(255,255,255,0.7)',
                                }}
                            >
                                <Typography variant="body2" fontWeight={600}>
                                    {app.taskName}
                                    {app.bsNumber ? ` · BS${app.bsNumber}` : ''}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {app.contractorName || app.contractorEmail || 'Без кандидата'} ·{' '}
                                    <Box component="span" sx={{ color: statusColor(app.status, textSecondary) }}>
                                        {statusLabel(app.status)}
                                    </Box>
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                ) : (
                    <Typography variant="body2" color={textSecondary}>
                        Откликов пока нет.
                    </Typography>
                )}
                <Button
                    variant="contained"
                    onClick={onOpenDialog}
                    sx={{ borderRadius: buttonRadius, textTransform: 'none', alignSelf: 'flex-start' }}
                >
                    Открыть список
                </Button>
            </Stack>
        </Box>
    );
}
