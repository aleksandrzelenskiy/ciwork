import * as React from 'react';
import {
    Alert,
    Button,
    Card,
    CardContent,
    CardHeader,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PreviewIcon from '@mui/icons-material/Preview';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { ApplicationRow } from '@/types/org';

type ApplicationsDialogProps = {
    open: boolean;
    onClose: () => void;
    applications: ApplicationRow[];
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    onOpenTask: (application: ApplicationRow) => void;
    onRemoveApplication: (application: ApplicationRow) => void;
    removingApplication: boolean;
    cardBaseSx: SxProps<Theme>;
    cardHeaderSx: SxProps<Theme>;
    cardContentSx: SxProps<Theme>;
    dialogPaperSx: SxProps<Theme>;
    dialogActionsSx: SxProps<Theme>;
    dialogContentBg?: string;
    alertSx: SxProps<Theme>;
};

export default function ApplicationsDialog({
    open,
    onClose,
    applications,
    loading,
    error,
    onRefresh,
    onOpenTask,
    onRemoveApplication,
    removingApplication,
    cardBaseSx,
    cardHeaderSx,
    cardContentSx,
    dialogPaperSx,
    dialogActionsSx,
    dialogContentBg,
    alertSx,
}: ApplicationsDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            slotProps={{
                paper: {
                    sx: dialogPaperSx,
                },
            }}
        >
            <DialogTitle sx={cardHeaderSx}>
                Отклики на публичные задачи
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: dialogContentBg }}>
                <Card variant="outlined" sx={cardBaseSx}>
                    <CardHeader
                        sx={cardHeaderSx}
                        title="Отклики на публичные задачи"
                        subheader="Последние 50 заявок подрядчиков"
                        action={
                            <Tooltip title="Обновить">
                                <span>
                                    <IconButton onClick={onRefresh} disabled={loading}>
                                        <RefreshIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        }
                    />
                    <CardContent sx={cardContentSx}>
                        {error ? (
                            <Alert severity="warning" sx={{ ...alertSx, mb: 2 }}>
                                {error}
                            </Alert>
                        ) : null}
                        {loading ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <CircularProgress size={20} />
                                <Typography>Загружаем отклики…</Typography>
                            </Stack>
                        ) : applications.length === 0 ? (
                            <Typography color="text.secondary">
                                Откликов пока нет.
                            </Typography>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Задача</TableCell>
                                        <TableCell>Кандидат</TableCell>
                                        <TableCell>Ставка</TableCell>
                                        <TableCell>Статус</TableCell>
                                        <TableCell>Создано</TableCell>
                                        <TableCell align="right">Действия</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {applications.map((app) => (
                                        <TableRow key={app._id} hover>
                                            <TableCell sx={{ maxWidth: 220 }}>
                                                <Typography variant="body2" fontWeight={600} noWrap>
                                                    {app.taskName}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                    {app.bsNumber ? `БС ${app.bsNumber}` : '—'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {app.publicStatus === 'assigned'
                                                        ? 'Назначена'
                                                        : app.publicStatus === 'open'
                                                            ? 'Открыта'
                                                            : app.publicStatus || '—'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">{app.contractorName || '—'}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {app.contractorEmail || '—'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {Number.isFinite(app.proposedBudget)
                                                    ? `${new Intl.NumberFormat('ru-RU').format(app.proposedBudget)} ₽`
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={app.status}
                                                    color={
                                                        app.status === 'accepted'
                                                            ? 'success'
                                                            : app.status === 'rejected'
                                                                ? 'error'
                                                                : app.status === 'submitted'
                                                                    ? 'info'
                                                                    : 'default'
                                                    }
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">
                                                    {app.createdAt
                                                        ? new Date(app.createdAt).toLocaleDateString('ru-RU')
                                                        : '—'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                    <Tooltip title="Перейти в задачу">
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => onOpenTask(app)}
                                                                disabled={!app.projectKey}
                                                            >
                                                                <PreviewIcon fontSize="small" />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                    <Tooltip title="Удалить отклик">
                                                        <span>
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                onClick={() => onRemoveApplication(app)}
                                                                disabled={removingApplication}
                                                            >
                                                                <DeleteOutlineOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
}
