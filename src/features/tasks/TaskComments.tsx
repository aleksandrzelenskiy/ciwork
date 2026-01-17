'use client';

import React from 'react';
import {
    Avatar,
    Box,
    Button,
    CircularProgress,
    Dialog,
    IconButton,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import CloseIcon from '@mui/icons-material/Close';
import type { Socket } from 'socket.io-client';
import { getSocketClient } from '@/app/lib/socketClient';
import { withBasePath } from '@/utils/basePath';

export type TaskComment = {
    _id: string;
    text: string;
    author: string;
    authorId: string;
    createdAt: string | Date;
    photoUrl?: string;
    profilePic?: string;
};

type TaskCommentsProps = {
    taskId?: string | null;
    initialComments?: TaskComment[] | null;
    onTaskUpdated?: (task: { comments?: TaskComment[]; events?: unknown }) => void;
};

type TaskSocketServerToClientEvents = {
    'task:comment:new': (comment: TaskComment) => void;
};

type TaskSocketClientToServerEvents = {
    'task:join': (payload: { taskId: string }) => void;
    'task:leave': (payload: { taskId: string }) => void;
};

type TaskSocket = Socket<TaskSocketServerToClientEvents, TaskSocketClientToServerEvents>;

const formatDateTime = (value: string | Date) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('ru-RU');
};

const isImageUrl = (url: string) => {
    const clean = url.split('?')[0].toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(clean);
};

export default function TaskComments({
    taskId,
    initialComments,
    onTaskUpdated,
}: TaskCommentsProps) {
    const [comments, setComments] = React.useState<TaskComment[]>(initialComments ?? []);
    const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
    const [text, setText] = React.useState('');
    const [file, setFile] = React.useState<File | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [fileProcessing, setFileProcessing] = React.useState(false);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

    const upsertComment = React.useCallback((nextComment: TaskComment) => {
        setComments((prev) => {
            const existingIndex = prev.findIndex((comment) => comment._id === nextComment._id);
            if (existingIndex !== -1) {
                const updated = [...prev];
                updated[existingIndex] = { ...prev[existingIndex], ...nextComment };
                return updated;
            }
            return [...prev, nextComment];
        });
    }, []);

    React.useEffect(() => {
        setComments(initialComments ?? []);
    }, [initialComments]);

    const normalizedTaskId = React.useMemo(
        () => (taskId ? taskId.trim().toUpperCase() : ''),
        [taskId]
    );

    const optimizeImageFile = React.useCallback(async (input: File): Promise<File> => {
        if (!input.type.startsWith('image/')) return input;

        const readAsDataUrl = () =>
            new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string) || '');
                reader.onerror = reject;
                reader.readAsDataURL(input);
            });

        try {
            const dataUrl = await readAsDataUrl();
            if (!dataUrl) return input;

            const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = dataUrl;
            });

            const maxDimension = 1600;
            const scale =
                Math.max(image.width, image.height) > maxDimension
                    ? maxDimension / Math.max(image.width, image.height)
                    : 1;
            const targetWidth = Math.max(Math.round(image.width * scale), 1);
            const targetHeight = Math.max(Math.round(image.height * scale), 1);

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return input;

            ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

            const blob: Blob | null = await new Promise((resolve) =>
                canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.75)
            );
            if (!blob) return input;

            const optimized = new File([blob], input.name.replace(/\.(\w+)$/, '.jpg'), {
                type: blob.type,
                lastModified: Date.now(),
            });

            if (optimized.size >= input.size) {
                return input;
            }
            return optimized;
        } catch (optimizeError) {
            console.error('optimize image failed', optimizeError);
            return input;
        }
    }, []);

    React.useEffect(() => {
        let cancelled = false;

        const loadUser = async () => {
            try {
                const res = await fetch(withBasePath('/api/current-user'), { cache: 'no-store' });
                if (!res.ok) return;

                const payload = (await res.json()) as { user?: { clerkUserId?: string; id?: string } };
                const userId = payload?.user?.clerkUserId || payload?.user?.id || null;
                if (!cancelled) setCurrentUserId(userId);
            } catch (userError) {
                console.error('task comments: failed to load current user', userError);
            }
        };

        void loadUser();

        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        if (!normalizedTaskId) return undefined;

        let cancelled = false;
        let cleanup: (() => void) | null = null;

        const connectSocket = async () => {
            try {
                const socket = (await getSocketClient()) as TaskSocket;
                if (cancelled || !normalizedTaskId) return;

                const handleNewComment = (comment: TaskComment) => {
                    upsertComment(comment);
                };

                socket.emit('task:join', { taskId: normalizedTaskId });
                socket.on('task:comment:new', handleNewComment);

                cleanup = () => {
                    socket.off('task:comment:new', handleNewComment);
                    socket.emit('task:leave', { taskId: normalizedTaskId });
                };
            } catch (socketError) {
                console.error('task comments socket error', socketError);
            }
        };

        void connectSocket();

        return () => {
            cancelled = true;
            cleanup?.();
        };
    }, [normalizedTaskId, upsertComment]);

    const handleSubmit = async () => {
        if (!taskId) {
            setError('Не удалось определить задачу');
            return;
        }
        if (!text.trim()) {
            setError('Введите текст комментария');
            return;
        }
        if (fileProcessing) {
            setError('Дождитесь окончания оптимизации файла');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('text', text.trim());
            if (file) formData.append('photo', file);

            const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/comments`, {
                method: 'POST',
                body: formData,
            });
            const data = (await res.json()) as {
                comment?: TaskComment;
                task?: { comments?: TaskComment[]; events?: unknown };
                error?: string;
            };

            if (!res.ok || !data.comment) {
                setError(data.error || `Не удалось добавить комментарий (${res.status})`);
                return;
            }

            upsertComment(data.comment as TaskComment);
            setText('');
            setFile(null);

            if (data.task) {
                onTaskUpdated?.(data.task);
            }
        } catch (e) {
            console.error(e);
            setError('Произошла ошибка при отправке комментария');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Stack gap={2} sx={{ minWidth: 0 }}>
            {comments.length === 0 ? (
                <Typography color="text.secondary">Комментариев пока нет</Typography>
            ) : (
                <Stack gap={1.5}>
                    {comments.map((comment) => {
                        const isOwn = Boolean(currentUserId && comment.authorId === currentUserId);

                        return (
                            <Stack
                                key={comment._id}
                                direction="row"
                                spacing={1}
                                alignItems="flex-end"
                                justifyContent={isOwn ? 'flex-end' : 'flex-start'}
                                sx={{ width: '100%', flexDirection: isOwn ? 'row-reverse' : 'row' }}
                            >
                                <Avatar
                                    src={comment.profilePic}
                                    alt={comment.author}
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        bgcolor: isOwn ? '#007aff' : undefined,
                                        color: isOwn ? '#fff' : undefined,
                                    }}
                                >
                                    {comment.author?.[0]?.toUpperCase() || '?'}
                                </Avatar>
                                <Paper
                                    elevation={0}
                                    sx={(theme) => ({
                                        p: 1.25,
                                        flex: '0 1 82%',
                                        minWidth: 0,
                                        maxWidth: '100%',
                                        borderRadius: 3,
                                        bgcolor: isOwn ? '#e8f2ff' : '#f5f5f7',
                                        border: isOwn ? '1px solid #b9d6ff' : '1px solid #e5e5ea',
                                        boxShadow: isOwn
                                            ? '0 10px 28px rgba(0,122,255,0.12)'
                                            : '0 6px 18px rgba(0,0,0,0.04)',
                                        alignSelf: 'flex-start',
                                        ...theme.applyStyles?.('dark', {
                                            bgcolor: isOwn
                                                ? 'rgba(0,122,255,0.16)'
                                                : 'rgba(255,255,255,0.06)',
                                            border: isOwn
                                                ? '1px solid rgba(99,179,255,0.6)'
                                                : '1px solid rgba(255,255,255,0.12)',
                                            boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
                                        }),
                                    })}
                                >
                                    <Stack
                                        direction="row"
                                        justifyContent="space-between"
                                        alignItems="baseline"
                                        sx={{ mb: 0.75 }}
                                    >
                                        <Typography
                                            variant="body2"
                                            fontWeight={600}
                                            noWrap
                                            sx={(theme) => ({
                                                color: isOwn ? '#0a84ff' : 'text.primary',
                                                textAlign: isOwn ? 'right' : 'left',
                                                flex: 1,
                                                ...theme.applyStyles?.('dark', {
                                                    color: isOwn ? theme.palette.primary.light : theme.palette.grey[50],
                                                }),
                                            })}
                                        >
                                            {comment.author}
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{ ml: 1, whiteSpace: 'nowrap' }}
                                        >
                                            {formatDateTime(comment.createdAt)}
                                        </Typography>
                                    </Stack>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            whiteSpace: 'pre-wrap',
                                            color: 'text.primary',
                                            wordBreak: 'break-word',
                                            textAlign: isOwn ? 'right' : 'left',
                                        }}
                                    >
                                        {comment.text}
                                    </Typography>
                                    {comment.photoUrl && (
                                        isImageUrl(comment.photoUrl) ? (
                                            <Box
                                                component="img"
                                                src={comment.photoUrl}
                                                alt="Комментарий"
                                                onClick={() => setPreviewUrl(comment.photoUrl ?? null)}
                                                sx={(theme) => ({
                                                    mt: 1,
                                                    maxWidth: '100%',
                                                    borderRadius: 2,
                                                    border: isOwn
                                                        ? '1px solid #b9d6ff'
                                                        : '1px solid #e5e5ea',
                                                    boxShadow: isOwn
                                                        ? '0 12px 30px rgba(0,122,255,0.16)'
                                                        : '0 10px 30px rgba(0,0,0,0.08)',
                                                    cursor: 'pointer',
                                                    display: 'block',
                                                    ml: isOwn ? 'auto' : 0,
                                                    ...theme.applyStyles?.('dark', {
                                                        border: isOwn
                                                            ? '1px solid rgba(99,179,255,0.6)'
                                                            : '1px solid rgba(255,255,255,0.12)',
                                                        boxShadow: isOwn
                                                            ? '0 12px 30px rgba(0,122,255,0.28)'
                                                            : '0 10px 30px rgba(0,0,0,0.6)',
                                                    }),
                                                })}
                                            />
                                        ) : (
                                            <Button
                                                href={comment.photoUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                variant="outlined"
                                                size="small"
                                                sx={(theme) => ({
                                                    alignSelf: isOwn ? 'flex-end' : 'flex-start',
                                                    mt: 1,
                                                    borderRadius: 999,
                                                    textTransform: 'none',
                                                    borderColor: isOwn ? '#b9d6ff' : '#d1d1d6',
                                                    color: isOwn ? '#0a84ff' : 'text.primary',
                                                    bgcolor: isOwn ? '#f4f9ff' : undefined,
                                                    '&:hover': isOwn
                                                        ? {
                                                              bgcolor: '#e8f2ff',
                                                              borderColor: '#9fc7ff',
                                                          }
                                                        : undefined,
                                                    ...theme.applyStyles?.('dark', {
                                                        borderColor: isOwn
                                                            ? 'rgba(99,179,255,0.6)'
                                                            : 'rgba(255,255,255,0.2)',
                                                        color: isOwn ? theme.palette.primary.light : theme.palette.grey[100],
                                                        bgcolor: isOwn ? 'rgba(0,122,255,0.14)' : 'rgba(255,255,255,0.04)',
                                                        '&:hover': isOwn
                                                            ? {
                                                                  bgcolor: 'rgba(0,122,255,0.22)',
                                                                  borderColor: 'rgba(99,179,255,0.7)',
                                                              }
                                                            : {
                                                                  bgcolor: 'rgba(255,255,255,0.08)',
                                                              },
                                                    }),
                                                })}
                                            >
                                                Открыть вложение
                                            </Button>
                                        )
                                    )}
                                </Paper>
                            </Stack>
                        );
                    })}
                </Stack>
            )}

            <Stack gap={1}>
                <TextField
                    label="Новый комментарий"
                    multiline
                    minRows={3}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    fullWidth
                    placeholder="Напишите что-нибудь…"
                    InputProps={{
                        sx: (theme) => ({
                            borderRadius: 3,
                            bgcolor: '#f5f5f7',
                            '& fieldset': {
                                borderColor: '#e5e5ea',
                            },
                            '&:hover fieldset': {
                                borderColor: '#c7c7cc',
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: '#007aff',
                            },
                            ...theme.applyStyles?.('dark', {
                                bgcolor: 'rgba(255,255,255,0.06)',
                                '& fieldset': {
                                    borderColor: 'rgba(255,255,255,0.14)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(255,255,255,0.2)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: theme.palette.primary.light,
                                },
                            }),
                        }),
                    }}
                />
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Button
                        variant="text"
                        startIcon={<AttachFileOutlinedIcon />}
                        component="label"
                        sx={{
                            alignSelf: 'flex-start',
                            color: '#007aff',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': { bgcolor: 'rgba(0,122,255,0.08)' },
                        }}
                    >
                        Добавить файл
                        <input
                            type="file"
                            hidden
                            accept="image/*,application/pdf"
                            onChange={async (e) => {
                                const inputEl = e.target;
                                const selected = inputEl.files?.[0];
                                if (!selected) {
                                    inputEl.value = '';
                                    return;
                                }

                                setFile(selected);
                                if (!selected.type.startsWith('image/')) {
                                    inputEl.value = '';
                                    return;
                                }

                                setFileProcessing(true);
                                try {
                                    const optimized = await optimizeImageFile(selected);
                                    setFile(optimized);
                                } catch (optError) {
                                    console.error(optError);
                                } finally {
                                    setFileProcessing(false);
                                    inputEl.value = '';
                                }
                            }}
                        />
                    </Button>
                    {file && (
                        <Typography variant="body2" color="text.secondary">
                            {file.name}
                            {fileProcessing ? ' (оптимизация...)' : ''}
                        </Typography>
                    )}
                </Stack>
                {error && (
                    <Typography variant="body2" color="error">
                        {error}
                    </Typography>
                )}
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={submitting || !taskId || fileProcessing}
                    startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
                    sx={{
                        alignSelf: 'flex-start',
                        borderRadius: 999,
                        px: 2.5,
                        bgcolor: '#007aff',
                        boxShadow: '0 8px 24px rgba(0,122,255,0.25)',
                        '&:hover': {
                            bgcolor: '#0062d6',
                            boxShadow: '0 10px 28px rgba(0,122,255,0.35)',
                        },
                    }}
                >
                    Отправить
                </Button>
            </Stack>
            <Dialog
                fullScreen
                open={Boolean(previewUrl)}
                onClose={() => setPreviewUrl(null)}
                PaperProps={{
                    sx: {
                        backgroundColor: 'rgba(0,0,0,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                    },
                }}
            >
                <IconButton
                    aria-label="Закрыть"
                    onClick={() => setPreviewUrl(null)}
                    sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        color: '#fff',
                        bgcolor: 'rgba(0,0,0,0.35)',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
                    }}
                >
                    <CloseIcon />
                </IconButton>
                {previewUrl && (
                    <Box
                        component="img"
                        src={previewUrl}
                        alt="Просмотр изображения"
                        sx={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                        }}
                    />
                )}
            </Dialog>
        </Stack>
    );
}
