'use client';

import React from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    CircularProgress,
    IconButton,
    LinearProgress,
    Paper,
    Stack,
    Typography,
    Tooltip,
    TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import type { DocumentReviewClient } from '@/app/types/documentReviewTypes';
import { extractFileNameFromUrl } from '@/utils/taskFiles';
import { UI_RADIUS } from '@/config/uiTokens';
import { getStatusLabel } from '@/utils/statusLabels';
import DocumentReviewViewer from '@/features/documents/DocumentReviewViewer';
import DocumentDiffViewer from '@/features/documents/DocumentDiffViewer';
import { fetchPdfBlobUrl } from '@/utils/pdfBlobCache';

const isPdf = (url: string) => extractFileNameFromUrl(url, '').toLowerCase().endsWith('.pdf');
const isPdfFile = (file: File) =>
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
const createLocalId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type SelectedFileItem = {
    id: string;
    file: File;
    previewUrl: string;
    pdf: boolean;
};

type PdfThumbnailProps = {
    fileUrl: string;
    buildProxyUrl: (fileUrl: string) => string;
};

function PdfThumbnail({ fileUrl, buildProxyUrl }: PdfThumbnailProps) {
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [error, setError] = React.useState(false);

    React.useEffect(() => {
        setPreviewUrl(null);
        setError(false);

        const controller = new AbortController();
        const proxyUrl = buildProxyUrl(fileUrl);

        fetchPdfBlobUrl(proxyUrl, async () => {
            const res = await fetch(proxyUrl, { signal: controller.signal });
            if (!res.ok) {
                throw new Error('Failed to load PDF');
            }
            return res.blob();
        })
            .then((blobUrl) => {
                setPreviewUrl(blobUrl);
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return;
                setError(true);
            });

        return () => {
            controller.abort();
        };
    }, [buildProxyUrl, fileUrl]);

    if (error) {
        return (
            <Stack spacing={0.5} alignItems="center">
                <InsertDriveFileOutlinedIcon color="action" />
                <Typography variant="caption" color="text.secondary">
                    PDF
                </Typography>
            </Stack>
        );
    }

    if (!previewUrl) {
        return (
            <Stack spacing={0.5} alignItems="center">
                <InsertDriveFileOutlinedIcon color="action" />
                <Typography variant="caption" color="text.secondary">
                    Загрузка
                </Typography>
            </Stack>
        );
    }

    return <object data={previewUrl} type="application/pdf" style={{ width: '100%', height: '100%' }} />;
}

export default function DocumentReviewPage() {
    const { taskId } = useParams() as { taskId: string };
    const searchParams = useSearchParams();
    const token = searchParams?.get('token')?.trim() || '';
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';

    const [review, setReview] = React.useState<DocumentReviewClient | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [submitting, setSubmitting] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [selectedItems, setSelectedItems] = React.useState<SelectedFileItem[]>([]);
    const [deleteTarget, setDeleteTarget] = React.useState<{
        type: 'selected' | 'uploaded';
        id?: string;
        url?: string;
        name: string;
    } | null>(null);
    const [deleteLoading, setDeleteLoading] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [viewerOpen, setViewerOpen] = React.useState(false);
    const [diffOpen, setDiffOpen] = React.useState(false);
    const [showUploadZone, setShowUploadZone] = React.useState(true);
    const [submitDialogOpen, setSubmitDialogOpen] = React.useState(false);
    const [changeLog, setChangeLog] = React.useState('');

    const selectedItemsRef = React.useRef<SelectedFileItem[]>([]);

    const loadReview = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}${tokenParam}`);
            const data = (await res.json().catch(() => null)) as (DocumentReviewClient & { error?: string }) | null;
            if (!res.ok || !data || data.error) {
                setError(data?.error || 'Не удалось загрузить документацию');
                return;
            }
            setReview(data);
            const allFiles = [...data.currentFiles, ...data.previousFiles];
            const initialPdf =
                data.currentFiles.find(isPdf) ??
                data.previousFiles.find(isPdf) ??
                data.currentFiles[0] ??
                data.previousFiles[0] ??
                null;
            setSelectedFile((prev) => (prev && allFiles.includes(prev) ? prev : initialPdf));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить документацию');
        } finally {
            setLoading(false);
        }
    }, [taskId, tokenParam]);

    const buildProxyUrl = React.useCallback(
        (fileUrl: string, download = false) => {
            const downloadParam = download ? '&download=1' : '';
            const base = `/api/document-reviews/${encodeURIComponent(taskId)}/file?url=${encodeURIComponent(
                fileUrl
            )}${downloadParam}`;
            return token ? `${base}&token=${encodeURIComponent(token)}` : base;
        },
        [taskId, token]
    );

    React.useEffect(() => {
        void loadReview();
    }, [loadReview]);

    React.useEffect(() => {
        selectedItemsRef.current = selectedItems;
    }, [selectedItems]);

    React.useEffect(() => {
        return () => {
            selectedItemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        };
    }, []);

    const isExecutor = review?.role === 'executor';
    const canUpload = isExecutor;

    const currentFiles = React.useMemo(() => review?.currentFiles ?? [], [review?.currentFiles]);
    const previousFiles = React.useMemo(() => review?.previousFiles ?? [], [review?.previousFiles]);
    const currentPdfFiles = React.useMemo(() => currentFiles.filter(isPdf), [currentFiles]);
    const previousPdfFiles = React.useMemo(() => previousFiles.filter(isPdf), [previousFiles]);

    const isSubmittedForReview = review?.status === 'Pending';
    const shouldGateUpload = isExecutor && isSubmittedForReview && currentFiles.length > 0;

    React.useEffect(() => {
        if (shouldGateUpload && selectedItems.length === 0) {
            setShowUploadZone(false);
            return;
        }
        setShowUploadZone(true);
    }, [selectedItems.length, shouldGateUpload]);

    const addSelectedFiles = React.useCallback((files: File[]) => {
        if (!files.length) return;
        setSelectedItems((prev) => [
            ...prev,
            ...files.map((file) => ({
                id: createLocalId(),
                file,
                previewUrl: URL.createObjectURL(file),
                pdf: isPdfFile(file),
            })),
        ]);
        setUploadError(null);
    }, []);

    const removeSelectedItem = React.useCallback((id: string) => {
        setSelectedItems((prev) => {
            const target = prev.find((item) => item.id === id);
            if (target) {
                URL.revokeObjectURL(target.previewUrl);
            }
            return prev.filter((item) => item.id !== id);
        });
    }, []);

    const clearSelectedItems = React.useCallback(() => {
        setSelectedItems((prev) => {
            prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
            return [];
        });
    }, []);

    const onDrop = React.useCallback((acceptedFiles: File[]) => {
        addSelectedFiles(acceptedFiles);
    }, [addSelectedFiles]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        disabled: !canUpload || uploading,
        multiple: true,
    });

    const handleUpload = async () => {
        if (!selectedItems.length) {
            setUploadError('Выберите файлы для загрузки');
            return;
        }
        setUploading(true);
        setUploadProgress(0);
        setUploadError(null);
        const form = new FormData();
        selectedItems.forEach((item) => form.append('file', item.file));
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/document-reviews/${encodeURIComponent(taskId)}/upload`);
        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
        };
        xhr.onload = async () => {
            try {
                const payload = (JSON.parse(xhr.responseText || '{}') ?? {}) as { error?: string };
                if (xhr.status < 200 || xhr.status >= 300) {
                    setUploadError(payload.error || 'Не удалось загрузить файлы');
                    return;
                }
                clearSelectedItems();
                await loadReview();
            } catch (err) {
                setUploadError(err instanceof Error ? err.message : 'Не удалось загрузить файлы');
            } finally {
                setUploading(false);
                setUploadProgress(0);
            }
        };
        xhr.onerror = () => {
            setUploadError('Не удалось загрузить файлы');
            setUploading(false);
            setUploadProgress(0);
        };
        xhr.send(form);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ changeLog: changeLog.trim() }),
            });
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSubmitError(payload.error || 'Не удалось отправить документацию');
                return;
            }
            clearSelectedItems();
            void loadReview();
            setSubmitDialogOpen(false);
            setChangeLog('');
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Не удалось отправить документацию');
        } finally {
            setSubmitting(false);
        }
    };

    const openDeleteDialog = (payload: {
        type: 'selected' | 'uploaded';
        id?: string;
        url?: string;
        name: string;
    }) => {
        setDeleteError(null);
        setDeleteTarget(payload);
    };

    const closeDeleteDialog = () => {
        if (deleteLoading) return;
        setDeleteTarget(null);
        setDeleteError(null);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        if (deleteTarget.type === 'selected' && deleteTarget.id) {
            removeSelectedItem(deleteTarget.id);
            setDeleteTarget(null);
            return;
        }
        if (!deleteTarget.url) return;
        setDeleteLoading(true);
        setDeleteError(null);
        try {
            const res = await fetch(
                `/api/document-reviews/${encodeURIComponent(taskId)}/file?url=${encodeURIComponent(
                    deleteTarget.url
                )}`,
                { method: 'DELETE' }
            );
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setDeleteError(payload.error || 'Не удалось удалить файл');
                return;
            }
            await loadReview();
            setDeleteTarget(null);
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : 'Не удалось удалить файл');
        } finally {
            setDeleteLoading(false);
        }
    };


    const headerTitle = React.useMemo(() => {
        if (!review) return 'Документация';
        const parts = [review.taskId, review.taskName, review.bsNumber]
            .map((value) => (value || '').trim())
            .filter(Boolean);
        return `${parts.join(' ')} — документация`.trim();
    }, [review]);

    const formatDateTime = React.useCallback((value: string | number | Date) => {
        const date = new Date(value);
        const datePart = date.toLocaleDateString('ru-RU');
        const timePart = date
            .toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            .replace(':', '.');
        return `${datePart} ${timePart}`;
    }, []);


    if (loading) {
        return (
            <Box sx={{ p: 3 }}>
                <LinearProgress />
            </Box>
        );
    }

    if (error || !review) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{error || 'Не удалось загрузить документацию'}</Alert>
            </Box>
        );
    }

    const showUploadButton = canUpload && (selectedItems.length > 0 || currentFiles.length === 0);
    const showSubmitButton =
        review.role === 'executor' &&
        currentFiles.length > 0 &&
        selectedItems.length === 0 &&
        review.status !== 'Pending' &&
        review.status !== 'Agreed';

    const latestVersionNumber = review.currentVersion || 0;
    const previousVersionNumber = Math.max(0, latestVersionNumber - 1);

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                    <Button
                        component={Link}
                        href={
                            review.orgSlug && review.projectKey
                                ? `/org/${encodeURIComponent(review.orgSlug)}/projects/${encodeURIComponent(
                                      review.projectKey
                                  )}/tasks/${encodeURIComponent(taskId)}`
                                : `/tasks/${encodeURIComponent(taskId)}`
                        }
                        startIcon={<ArrowBackIcon />}
                        sx={{ alignSelf: 'flex-start' }}
                    >
                        К задаче
                    </Button>
                    <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
                        {headerTitle}
                    </Typography>
                    <Chip label={`Статус: ${getStatusLabel(review.status)}`} />
                    <Chip label={`Версия ${review.currentVersion || 0}`} />
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setDiffOpen(true)}
                        disabled={currentPdfFiles.length === 0 || previousPdfFiles.length === 0}
                    >
                        Изменения
                    </Button>
                    <IconButton onClick={loadReview} aria-label="refresh">
                        <RefreshIcon />
                    </IconButton>
                </Stack>

                {canUpload && (
                    <Stack spacing={2}>
                        {showUploadZone ? (
                            <Box
                                {...getRootProps()}
                                sx={{
                                    border: '1px dashed',
                                    borderColor: isDragActive ? 'primary.main' : 'divider',
                                    borderRadius: UI_RADIUS.surface,
                                    p: 2,
                                    textAlign: 'center',
                                    cursor: uploading ? 'not-allowed' : 'pointer',
                                    bgcolor: isDragActive ? 'rgba(59,130,246,0.08)' : 'transparent',
                                    transition: 'border-color 0.2s ease, background-color 0.2s ease',
                                }}
                            >
                                <input {...getInputProps()} />
                                <Stack spacing={0.5} alignItems="center">
                                    <CloudUploadIcon color={isDragActive ? 'primary' : 'action'} />
                                    <Typography variant="body2" fontWeight={600}>
                                        Перетащите файлы сюда или нажмите, чтобы выбрать
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        PDF и другие форматы · Можно выбрать несколько файлов
                                    </Typography>
                                </Stack>
                            </Box>
                        ) : (
                            <Button variant="text" onClick={() => setShowUploadZone(true)} sx={{ alignSelf: 'flex-start' }}>
                                Загрузить новый пакет
                            </Button>
                        )}

                        {selectedItems.length > 0 && (
                            <Stack spacing={1}>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Выбранные файлы
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                        gap: 1.5,
                                    }}
                                >
                                    {selectedItems.map((item) => (
                                        <Paper
                                            key={item.id}
                                            variant="outlined"
                                            sx={{
                                                p: 1,
                                                borderRadius: 2,
                                                position: 'relative',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    height: 140,
                                                    borderRadius: 2,
                                                    overflow: 'hidden',
                                                    bgcolor: 'rgba(15,23,42,0.04)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                {item.pdf ? (
                                                    <object
                                                        data={item.previewUrl}
                                                        type="application/pdf"
                                                        style={{ width: '100%', height: '100%' }}
                                                    />
                                                ) : (
                                                    <Stack spacing={0.5} alignItems="center">
                                                        <InsertDriveFileOutlinedIcon color="action" />
                                                        <Typography variant="caption" color="text.secondary">
                                                            Файл
                                                        </Typography>
                                                    </Stack>
                                                )}
                                            </Box>
                                            <Tooltip title="Удалить файл">
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            openDeleteDialog({
                                                                type: 'selected',
                                                                id: item.id,
                                                                name: item.file.name,
                                                            })
                                                        }
                                                        disabled={uploading}
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 8,
                                                            right: 8,
                                                            bgcolor: 'rgba(15,23,42,0.65)',
                                                            color: '#fff',
                                                            '&:hover': {
                                                                bgcolor: 'rgba(15,23,42,0.8)',
                                                            },
                                                        }}
                                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Typography
                                                variant="caption"
                                                sx={{ mt: 0.5, display: 'block', wordBreak: 'break-word' }}
                                            >
                                                {item.file.name}
                                            </Typography>
                                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                                <Chip
                                                    size="small"
                                                    label={uploading ? 'Загрузка' : 'Готово'}
                                                    sx={{
                                                        borderRadius: 999,
                                                        fontWeight: 600,
                                                        bgcolor: uploading
                                                            ? 'rgba(59,130,246,0.12)'
                                                            : 'rgba(34,197,94,0.16)',
                                                    }}
                                                />
                                                {uploading && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {uploadProgress}%
                                                    </Typography>
                                                )}
                                            </Stack>
                                            {uploading && (
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={uploadProgress}
                                                    sx={{
                                                        mt: 1,
                                                        height: 6,
                                                        borderRadius: 999,
                                                        backgroundColor: 'rgba(15,23,42,0.08)',
                                                        '& .MuiLinearProgress-bar': {
                                                            borderRadius: 999,
                                                            background:
                                                                'linear-gradient(90deg, rgba(0,122,255,0.9), rgba(88,86,214,0.9))',
                                                        },
                                                    }}
                                                />
                                            )}
                                        </Paper>
                                    ))}
                                </Box>
                            </Stack>
                        )}

                        {selectedItems.length > 0 && (
                            <TextField
                                label="Описание изменений"
                                placeholder="Кратко опишите, что изменилось в этом пакете"
                                value={changeLog}
                                onChange={(event) => setChangeLog(event.target.value)}
                                multiline
                                minRows={3}
                                fullWidth
                                disabled={uploading}
                            />
                        )}

                        {showUploadButton && (
                            <Button
                                variant="contained"
                                startIcon={
                                    uploading ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />
                                }
                                onClick={handleUpload}
                                disabled={uploading || selectedItems.length === 0}
                                sx={{ alignSelf: 'flex-start' }}
                            >
                                {uploading ? 'Загрузка пакета' : 'Загрузить пакет'}
                            </Button>
                        )}
                    </Stack>
                )}

                {isExecutor && currentFiles.length > 0 && !isSubmittedForReview && (
                    <Stack spacing={1}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            Черновик пакета
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            До отправки пакет виден только вам и не отправляет уведомления.
                        </Typography>
                        <Stack spacing={1}>
                            {currentFiles.map((file) => {
                                const filename = extractFileNameFromUrl(file, 'Файл');
                                return (
                                    <Paper
                                        key={file}
                                        variant="outlined"
                                        sx={{
                                            p: 1.5,
                                            borderRadius: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 1,
                                        }}
                                    >
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <InsertDriveFileOutlinedIcon color="action" />
                                            <Typography variant="body2">{filename}</Typography>
                                        </Stack>
                                        <Button
                                            size="small"
                                            onClick={() => {
                                                setSelectedFile(file);
                                                setViewerOpen(true);
                                            }}
                                        >
                                            Открыть
                                        </Button>
                                    </Paper>
                                );
                            })}
                        </Stack>
                    </Stack>
                )}

                {showSubmitButton && (
                    <Button
                        variant="outlined"
                        onClick={() => setSubmitDialogOpen(true)}
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                        sx={{ alignSelf: 'flex-start' }}
                    >
                        Отправить на согласование
                    </Button>
                )}

                {uploadError && <Alert severity="error">{uploadError}</Alert>}
                {submitError && <Alert severity="error">{submitError}</Alert>}
                {submitting && <LinearProgress />}

                <Box
                    sx={{
                        borderRadius: UI_RADIUS.surface,
                        border: '1px solid',
                        borderColor: 'divider',
                        p: 2,
                    }}
                >
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        История версий
                    </Typography>
                    <Divider sx={{ mb: 1.5 }} />
                    <Stack spacing={1.5}>
                        {(review.versions ?? []).length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                                История пока пуста.
                            </Typography>
                        ) : (
                            [...review.versions]
                                .slice()
                                .reverse()
                                .map((version) => (
                                    <Box
                                        key={`version-${version.version}`}
                                        sx={{
                                            p: 1.5,
                                            borderRadius: UI_RADIUS.surface,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                        }}
                                    >
                                        <Stack spacing={1}>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Chip size="small" label={`v${version.version}`} />
                                                <Typography variant="subtitle2">
                                                    {/^user_[a-zA-Z0-9]+$/.test(version.createdByName)
                                                        ? review.executorName || review.initiatorName || '—'
                                                        : version.createdByName}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {formatDateTime(version.createdAt)}
                                                </Typography>
                                            </Stack>
                                            {version.changeLog ? (
                                                <Typography variant="body2">{version.changeLog}</Typography>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    Без описания изменений
                                                </Typography>
                                            )}
                                            <Typography variant="caption" color="text.secondary">
                                                Замечаний на входе: {version.issuesSnapshot?.length ?? 0}
                                            </Typography>

                                            {version.version === latestVersionNumber &&
                                                previousPdfFiles.length > 0 &&
                                                currentPdfFiles.length > 0 && (
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => setDiffOpen(true)}
                                                    sx={{ alignSelf: 'flex-start' }}
                                                >
                                                    Сравнить с предыдущей
                                                </Button>
                                            )}

                                            {version.version === latestVersionNumber && currentFiles.length > 0 && (
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Файлы текущей версии
                                                    </Typography>
                                                    <Box
                                                        sx={{
                                                            mt: 1,
                                                            display: 'grid',
                                                            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                                            gap: 1.5,
                                                        }}
                                                    >
                                                        {currentFiles.map((file) => {
                                                            const filename = extractFileNameFromUrl(file, 'Файл');
                                                            return (
                                                                <Paper
                                                                    key={file}
                                                                    variant="outlined"
                                                                    sx={{
                                                                        p: 1,
                                                                        borderRadius: 2,
                                                                        position: 'relative',
                                                                        overflow: 'hidden',
                                                                        cursor: 'pointer',
                                                                    }}
                                                                    onClick={() => {
                                                                        setSelectedFile(file);
                                                                        setViewerOpen(true);
                                                                    }}
                                                                >
                                                                    <Box
                                                                        sx={{
                                                                            height: 140,
                                                                            borderRadius: 2,
                                                                            overflow: 'hidden',
                                                                            bgcolor: 'rgba(15,23,42,0.04)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            pointerEvents: 'none',
                                                                        }}
                                                                    >
                                                                        {isPdf(file) ? (
                                                                            <Box sx={{ width: '100%', height: '100%' }}>
                                                                                <PdfThumbnail
                                                                                    fileUrl={file}
                                                                                    buildProxyUrl={buildProxyUrl}
                                                                                />
                                                                            </Box>
                                                                        ) : (
                                                                            <Stack spacing={0.5} alignItems="center">
                                                                                <InsertDriveFileOutlinedIcon color="action" />
                                                                                <Typography variant="caption" color="text.secondary">
                                                                                    Файл
                                                                                </Typography>
                                                                            </Stack>
                                                                        )}
                                                                    </Box>
                                                                    <Typography
                                                                        variant="caption"
                                                                        sx={{ mt: 0.5, display: 'block', wordBreak: 'break-word' }}
                                                                    >
                                                                        {filename}
                                                                    </Typography>
                                                                </Paper>
                                                            );
                                                        })}
                                                    </Box>
                                                </Box>
                                            )}

                                            {version.version === previousVersionNumber &&
                                                previousFiles.length > 0 &&
                                                version.version !== latestVersionNumber && (
                                                    <Box>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Файлы предыдущей версии
                                                        </Typography>
                                                        <Stack spacing={0.75} sx={{ mt: 1 }}>
                                                            {previousFiles.map((file) => {
                                                                const filename = extractFileNameFromUrl(file, 'Файл');
                                                                return (
                                                                    <Paper
                                                                        key={file}
                                                                        variant="outlined"
                                                                        sx={{
                                                                            p: 1,
                                                                            borderRadius: 2,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'space-between',
                                                                            gap: 1,
                                                                        }}
                                                                    >
                                                                        <Stack direction="row" spacing={1} alignItems="center">
                                                                            <InsertDriveFileOutlinedIcon color="action" />
                                                                            <Typography variant="body2">{filename}</Typography>
                                                                        </Stack>
                                                                        <Button
                                                                            size="small"
                                                                            onClick={() => {
                                                                                setSelectedFile(file);
                                                                                setViewerOpen(true);
                                                                            }}
                                                                        >
                                                                            Открыть
                                                                        </Button>
                                                                    </Paper>
                                                                );
                                                            })}
                                                        </Stack>
                                                    </Box>
                                                )}

                                            {version.version < previousVersionNumber && (
                                                <Alert severity="info">
                                                    Файлы этой версии удалены из хранилища по политике хранения. Метаданные,
                                                    замечания и diff сохранены.
                                                </Alert>
                                            )}
                                        </Stack>
                                    </Box>
                                ))
                        )}
                    </Stack>
                </Box>
            </Stack>

            <DocumentReviewViewer
                open={viewerOpen}
                onClose={() => setViewerOpen(false)}
                review={review}
                taskId={taskId}
                token={token}
                selectedFile={selectedFile}
                onSelectFile={setSelectedFile}
                onRefresh={loadReview}
            />

            <DocumentDiffViewer
                open={diffOpen}
                onClose={() => setDiffOpen(false)}
                currentFiles={currentPdfFiles}
                previousFiles={previousPdfFiles}
                buildProxyUrl={buildProxyUrl}
            />

            <Dialog open={Boolean(deleteTarget)} onClose={closeDeleteDialog}>
                <DialogTitle>Удалить файл?</DialogTitle>
                <DialogContent>
                    <Stack spacing={1}>
                        {deleteError && <Alert severity="error">{deleteError}</Alert>}
                        <Typography>
                            {deleteTarget?.type === 'selected'
                                ? `Файл "${deleteTarget?.name}" будет удалён из списка перед загрузкой.`
                                : `Файл "${deleteTarget?.name}" будет удалён из текущего пакета.`}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDialog} disabled={deleteLoading}>
                        Отмена
                    </Button>
                    <Button
                        onClick={confirmDelete}
                        color="error"
                        variant="contained"
                        disabled={deleteLoading}
                        startIcon={deleteLoading ? <CircularProgress size={18} color="inherit" /> : null}
                    >
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={submitDialogOpen}
                onClose={() => {
                    if (submitting) return;
                    setSubmitDialogOpen(false);
                }}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Отправить на согласование</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        {submitError && <Alert severity="error">{submitError}</Alert>}
                        <TextField
                            label="Описание изменений"
                            placeholder="Кратко опишите, что изменилось в пакете"
                            value={changeLog}
                            onChange={(event) => setChangeLog(event.target.value)}
                            multiline
                            minRows={4}
                            fullWidth
                            disabled={submitting}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setSubmitDialogOpen(false)}
                        disabled={submitting}
                    >
                        Отмена
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                    >
                        Отправить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
