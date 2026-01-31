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
    Drawer,
    IconButton,
    LinearProgress,
    Stack,
    TextField,
    Typography,
    Tooltip,
    useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import type { DocumentIssue, DocumentReviewClient } from '@/app/types/documentReviewTypes';
import { extractFileNameFromUrl } from '@/utils/taskFiles';
import { UI_RADIUS } from '@/config/uiTokens';
import { getStatusLabel } from '@/utils/statusLabels';

const isPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

export default function DocumentReviewPage() {
    const { taskId } = useParams() as { taskId: string };
    const searchParams = useSearchParams();
    const token = searchParams?.get('token')?.trim() || '';
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [review, setReview] = React.useState<DocumentReviewClient | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
    const [filesDrawerOpen, setFilesDrawerOpen] = React.useState(false);
    const [issuesDrawerOpen, setIssuesDrawerOpen] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [issueError, setIssueError] = React.useState<string | null>(null);
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
    const [newIssueText, setNewIssueText] = React.useState('');
    const [issueComments, setIssueComments] = React.useState<Record<string, string>>({});
    const [approving, setApproving] = React.useState(false);
    const [pdfFullScreenOpen, setPdfFullScreenOpen] = React.useState(false);
    const [issueDialogOpen, setIssueDialogOpen] = React.useState(false);

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

    React.useEffect(() => {
        void loadReview();
    }, [loadReview]);

    const canManage = review?.role === 'manager';
    const canComment = review?.role === 'executor' || review?.role === 'manager';
    const canUpload = review?.role === 'executor' || review?.role === 'manager';
    const canSubmit = canUpload;

    const currentFiles = review?.currentFiles ?? [];
    const previousFiles = review?.previousFiles ?? [];

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
            await loadReview();
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Не удалось загрузить файлы');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSubmitError(payload.error || 'Не удалось отправить документацию');
                return;
            }
            await loadReview();
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Не удалось отправить документацию');
        } finally {
            setSubmitting(false);
        }
    };

    const handleIssueCreate = async (): Promise<boolean> => {
        if (!newIssueText.trim()) {
            setIssueError('Введите текст замечания');
            return false;
        }
        setIssueError(null);
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}/issues`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: newIssueText }),
            });
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setIssueError(payload.error || 'Не удалось добавить замечание');
                return false;
            }
            setNewIssueText('');
            await loadReview();
            return true;
        } catch (err) {
            setIssueError(err instanceof Error ? err.message : 'Не удалось добавить замечание');
            return false;
        }
    };

    const handleIssueResolve = async (issueId: string) => {
        setIssueError(null);
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}/issues`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resolve', issueId }),
            });
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setIssueError(payload.error || 'Не удалось подтвердить замечание');
                return;
            }
            await loadReview();
        } catch (err) {
            setIssueError(err instanceof Error ? err.message : 'Не удалось подтвердить замечание');
        }
    };

    const handleIssueComment = async (issueId: string, type: 'comment' | 'fix-note') => {
        const text = issueComments[issueId]?.trim();
        if (!text) {
            setIssueError('Введите комментарий');
            return;
        }
        setIssueError(null);
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}/issues`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'comment', issueId, text, type }),
            });
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setIssueError(payload.error || 'Не удалось добавить комментарий');
                return;
            }
            setIssueComments((prev) => ({ ...prev, [issueId]: '' }));
            await loadReview();
        } catch (err) {
            setIssueError(err instanceof Error ? err.message : 'Не удалось добавить комментарий');
        }
    };

    const handleApprove = async () => {
        setApproving(true);
        setIssueError(null);
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}/approve`, {
                method: 'POST',
            });
            const payload = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setIssueError(payload.error || 'Не удалось согласовать документацию');
                return;
            }
            await loadReview();
        } catch (err) {
            setIssueError(err instanceof Error ? err.message : 'Не удалось согласовать документацию');
        } finally {
            setApproving(false);
        }
    };

    const openIssueDialog = () => {
        if (!canManage) return;
        const filename = selectedFile ? extractFileNameFromUrl(selectedFile, 'Файл') : '';
        if (filename) {
            setNewIssueText((prev) => (prev ? prev : `Файл: ${filename}\n`));
        }
        setIssueDialogOpen(true);
    };

    const closeIssueDialog = () => {
        setIssueDialogOpen(false);
    };

    const buildProxyUrl = (fileUrl: string, download = false) => {
        const downloadParam = download ? '&download=1' : '';
        const base = `/api/document-reviews/${encodeURIComponent(taskId)}/file?url=${encodeURIComponent(fileUrl)}${downloadParam}`;
        return token ? `${base}&token=${encodeURIComponent(token)}` : base;
    };

    const renderFileList = (label: string, files: string[]) => (
        <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
                {label}
            </Typography>
            {files.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    Нет файлов
                </Typography>
            ) : (
                files.map((file) => (
                    <Stack key={file} direction="row" spacing={1} alignItems="center">
                        <Button
                            variant={selectedFile === file ? 'contained' : 'text'}
                            onClick={() => setSelectedFile(file)}
                            sx={{ justifyContent: 'flex-start', textTransform: 'none', flexGrow: 1 }}
                        >
                            {extractFileNameFromUrl(file, 'Файл')}
                        </Button>
                        <Tooltip title="Скачать">
                            <IconButton component="a" href={buildProxyUrl(file, true)} target="_blank" rel="noreferrer">
                                <CloudDownloadIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                ))
            )}
        </Stack>
    );

    const renderIssues = (issues: DocumentIssue[]) => (
        <Stack spacing={2}>
            {issueError && <Alert severity="error">{issueError}</Alert>}
            {canManage && (
                <Stack spacing={1}>
                    <TextField
                        label="Новое замечание"
                        value={newIssueText}
                        onChange={(event) => setNewIssueText(event.target.value)}
                        multiline
                        minRows={2}
                    />
                    <Button variant="contained" onClick={handleIssueCreate}>
                        Добавить замечание
                    </Button>
                </Stack>
            )}
            {issues.length === 0 ? (
                <Stack spacing={1}>
                    <Alert severity="success">Замечаний нет — документация готова к согласованию.</Alert>
                    {canManage && review?.status !== 'Agreed' && (
                        <Button
                            variant="contained"
                            color="success"
                            onClick={handleApprove}
                            disabled={approving || currentFiles.length === 0}
                        >
                            Согласовать документацию
                        </Button>
                    )}
                </Stack>
            ) : (
                issues.map((issue) => (
                    <Box
                        key={issue.id}
                        sx={{
                            p: 1.5,
                            borderRadius: UI_RADIUS.surface,
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Stack spacing={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                                    {issue.text}
                                </Typography>
                                <Chip
                                    size="small"
                                    color={issue.status === 'resolved' ? 'success' : 'warning'}
                                    label={issue.status === 'resolved' ? 'Устранено' : 'Открыто'}
                                />
                            </Stack>
                            <Stack spacing={0.5}>
                                {(issue.comments ?? []).map((comment) => (
                                    <Box key={comment.id} sx={{ pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {comment.authorName}
                                        </Typography>
                                        <Typography variant="body2">{comment.text}</Typography>
                                    </Box>
                                ))}
                            </Stack>
                            {canComment && (
                                <Stack spacing={1}>
                                    <TextField
                                        label="Ответ / комментарий"
                                        value={issueComments[issue.id] ?? ''}
                                        onChange={(event) =>
                                            setIssueComments((prev) => ({ ...prev, [issue.id]: event.target.value }))
                                        }
                                        multiline
                                        minRows={2}
                                    />
                                    <Button
                                        variant="outlined"
                                        onClick={() =>
                                            handleIssueComment(issue.id, review?.role === 'executor' ? 'fix-note' : 'comment')
                                        }
                                    >
                                        Добавить комментарий
                                    </Button>
                                </Stack>
                            )}
                            {canManage && issue.status !== 'resolved' && (
                                <Button
                                    variant="contained"
                                    color="success"
                                    onClick={() => handleIssueResolve(issue.id)}
                                    startIcon={<CheckCircleIcon />}
                                >
                                    Подтвердить устранение
                                </Button>
                            )}
                        </Stack>
                    </Box>
                ))
            )}
        </Stack>
    );

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

    const pdfSelected = selectedFile && isPdf(selectedFile);

    return (
        <Box sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                    <Button
                        component={Link}
                        href={`/tasks/${encodeURIComponent(taskId)}`}
                        startIcon={<ArrowBackIcon />}
                        sx={{ alignSelf: 'flex-start' }}
                    >
                        К задаче
                    </Button>
                    <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
                        Документация
                    </Typography>
                    <Chip label={`Статус: ${getStatusLabel(review.status)}`} />
                    <Chip label={`Версия ${review.currentVersion || 0}`} />
                    <IconButton onClick={loadReview} aria-label="refresh">
                        <RefreshIcon />
                    </IconButton>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                    {canUpload && (
                        <Button variant="outlined" component="label">
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
                    )}
                    {canUpload && (
                        <Button
                            variant="contained"
                            startIcon={<CloudUploadIcon />}
                            onClick={handleUpload}
                            disabled={uploading}
                        >
                            Загрузить пакет
                        </Button>
                    )}
                    {canSubmit && (
                        <Button
                            variant="outlined"
                            onClick={handleSubmit}
                            disabled={submitting || currentFiles.length === 0}
                        >
                            Отправить на согласование
                        </Button>
                    )}
                    <Button
                        variant="text"
                        startIcon={<FolderOpenIcon />}
                        onClick={() => setFilesDrawerOpen(true)}
                        sx={{ display: { md: 'none' } }}
                    >
                        Файлы
                    </Button>
                    <Button
                        variant="text"
                        startIcon={<CommentOutlinedIcon />}
                        onClick={() => setIssuesDrawerOpen(true)}
                        sx={{ display: { md: 'none' } }}
                    >
                        Замечания
                    </Button>
                </Stack>

                {uploadError && <Alert severity="error">{uploadError}</Alert>}
                {submitError && <Alert severity="error">{submitError}</Alert>}
                {uploading && <LinearProgress />}
                {submitting && <LinearProgress />}
                {selectedFiles.length > 0 && (
                    <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                            Выбрано файлов: {selectedFiles.length}
                        </Typography>
                        {selectedFiles.slice(0, 3).map((file) => (
                            <Typography key={file.name} variant="body2">
                                {file.name}
                            </Typography>
                        ))}
                        {selectedFiles.length > 3 && (
                            <Typography variant="caption" color="text.secondary">
                                и ещё {selectedFiles.length - 3}
                            </Typography>
                        )}
                    </Stack>
                )}

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
                    {!isMobile && (
                        <Box
                            sx={{
                                width: 260,
                                borderRadius: UI_RADIUS.surface,
                                border: '1px solid',
                                borderColor: 'divider',
                                p: 2,
                                height: 'fit-content',
                            }}
                        >
                            <Stack spacing={2}>
                                {renderFileList('Текущий пакет', currentFiles)}
                                {renderFileList('Предыдущая версия', previousFiles)}
                            </Stack>
                        </Box>
                    )}

                    <Box
                        sx={{
                            flexGrow: 1,
                            minHeight: { xs: 360, md: 520 },
                            borderRadius: UI_RADIUS.surface,
                            border: '1px solid',
                            borderColor: 'divider',
                            overflow: 'hidden',
                            position: 'relative',
                        }}
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                zIndex: 2,
                                display: 'flex',
                                gap: 1,
                            }}
                        >
                            {selectedFile && pdfSelected && (
                                <Tooltip title="Открыть на весь экран">
                                    <IconButton
                                        size="small"
                                        onClick={() => setPdfFullScreenOpen(true)}
                                        sx={{
                                            backgroundColor: 'rgba(15,23,42,0.8)',
                                            color: '#fff',
                                            '&:hover': { backgroundColor: 'rgba(15,23,42,0.9)' },
                                        }}
                                    >
                                        <OpenInFullIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Box>
                    {selectedFile && pdfSelected ? (
                            <iframe
                                title="document-pdf"
                                src={buildProxyUrl(selectedFile)}
                                style={{ width: '100%', height: '100%', border: 'none' }}
                            />
                        ) : (
                            <Box sx={{ p: 3 }}>
                                <Typography variant="body2" color="text.secondary">
                                    Выберите PDF для просмотра. Остальные файлы доступны для скачивания.
                                </Typography>
                                {selectedFile && (
                                    <Button
                                        component="a"
                                        href={buildProxyUrl(selectedFile, true)}
                                        target="_blank"
                                        rel="noreferrer"
                                        sx={{ mt: 2 }}
                                    >
                                        Скачать выбранный файл
                                    </Button>
                                )}
                            </Box>
                        )}
                    </Box>

                    {!isMobile && (
                        <Box
                            sx={{
                                width: 360,
                                borderRadius: UI_RADIUS.surface,
                                border: '1px solid',
                                borderColor: 'divider',
                                p: 2,
                                height: 'fit-content',
                            }}
                        >
                            {renderIssues(review.issues ?? [])}
                        </Box>
                    )}
                </Stack>

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
                                                    {new Date(version.createdAt).toLocaleString()}
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
                                        </Stack>
                                    </Box>
                                ))
                        )}
                    </Stack>
                </Box>
            </Stack>

            <Drawer
                anchor="left"
                open={filesDrawerOpen}
                onClose={() => setFilesDrawerOpen(false)}
            >
                <Box sx={{ width: 280, p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Файлы
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={2}>
                        {renderFileList('Текущий пакет', currentFiles)}
                        {renderFileList('Предыдущая версия', previousFiles)}
                    </Stack>
                </Box>
            </Drawer>

            <Drawer
                anchor="right"
                open={issuesDrawerOpen}
                onClose={() => setIssuesDrawerOpen(false)}
            >
                <Box sx={{ width: 320, p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Замечания
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    {renderIssues(review.issues ?? [])}
                </Box>
            </Drawer>

            <Dialog fullScreen open={pdfFullScreenOpen} onClose={() => setPdfFullScreenOpen(false)}>
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#0f172a',
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            zIndex: 3,
                            display: 'flex',
                            gap: 1,
                        }}
                    >
                        {canManage && (
                            <Tooltip title="Добавить замечание">
                                <IconButton
                                    onClick={openIssueDialog}
                                    sx={{
                                        backgroundColor: 'rgba(255,255,255,0.15)',
                                        color: '#fff',
                                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.25)' },
                                    }}
                                >
                                    <AnnouncementIcon />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Tooltip title="Закрыть просмотр">
                            <IconButton
                                onClick={() => setPdfFullScreenOpen(false)}
                                sx={{
                                    backgroundColor: 'rgba(255,255,255,0.15)',
                                    color: '#fff',
                                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.25)' },
                                }}
                            >
                                <CloseFullscreenIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    {selectedFile ? (
                        <iframe
                            title="document-pdf-fullscreen"
                            src={buildProxyUrl(selectedFile)}
                            style={{ width: '100%', height: '100%', border: 'none' }}
                        />
                    ) : null}
                </Box>
            </Dialog>

            <Dialog open={issueDialogOpen} onClose={closeIssueDialog} fullWidth maxWidth="sm">
                <DialogTitle>Добавить замечание</DialogTitle>
                <DialogContent dividers>
                    {issueError && <Alert severity="error" sx={{ mb: 2 }}>{issueError}</Alert>}
                    <TextField
                        label="Новое замечание"
                        value={newIssueText}
                        onChange={(event) => setNewIssueText(event.target.value)}
                        multiline
                        minRows={3}
                        fullWidth
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeIssueDialog}>Отмена</Button>
                    <Button
                        variant="contained"
                        onClick={async () => {
                            const ok = await handleIssueCreate();
                            if (ok) closeIssueDialog();
                        }}
                    >
                        Добавить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
