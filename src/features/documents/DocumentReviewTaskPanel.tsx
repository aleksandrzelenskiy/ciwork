'use client';

import React from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    LinearProgress,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import Link from 'next/link';
import type { DocumentReviewClient } from '@/app/types/documentReviewTypes';
import { extractFileNameFromUrl } from '@/utils/taskFiles';
import { getStatusLabel } from '@/utils/statusLabels';

const isPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

type DocumentReviewTaskPanelProps = {
    taskId: string;
};

export default function DocumentReviewTaskPanel({ taskId }: DocumentReviewTaskPanelProps) {
    const [review, setReview] = React.useState<DocumentReviewClient | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
    const [submitDialogOpen, setSubmitDialogOpen] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [changeLog, setChangeLog] = React.useState('');
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [uploadError, setUploadError] = React.useState<string | null>(null);

    const loadReview = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}`);
            const data = (await res.json().catch(() => null)) as (DocumentReviewClient & { error?: string }) | null;
            if (!res.ok || !data || data.error) {
                setError(data?.error || 'Не удалось загрузить документацию');
                return;
            }
            setReview(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить документацию');
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    React.useEffect(() => {
        void loadReview();
    }, [loadReview]);

    const canUpload = review?.role === 'executor' || review?.role === 'manager';
    const canSubmit = canUpload;

    const handleUpload = async () => {
        if (!selectedFiles.length) {
            setUploadError('Выберите файлы для загрузки');
            return;
        }
        setUploading(true);
        setUploadError(null);
        const form = new FormData();
        selectedFiles.forEach((file) => form.append('file', file));
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}/upload`, {
                method: 'POST',
                body: form,
            });
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setUploadError(payload.error || 'Не удалось загрузить файлы');
                return;
            }
            setSelectedFiles([]);
            setUploadDialogOpen(false);
            await loadReview();
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Не удалось загрузить файлы');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!changeLog.trim()) {
            setSubmitError('Заполните список исправлений');
            return;
        }
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changeLog }),
            });
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSubmitError(payload.error || 'Не удалось отправить документацию');
                return;
            }
            setChangeLog('');
            setSubmitDialogOpen(false);
            await loadReview();
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Не удалось отправить документацию');
        } finally {
            setSubmitting(false);
        }
    };

    const closeUploadDialog = () => {
        setUploadDialogOpen(false);
        setUploadError(null);
        setSelectedFiles([]);
    };

    const closeSubmitDialog = () => {
        setSubmitDialogOpen(false);
        setSubmitError(null);
    };

    if (loading) {
        return <LinearProgress sx={{ borderRadius: 1 }} />;
    }

    if (error || !review) {
        return <Alert severity="error">{error || 'Не удалось загрузить документацию'}</Alert>;
    }

    const currentFiles = review.currentFiles ?? [];
    const currentPdf = currentFiles.find(isPdf) ?? currentFiles[0] ?? '';

    return (
        <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                        Статус: {getStatusLabel(review.status)}
                    </Typography>
                <Chip size="small" label={`Версия ${review.currentVersion || 0}`} />
                <Box sx={{ flexGrow: 1 }} />
                <Button
                    size="small"
                    variant="outlined"
                    component={Link}
                    href={`/documents/${encodeURIComponent(taskId.toLowerCase())}`}
                    endIcon={<OpenInNewIcon />}
                >
                    Перейти к согласованию
                </Button>
                {canUpload && (
                    <Button
                        size="small"
                        variant="contained"
                        startIcon={<CloudUploadIcon />}
                        onClick={() => setUploadDialogOpen(true)}
                    >
                        Загрузить пакет
                    </Button>
                )}
                {canSubmit && (
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSubmitDialogOpen(true)}
                        disabled={currentFiles.length === 0}
                    >
                        Отправить на согласование
                    </Button>
                )}
            </Stack>

            <Divider />

            {currentFiles.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    Файлы пока не загружены.
                </Typography>
            ) : (
                <Stack spacing={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                        Текущий пакет ({currentFiles.length})
                    </Typography>
                    <Stack spacing={0.5}>
                        {currentFiles.map((file) => (
                            <Stack key={file} direction="row" spacing={1} alignItems="center">
                                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                    {extractFileNameFromUrl(file, 'Файл')}
                                </Typography>
                                <Box sx={{ flexGrow: 1 }} />
                                <Button size="small" component="a" href={file} target="_blank" rel="noreferrer">
                                    {isPdf(file) ? 'Открыть' : 'Скачать'}
                                </Button>
                            </Stack>
                        ))}
                    </Stack>
                    {currentPdf && (
                        <Typography variant="caption" color="text.secondary">
                            PDF для предварительного просмотра доступен в разделе согласования.
                        </Typography>
                    )}
                </Stack>
            )}

            <Dialog open={uploadDialogOpen} onClose={closeUploadDialog} fullWidth maxWidth="sm">
                <DialogTitle>
                    Загрузка пакета документации
                    <IconButton
                        aria-label="close"
                        onClick={closeUploadDialog}
                        sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        {uploadError && <Alert severity="error">{uploadError}</Alert>}
                        <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />}>
                            Выбрать файлы
                            <input
                                type="file"
                                hidden
                                multiple
                                onChange={(event) => {
                                    const files = Array.from(event.target.files ?? []);
                                    setSelectedFiles(files);
                                }}
                            />
                        </Button>
                        {selectedFiles.length > 0 && (
                            <Stack spacing={0.5}>
                                {selectedFiles.map((file) => (
                                    <Typography key={file.name} variant="body2">
                                        {file.name}
                                    </Typography>
                                ))}
                            </Stack>
                        )}
                        {uploading && <LinearProgress />}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeUploadDialog}>Отмена</Button>
                    <Button onClick={handleUpload} variant="contained" disabled={uploading}>
                        Загрузить
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={submitDialogOpen} onClose={closeSubmitDialog} fullWidth maxWidth="sm">
                <DialogTitle>Отправить на согласование</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        {submitError && <Alert severity="error">{submitError}</Alert>}
                        <Typography variant="body2" color="text.secondary">
                            Опишите исправления или кратко опишите пакет файлов. Это сохранится в истории версий.
                        </Typography>
                        <TextField
                            label="Список исправлений"
                            multiline
                            minRows={3}
                            value={changeLog}
                            onChange={(event) => setChangeLog(event.target.value)}
                        />
                        {submitting && <LinearProgress />}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeSubmitDialog}>Отмена</Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        disabled={submitting}
                    >
                        Отправить
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
