// app/reports/[taskId]/[baseId]/page.tsx

'use client';

import React from 'react';
import { Box, Button, CircularProgress, Snackbar, Alert, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import ReportHeader from '@/app/components/reports/ReportHeader';
import ReportGallery from '@/app/components/reports/ReportGallery';
import ReportIssuesPanel from '@/app/components/reports/ReportIssuesPanel';
import ReportActions from '@/app/components/reports/ReportActions';
import ReportFixUploader from '@/app/components/reports/ReportFixUploader';
import type { ApiResponse, BaseStatus } from '@/app/types/reportTypes';

type ReportPayload = {
    taskId: string;
    taskName?: string;
    bsNumber?: string;
    files: string[];
    fixedFiles: string[];
    createdAt: string;
    executorName?: string;
    status: string;
    issues: string[];
    role?: string | null;
};

type RelatedReport = BaseStatus;

export default function PhotoReportPage() {
    const { taskId, baseId } = useParams() as { taskId: string; baseId: string };
    const searchParams = useSearchParams();
    const token = searchParams?.get('token')?.trim() || '';
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [report, setReport] = React.useState<ReportPayload | null>(null);
    const [relatedReports, setRelatedReports] = React.useState<RelatedReport[]>([]);
    const [alertState, setAlertState] = React.useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info' | 'warning';
    }>({ open: false, message: '', severity: 'success' });
    const [fixDialogOpen, setFixDialogOpen] = React.useState(false);
    const [downloading, setDownloading] = React.useState(false);

    const showAlert = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
        setAlertState({ open: true, message, severity });
    };

    const handleCloseAlert = () => {
        setAlertState((prev) => ({ ...prev, open: false }));
    };

    const fetchReport = React.useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/reports/${taskId}/${baseId}${tokenParam}`);
            const data = (await response.json().catch(() => null)) as (ReportPayload & { error?: string }) | null;
            if (!response.ok || !data || data.error) {
                setError(data?.error || 'Не удалось загрузить отчет');
                return;
            }
            setReport({
                ...data,
                createdAt: data.createdAt ? new Date(data.createdAt).toLocaleDateString() : '—',
            });
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить отчет');
        } finally {
            setLoading(false);
        }
    }, [taskId, baseId, tokenParam]);

    const fetchRelatedReports = React.useCallback(async () => {
        try {
            const response = await fetch(token ? `/api/reports?token=${encodeURIComponent(token)}` : '/api/reports');
            const data = (await response.json().catch(() => null)) as ApiResponse | null;
            if (!response.ok || !data || !Array.isArray(data.reports)) {
                setRelatedReports([]);
                return;
            }
            const currentTaskId = taskId.toUpperCase();
            const taskEntry = data.reports.find(
                (entry) => entry.taskId?.toUpperCase() === currentTaskId
            );
            const baseStatuses = Array.isArray(taskEntry?.baseStatuses)
                ? taskEntry.baseStatuses
                : [];
            const normalizedBaseId = baseId.toLowerCase();
            const sorted = baseStatuses
                .filter((base) => base.baseId?.toLowerCase() !== normalizedBaseId)
                .sort((a, b) => {
                    const aTime = a.latestStatusChangeDate
                        ? new Date(a.latestStatusChangeDate).getTime()
                        : 0;
                    const bTime = b.latestStatusChangeDate
                        ? new Date(b.latestStatusChangeDate).getTime()
                        : 0;
                    return bTime - aTime;
                });
            setRelatedReports(sorted);
        } catch {
            setRelatedReports([]);
        }
    }, [taskId, baseId, token]);

    React.useEffect(() => {
        void fetchReport();
        void fetchRelatedReports();
    }, [fetchReport, fetchRelatedReports]);

    const canApprove = report?.role === 'admin' || report?.role === 'manager' || report?.role === 'viewer';
    const canEditIssues = canApprove;
    const canUploadFix = report?.role === 'executor';
    const canDownload = report?.status === 'Agreed';

    const handleApprove = async () => {
        if (!report) return;
        const response = await fetch(`/api/reports/${taskId}/${baseId}${tokenParam}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Agreed' }),
        });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
            showAlert(payload.error || 'Не удалось согласовать', 'error');
            return;
        }
        showAlert('Отчет согласован', 'success');
        await fetchReport();
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
            showAlert(payload.error || 'Не удалось сохранить замечания', 'error');
            return;
        }
        showAlert(issues.length ? 'Замечания сохранены' : 'Замечания сняты', 'success');
        await fetchReport();
    };

    const handleDownloadReport = async () => {
        if (downloading) return;
        setDownloading(true);
        try {
            const response = await fetch(`/api/reports/${taskId}/${baseId}/download`);
            if (!response.ok) {
                showAlert('Не удалось скачать отчет', 'error');
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
            showAlert('Не удалось скачать отчет', 'error');
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
                <Alert severity="error">{error || 'Отчет не найден'}</Alert>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                px: { xs: 2, md: 6 },
                py: { xs: 3, md: 6 },
                background: 'linear-gradient(180deg, #f5f7fb 0%, #ffffff 100%)',
                minHeight: '100vh',
            }}
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
                Назад к списку
            </Button>

            <Stack spacing={3}>
                <ReportHeader
                    taskId={report.taskId}
                    taskName={report.taskName}
                    bsNumber={report.bsNumber}
                    baseId={baseId}
                    createdByName={report.executorName}
                    createdAt={report.createdAt}
                    status={report.status}
                />

                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
                    <Stack spacing={3} sx={{ flex: 1 }}>
                        <ReportGallery title="Основные фото" photos={report.files} />
                        <ReportGallery title="Исправления" photos={report.fixedFiles} />
                    </Stack>
                    <Stack spacing={3} sx={{ width: { xs: '100%', lg: 360 }, flexShrink: 0 }}>
                        <ReportActions
                            status={report.status}
                            canApprove={canApprove}
                            canUploadFix={canUploadFix}
                            onApprove={handleApprove}
                            onUploadFix={() => setFixDialogOpen(true)}
                        />
                        <ReportIssuesPanel
                            issues={report.issues || []}
                            canEdit={canEditIssues}
                            onSave={handleSaveIssues}
                        />
                        <Box
                            sx={{
                                borderRadius: 3,
                                border: '1px solid rgba(15,23,42,0.08)',
                                backgroundColor: '#fff',
                                p: 2,
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                Связанные отчеты
                            </Typography>
                            {relatedReports.length === 0 ? (
                                <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.6)' }}>
                                    Нет других фотоотчетов по этой задаче.
                                </Typography>
                            ) : (
                                <Stack spacing={1}>
                                    {relatedReports.map((related) => (
                                        <Button
                                            key={related.baseId}
                                            component={Link}
                                            href={`/reports/${encodeURIComponent(
                                                taskId
                                            )}/${encodeURIComponent(related.baseId)}${tokenParam}`}
                                            variant="outlined"
                                            sx={{
                                                justifyContent: 'space-between',
                                                textTransform: 'none',
                                                borderRadius: 2,
                                                px: 2,
                                                py: 1,
                                            }}
                                        >
                                            <Typography variant="body2">
                                                БС {related.baseId}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: 'rgba(15,23,42,0.6)' }}>
                                                {related.status}
                                            </Typography>
                                        </Button>
                                    ))}
                                </Stack>
                            )}
                        </Box>
                        {canDownload && (
                            <Button
                                variant="outlined"
                                onClick={handleDownloadReport}
                                disabled={downloading}
                                startIcon={<CloudDownloadIcon />}
                                sx={{ borderRadius: 999, textTransform: 'none' }}
                            >
                                {downloading ? 'Скачиваем…' : 'Скачать отчет'}
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
                onUploaded={() => void fetchReport()}
            />
        </Box>
    );
}
