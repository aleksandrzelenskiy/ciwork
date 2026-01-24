// app/reports/[taskId]/[baseId]/page.tsx

'use client';

import React from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    Stack,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import ReportHeader from '@/features/reports/ReportHeader';
import ReportGallery from '@/features/reports/ReportGallery';
import ReportIssuesPanel from '@/features/reports/ReportIssuesPanel';
import ReportActions from '@/features/reports/ReportActions';
import ReportFixUploader from '@/features/reports/ReportFixUploader';
import PhotoReportUploader from '@/features/tasks/PhotoReportUploader';
import type { PhotoReport } from '@/app/types/taskTypes';
import { usePhotoReports } from '@/hooks/usePhotoReports';
import ReportSummaryList from '@/features/reports/ReportSummaryList';
import { getPhotoReportPermissions, type PhotoReportRole } from '@/utils/photoReportState';
import { UI_RADIUS } from '@/config/uiTokens';
import ProfileDialog from '@/features/profile/ProfileDialog';
import { useI18n } from '@/i18n/I18nProvider';

type ReportPayload = {
    taskId: string;
    taskName?: string;
    bsNumber?: string;
    orgSlug?: string | null;
    projectKey?: string | null;
    files: string[];
    fixedFiles: string[];
    createdAt: string;
    createdById?: string;
    createdByName?: string;
    executorName?: string;
    status: string;
    issues: string[];
    role?: PhotoReportRole;
};

export default function PhotoReportPage() {
    const { t } = useI18n();
    const { taskId, baseId } = useParams() as { taskId: string; baseId: string };
    const searchParams = useSearchParams();
    const token = searchParams?.get('token')?.trim() || '';
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [report, setReport] = React.useState<ReportPayload | null>(null);
    const [alertState, setAlertState] = React.useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info' | 'warning';
    }>({ open: false, message: '', severity: 'success' });
    const [fixDialogOpen, setFixDialogOpen] = React.useState(false);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);
    const [approveDialogOpen, setApproveDialogOpen] = React.useState(false);
    const [nextBasesDialogOpen, setNextBasesDialogOpen] = React.useState(false);
    const [approving, setApproving] = React.useState(false);
    const [downloading, setDownloading] = React.useState(false);
    const [profileUserId, setProfileUserId] = React.useState<string | null>(null);
    const [profileOpen, setProfileOpen] = React.useState(false);

    const showAlert = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
        setAlertState({ open: true, message, severity });
    };

    const handleCloseAlert = () => {
        setAlertState((prev) => ({ ...prev, open: false }));
    };

    const openProfileDialog = (clerkUserId?: string | null) => {
        if (!clerkUserId) return;
        setProfileUserId(clerkUserId);
        setProfileOpen(true);
    };

    const closeProfileDialog = () => {
        setProfileOpen(false);
        setProfileUserId(null);
    };

    const fetchReport = React.useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/reports/${taskId}/${baseId}${tokenParam}`);
            const data = (await response.json().catch(() => null)) as (ReportPayload & { error?: string }) | null;
            if (!response.ok || !data || data.error) {
                setError(data?.error || t('reports.error.load', 'Не удалось загрузить отчет'));
                return;
            }
            setReport({
                ...data,
                createdAt: data.createdAt ? new Date(data.createdAt).toLocaleDateString() : '—',
            });
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('reports.error.load', 'Не удалось загрузить отчет'));
        } finally {
            setLoading(false);
        }
    }, [taskId, baseId, tokenParam, t]);

    React.useEffect(() => {
        void fetchReport();
    }, [fetchReport]);

    const { data: reportSummaries, refresh: refreshReportSummaries } = usePhotoReports(taskId, token);
    const permissions = getPhotoReportPermissions({
        role: report?.role ?? null,
        status: report?.status ?? '',
    });
    const canApprove = permissions.canApprove;
    const canEditIssues = permissions.canApprove;
    const canUploadFix = permissions.canUploadFix;
    const canDownload = permissions.canDownload;
    const canEditReport = permissions.canEdit;

    const baseIdsFromTask = React.useMemo(() => {
        const raw = report?.bsNumber?.trim() ?? '';
        if (!raw) return [];
        return raw
            .split('-')
            .map((value) => value.trim())
            .filter(Boolean);
    }, [report?.bsNumber]);

    const baseOptions = React.useMemo(() => {
        const ids = [
            baseId,
            ...reportSummaries.map((item) => item.baseId),
            ...baseIdsFromTask,
        ].filter(Boolean);
        return Array.from(new Set(ids));
    }, [baseId, reportSummaries, baseIdsFromTask]);

    const editLocations = React.useMemo(
        () => baseOptions.map((id) => ({ name: id })),
        [baseOptions]
    );

    const editPhotoReports = React.useMemo(() => {
        if (!report) return [];
        const createdAt = report.createdAt ? new Date(report.createdAt) : new Date();
        return [
            {
                _id: `${report.taskId}-${baseId}`,
                taskId: report.taskId,
                baseId,
                status: report.status,
                createdAt,
                files: report.files,
                fixedFiles: report.fixedFiles,
                issues: report.issues,
            },
        ] as PhotoReport[];
    }, [report, baseId]);

    const handleApproveRequest = () => {
        setApproveDialogOpen(true);
    };

    const handleApprove = async () => {
        if (!report) return;
        if (approving) return;
        setApproving(true);
        const response = await fetch(`/api/reports/${taskId}/${baseId}${tokenParam}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Agreed' }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
            aggregatedStatus?: string | null;
            allBasesAgreed?: boolean;
        };
        if (!response.ok) {
            showAlert(payload.error || t('reports.error.approve', 'Не удалось согласовать'), 'error');
            setApproving(false);
            return;
        }
        if (payload.allBasesAgreed) {
            showAlert(t('reports.approve.allAgreed', 'Все БС согласованы. Фотоотчет закрыт.'), 'success');
        } else if (baseOptions.length > 1) {
            showAlert(t('reports.approve.baseAgreedPending', 'БС согласована. Остальные БС еще на проверке.'), 'info');
            setNextBasesDialogOpen(true);
        } else {
            showAlert(t('reports.approve.baseAgreedPending', 'БС согласована. Остальные БС еще на проверке.'), 'info');
        }
        setApproveDialogOpen(false);
        await fetchReport();
        setApproving(false);
    };

    const handleSaveIssues = async (issues: string[]) => {
        const response = await fetch(`/api/reports/${taskId}/${baseId}${tokenParam}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                issues,
                status: issues.length ? 'Issues' : 'Pending',
            }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
            showAlert(payload.error || t('reports.error.saveIssues', 'Не удалось сохранить замечания'), 'error');
            return;
        }
        showAlert(
            issues.length
                ? t('reports.issues.saved', 'Замечания сохранены')
                : t('reports.issues.cleared', 'Замечания сняты'),
            'success',
        );
        await fetchReport();
    };

    const handleDownloadReport = async () => {
        if (downloading) return;
        setDownloading(true);
        try {
            const response = await fetch(`/api/reports/${taskId}/${baseId}/download${tokenParam}`);
            if (!response.ok) {
                showAlert(t('reports.error.download', 'Не удалось скачать отчет'), 'error');
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report-${baseId}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            showAlert(t('reports.error.download', 'Не удалось скачать отчет'), 'error');
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" mt={6}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !report) {
        return (
            <Box display="flex" justifyContent="center" mt={6}>
                <Alert severity="error">{error || t('reports.error.notFound', 'Отчет не найден')}</Alert>
            </Box>
        );
    }

    return (
        <Box
            sx={(theme) => ({
                px: { xs: 2, md: 6 },
                py: { xs: 3, md: 6 },
                background:
                    theme.palette.mode === 'dark'
                        ? 'linear-gradient(180deg, #0b0f16 0%, #0f141f 100%)'
                        : 'linear-gradient(180deg, #f5f7fb 0%, #ffffff 100%)',
                minHeight: '100vh',
            })}
        >
            <Snackbar
                open={alertState.open}
                autoHideDuration={3000}
                onClose={handleCloseAlert}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseAlert} severity={alertState.severity} sx={{ width: '100%' }}>
                    {alertState.message}
                </Alert>
            </Snackbar>

            <Button
                component={Link}
                href={token ? `/reports?token=${encodeURIComponent(token)}` : '/reports'}
                startIcon={<ArrowBackIcon />}
                sx={{ textTransform: 'none', mb: 3 }}
            >
                {t('reports.all', 'Все фотоотчеты')}
            </Button>

            <Stack spacing={3}>
            <ReportHeader
                taskId={report.taskId}
                taskName={report.taskName}
                bsNumber={report.bsNumber}
                baseId={baseId}
                orgSlug={report.orgSlug}
                projectKey={report.projectKey}
                createdByName={report.createdByName || report.executorName}
                createdById={report.createdById}
                createdAt={report.createdAt}
                status={report.status}
                onOpenProfile={openProfileDialog}
                relatedBases={reportSummaries}
                token={token}
            />

                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
                    <Stack spacing={3} sx={{ flex: 1 }}>
                        <ReportGallery title={t('reports.gallery.main', 'Основные фото')} photos={report.files} />
                        <ReportGallery title={t('reports.gallery.fixed', 'Исправления')} photos={report.fixedFiles} />
                    </Stack>
                    <Stack spacing={3} sx={{ width: { xs: '100%', lg: 360 }, flexShrink: 0 }}>
                        <ReportIssuesPanel
                            issues={report.issues || []}
                            canEdit={canEditIssues}
                            onSave={handleSaveIssues}
                            status={report.status}
                        />
                        <ReportActions
                            status={report.status}
                            canApprove={canApprove}
                            canUploadFix={canUploadFix}
                            canEdit={canEditReport}
                            onApprove={handleApproveRequest}
                            onUploadFix={() => setFixDialogOpen(true)}
                            onEdit={() => setEditDialogOpen(true)}
                        />
                        <Box
                            sx={(theme) => ({
                                borderRadius: UI_RADIUS.tooltip,
                                border:
                                    theme.palette.mode === 'dark'
                                        ? '1px solid rgba(148,163,184,0.18)'
                                        : '1px solid rgba(15,23,42,0.08)',
                                backgroundColor:
                                    theme.palette.mode === 'dark'
                                        ? 'rgba(15,18,26,0.92)'
                                        : '#fff',
                                p: 2,
                            })}
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                {t('reports.relatedBases.title', 'Связанные БС')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                {t('reports.relatedBases.current', 'Сейчас открыта БС {baseId}. Согласование применяется только к этой БС.', { baseId })}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                {t('reports.relatedBases.total', 'Всего БС по задаче: {count}.', { count: baseOptions.length })}
                            </Typography>
                            <ReportSummaryList
                                items={reportSummaries}
                                taskId={taskId}
                                token={token}
                                mode="list"
                                activeBaseId={baseId}
                                emptyText={t('reports.relatedBases.empty', 'Нет фотоотчетов по этой задаче.')}
                            />
                        </Box>
                        {canDownload && (
                            <Button
                                variant="outlined"
                                onClick={handleDownloadReport}
                                disabled={downloading}
                                startIcon={<CloudDownloadIcon />}
                                sx={{ borderRadius: UI_RADIUS.pill, textTransform: 'none' }}
                            >
                                {downloading
                                    ? t('reports.download.loading', 'Скачиваем…')
                                    : t('reports.download', 'Скачать отчет')}
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </Stack>

            <ReportFixUploader
                open={fixDialogOpen}
                onClose={() => setFixDialogOpen(false)}
                taskId={report.taskId}
                baseId={baseId}
                onUploaded={() => {
                    void fetchReport();
                    void refreshReportSummaries();
                }}
            />
            <PhotoReportUploader
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                taskId={report.taskId}
                taskName={report.taskName}
                bsLocations={editLocations}
                photoReports={editPhotoReports}
                onUploaded={() => {
                    void fetchReport();
                    void refreshReportSummaries();
                }}
                onSubmitted={() => {
                    void fetchReport();
                    void refreshReportSummaries();
                }}
                readOnly={!canEditReport}
                initialBaseId={baseId}
            />
            <Dialog
                open={approveDialogOpen}
                onClose={() => setApproveDialogOpen(false)}
                aria-labelledby="report-approve-title"
                aria-describedby="report-approve-description"
            >
                <DialogTitle id="report-approve-title">
                    {t('reports.approve.title', 'Подтвердить согласование')}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="report-approve-description">
                        {t(
                            'reports.approve.description',
                            'Согласование применяется к текущей БС. Если все БС по задаче будут согласованы, фотоотчет и задача перейдут в статус «Согласовано».'
                        )}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setApproveDialogOpen(false)}
                        disabled={approving}
                        sx={{ textTransform: 'none' }}
                    >
                        {t('common.cancel', 'Отмена')}
                    </Button>
                    <Button
                        onClick={handleApprove}
                        variant="contained"
                        color="success"
                        disabled={approving}
                        sx={{ textTransform: 'none' }}
                    >
                        {approving
                            ? t('reports.approve.loading', 'Согласуем…')
                            : t('reports.approve.action', 'Согласовать')}
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={nextBasesDialogOpen}
                onClose={() => setNextBasesDialogOpen(false)}
                aria-labelledby="next-bases-title"
                aria-describedby="next-bases-description"
            >
                <DialogTitle id="next-bases-title">
                    {t('reports.nextBases.title', 'Проверить связанные БС')}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="next-bases-description">
                        {t(
                            'reports.nextBases.description',
                            'В этой задаче есть другие БС. Перейдите к ним, чтобы завершить проверку работ по задаче.'
                        )}
                    </DialogContentText>
                    <Box sx={{ mt: 2 }}>
                        <ReportSummaryList
                            items={reportSummaries}
                            taskId={taskId}
                            token={token}
                            mode="list"
                            activeBaseId={baseId}
                            emptyText={t('reports.nextBases.empty', 'Нет других фотоотчетов.')}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setNextBasesDialogOpen(false)}
                        sx={{ textTransform: 'none' }}
                    >
                        {t('common.close', 'Закрыть')}
                    </Button>
                </DialogActions>
            </Dialog>

            <ProfileDialog
                open={profileOpen}
                onClose={closeProfileDialog}
                clerkUserId={profileUserId}
            />
        </Box>
    );
}
