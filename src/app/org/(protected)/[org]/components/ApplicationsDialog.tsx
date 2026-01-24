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
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import PreviewIcon from '@mui/icons-material/Preview';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { ApplicationRow } from '@/types/org';
import { useI18n } from '@/i18n/I18nProvider';

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

type TranslateFn = (key: string, fallback?: string, params?: Record<string, string | number>) => string;

const statusLabel = (status: string, t: TranslateFn) => {
    if (status === 'accepted') return t('org.applications.status.accepted', 'Принят');
    if (status === 'rejected') return t('org.applications.status.rejected', 'Отклонен');
    if (status === 'submitted') return t('org.applications.status.submitted', 'Отправлен');
    return status || '—';
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
    const { t, locale } = useI18n();
    const numberLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            fullScreen
            slotProps={{
                paper: {
                    sx: { ...dialogPaperSx, borderRadius: 0 },
                },
            }}
        >
            <DialogTitle sx={cardHeaderSx}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="inherit">
                        {t('org.applications.dialog.title', 'Отклики на публичные задачи')}
                    </Typography>
                    <IconButton onClick={onClose}>
                        <CloseFullscreenIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: dialogContentBg }}>
                <Card variant="outlined" sx={cardBaseSx}>
                    <CardHeader
                        sx={cardHeaderSx}
                        title={t('org.applications.dialog.title', 'Отклики на публичные задачи')}
                        subheader={t('org.applications.dialog.subtitle', 'Последние 50 заявок подрядчиков')}
                        action={
                            <Tooltip title={t('common.refresh', 'Обновить')}>
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
                                <Typography>{t('org.applications.loading', 'Загружаем отклики…')}</Typography>
                            </Stack>
                        ) : applications.length === 0 ? (
                            <Typography color="text.secondary">
                                {t('org.applications.empty', 'Откликов пока нет.')}
                            </Typography>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('org.applications.table.task', 'Задача')}</TableCell>
                                        <TableCell>{t('org.applications.table.candidate', 'Кандидат')}</TableCell>
                                        <TableCell>{t('org.applications.table.budget', 'Ставка')}</TableCell>
                                        <TableCell>{t('org.applications.table.status', 'Статус')}</TableCell>
                                        <TableCell>{t('org.applications.table.createdAt', 'Создано')}</TableCell>
                                        <TableCell align="right">{t('common.actions', 'Действия')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {applications.map((app) => (
                                        <TableRow key={app._id} hover>
                                            <TableCell sx={{ maxWidth: 220 }}>
                                                <Typography variant="body2" fontWeight={600} noWrap>
                                                    {app.taskName}
                                                    {app.bsNumber ? ` · ${app.bsNumber}` : ''}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" noWrap>
                                                    {app.bsNumber
                                                        ? t('org.applications.base', 'БС {value}', { value: app.bsNumber })
                                                        : '—'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {app.publicStatus === 'assigned'
                                                        ? t('market.status.assigned', 'Назначена')
                                                        : app.publicStatus === 'open'
                                                            ? t('market.status.open', 'Открыта')
                                                            : app.publicStatus || '—'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {app.contractorName || '—'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {app.contractorEmail || '—'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {Number.isFinite(app.proposedBudget)
                                                    ? `${new Intl.NumberFormat(numberLocale).format(app.proposedBudget)} ₽`
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    label={statusLabel(app.status, t)}
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
                                                        ? new Date(app.createdAt).toLocaleDateString(numberLocale)
                                                        : '—'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                    <Tooltip title={t('org.applications.actions.openTask', 'Перейти в задачу')}>
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
                                                    <Tooltip title={t('org.applications.remove.title', 'Удалить отклик')}>
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
                <Button onClick={onClose}>{t('common.close', 'Закрыть')}</Button>
            </DialogActions>
        </Dialog>
    );
}
