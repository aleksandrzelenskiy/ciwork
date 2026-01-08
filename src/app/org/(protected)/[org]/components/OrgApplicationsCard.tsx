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
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { ApplicationRow } from '@/types/org';

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
                    <Typography variant="subtitle1" fontWeight={600}>
                        Отклики на задачи
                    </Typography>
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
                                    borderRadius: 1,
                                    p: 1.25,
                                    border: `1px solid ${cardBorder}`,
                                    backgroundColor: isDarkMode
                                        ? 'rgba(12,16,26,0.7)'
                                        : 'rgba(255,255,255,0.7)',
                                }}
                            >
                                <Typography variant="body2" fontWeight={600}>
                                    {app.taskName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {app.contractorName || app.contractorEmail || 'Без кандидата'} · {app.status}
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
