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
    Stack,
    TextField,
    Typography,
    Tooltip,
    useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import CloseIcon from '@mui/icons-material/Close';
import Badge from '@mui/material/Badge';
import type { DocumentIssue, DocumentReviewClient } from '@/app/types/documentReviewTypes';
import { extractFileNameFromUrl } from '@/utils/taskFiles';
import { UI_RADIUS } from '@/config/uiTokens';
import { getStatusLabel } from '@/utils/statusLabels';
import { getStatusColor } from '@/utils/statusColors';

const isPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

type DocumentReviewViewerProps = {
    open: boolean;
    onClose: () => void;
    review: DocumentReviewClient;
    taskId: string;
    token?: string;
    selectedFile: string | null;
    onSelectFile: (file: string) => void;
    onRefresh: () => Promise<void>;
};

export default function DocumentReviewViewer({
    open,
    onClose,
    review,
    taskId,
    token,
    selectedFile,
    onSelectFile,
    onRefresh,
}: DocumentReviewViewerProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [filesDrawerOpen, setFilesDrawerOpen] = React.useState(false);
    const [issuesDrawerOpen, setIssuesDrawerOpen] = React.useState(false);
    const [issueError, setIssueError] = React.useState<string | null>(null);
    const [newIssueText, setNewIssueText] = React.useState('');
    const [issueComments, setIssueComments] = React.useState<Record<string, string>>({});
    const [approving, setApproving] = React.useState(false);
    const [pdfFullScreenOpen, setPdfFullScreenOpen] = React.useState(false);
    const [issueDialogOpen, setIssueDialogOpen] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setFilesDrawerOpen(false);
            setIssuesDrawerOpen(false);
            setIssueError(null);
        }
    }, [open]);

    const canManage = review.role === 'manager';
    const canComment = review.role === 'executor' || review.role === 'manager';
    const canSubmit = review.role === 'executor' || review.role === 'manager';

    const currentFiles = review.currentFiles ?? [];
    const previousFiles = review.previousFiles ?? [];
    const issues = review.issues ?? [];
    const latestVersion = React.useMemo(() => {
        const versions = Array.isArray(review.versions) ? review.versions : [];
        if (!versions.length) return null;
        return [...versions].sort((a, b) => b.version - a.version)[0];
    }, [review.versions]);
    const latestVersionMeta = latestVersion
        ? `Версия v${latestVersion.version} · ${new Date(latestVersion.createdAt).toLocaleString()} · ${latestVersion.createdByName}`
        : 'Текущий пакет без версии';

    const buildProxyUrl = (fileUrl: string, download = false) => {
        const downloadParam = download ? '&download=1' : '';
        const base = `/api/document-reviews/${encodeURIComponent(taskId)}/file?url=${encodeURIComponent(
            fileUrl
        )}${downloadParam}`;
        return token ? `${base}&token=${encodeURIComponent(token)}` : base;
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
            await onRefresh();
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
            await onRefresh();
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
            await onRefresh();
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
            await onRefresh();
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
                            onClick={() => onSelectFile(file)}
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
                    {canManage && review.status !== 'Agreed' && (
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
                issues.map((issue) => {
                    const chipColor = getStatusColor(issue.status === 'resolved' ? 'Agreed' : 'Issues');
                    return (
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
                                        label={issue.status === 'resolved' ? 'Устранено' : 'Открыто'}
                                        sx={
                                            chipColor === 'default'
                                                ? undefined
                                                : { bgcolor: chipColor, color: '#fff' }
                                        }
                                    />
                                </Stack>
                                <Stack spacing={0.5}>
                                    {(issue.comments ?? []).map((comment) => (
                                        <Box
                                            key={comment.id}
                                            sx={{ pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}
                                        >
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
                                                setIssueComments((prev) => ({
                                                    ...prev,
                                                    [issue.id]: event.target.value,
                                                }))
                                            }
                                            multiline
                                            minRows={2}
                                        />
                                        <Button
                                            variant="outlined"
                                            onClick={() =>
                                                handleIssueComment(
                                                    issue.id,
                                                    review.role === 'executor' ? 'fix-note' : 'comment'
                                                )
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
                    );
                })
            )}
        </Stack>
    );

    const pdfSelected = selectedFile && isPdf(selectedFile);

    const headerTitle = React.useMemo(() => {
        const parts = [review.taskId, review.taskName, review.bsNumber]
            .map((value) => (value || '').trim())
            .filter(Boolean);
        return `${parts.join(' ')} — документация`.trim();
    }, [review.taskId, review.taskName, review.bsNumber]);

    return (
        <>
            <Dialog fullScreen open={open} onClose={onClose}>
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                            <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
                                {headerTitle}
                            </Typography>
                            <Chip label={`Статус: ${getStatusLabel(review.status)}`} />
                            <Chip label={`Версия ${review.currentVersion || 0}`} />
                            {canManage && (
                                <Tooltip title="Добавить замечание">
                                    <IconButton
                                        onClick={() => {
                                            setIssuesDrawerOpen(true);
                                            openIssueDialog();
                                        }}
                                    >
                                        <Badge color="error" badgeContent={issues.length || 0} max={99}>
                                            <AnnouncementIcon />
                                        </Badge>
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Tooltip title="Замечания">
                                <IconButton onClick={() => setIssuesDrawerOpen(true)}>
                                    <Badge color="error" badgeContent={issues.length || 0} max={99}>
                                        <CommentOutlinedIcon />
                                    </Badge>
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Закрыть">
                                <IconButton onClick={onClose}>
                                    <CloseIcon />
                                </IconButton>
                            </Tooltip>
                        </Stack>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                            <Button
                                variant="text"
                                startIcon={<FolderOpenIcon />}
                                onClick={() => setFilesDrawerOpen(true)}
                                sx={{ display: { md: 'none' } }}
                            >
                                Файлы
                            </Button>
                            <Typography variant="caption" color="text.secondary">
                                {latestVersionMeta}
                            </Typography>
                            {canSubmit && currentFiles.length === 0 && (
                                <Typography variant="body2" color="text.secondary">
                                    Файлы для согласования пока не загружены.
                                </Typography>
                            )}
                        </Stack>

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

                        </Stack>
                    </Stack>
                </Box>
            </Dialog>

            <Drawer anchor="left" open={filesDrawerOpen} onClose={() => setFilesDrawerOpen(false)}>
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
                sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
                BackdropProps={{ sx: { zIndex: (theme) => theme.zIndex.modal } }}
            >
                <Box sx={{ width: 320, p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        Замечания
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    {renderIssues(issues)}
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
                                    onClick={() => {
                                        setIssuesDrawerOpen(true);
                                        openIssueDialog();
                                    }}
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
                    {issueError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {issueError}
                        </Alert>
                    )}
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
        </>
    );
}
