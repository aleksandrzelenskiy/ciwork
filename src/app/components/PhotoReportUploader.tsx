'use client';

import React from 'react';
import Image from 'next/image';
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    Paper,
    Stack,
    Typography,
    useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SendIcon from '@mui/icons-material/Send';
import { useDropzone } from 'react-dropzone';

type BaseLocation = {
    name?: string | null;
};

type UploadStatus = 'ready' | 'uploading' | 'done' | 'error' | 'canceled';

type UploadItem = {
    id: string;
    file: File;
    preview: string;
    progress: number;
    status: UploadStatus;
    error?: string;
};

type FolderState = {
    uploaded: boolean;
    fileCount: number;
};

type PhotoReportUploaderProps = {
    open: boolean;
    onClose: () => void;
    taskId: string;
    taskName?: string | null;
    initiatorId?: string | null;
    initiatorName?: string | null;
    bsLocations?: BaseLocation[];
    onSubmitted?: () => void;
};

const getReadableSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;

const getStatusLabel = (status: UploadStatus) => {
    if (status === 'uploading') return 'Загрузка';
    if (status === 'done') return 'Готово';
    if (status === 'error') return 'Ошибка';
    if (status === 'canceled') return 'Отменено';
    return 'Готово к отправке';
};

export default function PhotoReportUploader(props: PhotoReportUploaderProps) {
    const {
        open,
        onClose,
        taskId,
        taskName,
        initiatorId,
        initiatorName,
        bsLocations = [],
        onSubmitted,
    } = props;

    const [view, setView] = React.useState<'folders' | 'upload'>('folders');
    const [activeBase, setActiveBase] = React.useState('');
    const [items, setItems] = React.useState<UploadItem[]>([]);
    const [folderState, setFolderState] = React.useState<Record<string, FolderState>>({});
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [uploading, setUploading] = React.useState(false);
    const [folderAlert, setFolderAlert] = React.useState<string | null>(null);
    const [submitError, setSubmitError] = React.useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = React.useState<string | null>(null);
    const [submitLoading, setSubmitLoading] = React.useState(false);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const cancelRef = React.useRef(false);
    const xhrRef = React.useRef<XMLHttpRequest | null>(null);

    const baseOptions = React.useMemo(() => {
        const names = bsLocations
            .map((loc) => (loc?.name || '').trim())
            .filter(Boolean) as string[];
        return Array.from(new Set(names));
    }, [bsLocations]);

    const resetState = React.useCallback(() => {
        setView('folders');
        setActiveBase('');
        setUploadError(null);
        setFolderAlert(null);
        setSubmitError(null);
        setSubmitSuccess(null);
        setItems((prev) => {
            prev.forEach((item) => URL.revokeObjectURL(item.preview));
            return [];
        });
        setFolderState({});
    }, []);

    React.useEffect(() => {
        if (open) {
            resetState();
        }
    }, [open, resetState]);

    React.useEffect(() => {
        if (!open && !uploading && !submitLoading) {
            resetState();
        }
    }, [open, uploading, submitLoading, resetState]);

    React.useEffect(() => {
        return () => {
            items.forEach((item) => URL.revokeObjectURL(item.preview));
        };
    }, [items]);

    const updateItem = React.useCallback((id: string, patch: Partial<UploadItem>) => {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': [] },
        multiple: true,
        maxSize: 15 * 1024 * 1024,
        onDrop: (acceptedFiles, fileRejections) => {
            const mapped = acceptedFiles.map((file) => ({
                id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
                file,
                preview: URL.createObjectURL(file),
                progress: 0,
                status: 'ready' as const,
            }));
            setItems((prev) => [...prev, ...mapped]);
            if (fileRejections.length > 0) {
                const firstError = fileRejections[0]?.errors?.[0]?.message;
                setUploadError(firstError || 'Некоторые файлы отклонены');
            } else {
                setUploadError(null);
            }
        },
        onDropRejected: (rejections) => {
            const firstError = rejections[0]?.errors?.[0]?.message;
            setUploadError(firstError || 'Файлы не приняты');
        },
    });

    const handleRemoveItem = (id: string) => {
        setItems((prev) => {
            const target = prev.find((item) => item.id === id);
            if (target) URL.revokeObjectURL(target.preview);
            return prev.filter((item) => item.id !== id);
        });
    };

    const handleDialogClose = () => {
        if (uploading || submitLoading) return;
        onClose();
    };

    const handleBackToFolders = () => {
        if (uploading) return;
        setItems((prev) => {
            prev.forEach((item) => URL.revokeObjectURL(item.preview));
            return [];
        });
        setUploadError(null);
        setView('folders');
    };

    const handleCancelUpload = () => {
        cancelRef.current = true;
        if (xhrRef.current) {
            xhrRef.current.abort();
        }
        setUploading(false);
        setItems((prev) =>
            prev.map((item) =>
                item.status === 'uploading' || item.status === 'ready'
                    ? { ...item, status: 'canceled' as const }
                    : item
            )
        );
        setUploadError('Загрузка отменена');
    };

    const handleUpload = async () => {
        if (!activeBase) {
            setUploadError('Выберите папку БС для загрузки фотоотчета');
            return;
        }
        if (items.length === 0) {
            setUploadError('Добавьте хотя бы одно фото');
            return;
        }
        setUploading(true);
        cancelRef.current = false;
        setUploadError(null);

        const targets = items.filter((item) => item.status !== 'done');
        targets.forEach((item) => {
            updateItem(item.id, { status: 'uploading', progress: 0, error: undefined });
        });

        const ranges = targets.reduce<{ id: string; start: number; end: number; size: number }[]>(
            (acc, item) => {
                const start = acc.length === 0 ? 0 : acc[acc.length - 1].end;
                const safeSize = Math.max(1, item.file.size);
                const end = start + safeSize;
                acc.push({ id: item.id, start, end, size: safeSize });
                return acc;
            },
            []
        );
        const totalSize = ranges.length > 0 ? ranges[ranges.length - 1].end : 0;

        const formData = new FormData();
        formData.append('baseId', activeBase);
        formData.append('task', taskId);
        formData.append('taskId', taskId);
        if (initiatorId) formData.append('initiatorId', initiatorId);
        if (initiatorName) formData.append('initiatorName', initiatorName);
        targets.forEach((item) => {
            formData.append('image[]', item.file);
        });

        let uploadOk = false;
        await new Promise<void>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhrRef.current = xhr;

            xhr.upload.onprogress = (event) => {
                if (!event.lengthComputable || totalSize === 0) return;
                const loaded = event.loaded;
                setItems((prev) =>
                    prev.map((item) => {
                        const range = ranges.find((r) => r.id === item.id);
                        if (!range) return item;
                        const progressRaw = (loaded - range.start) / range.size;
                        const progress = Math.max(0, Math.min(1, progressRaw));
                        return {
                            ...item,
                            status: item.status === 'canceled' ? item.status : 'uploading',
                            progress: Math.round(progress * 100),
                        };
                    })
                );
            };

            xhr.onload = () => {
                const success = xhr.status >= 200 && xhr.status < 300;
                uploadOk = success;
                setItems((prev) =>
                    prev.map((item) => {
                        const isTarget = targets.some((target) => target.id === item.id);
                        if (!isTarget) return item;
                        return {
                            ...item,
                            status: success ? 'done' : 'error',
                            progress: success ? 100 : item.progress,
                            error: success ? undefined : 'Ошибка загрузки',
                        };
                    })
                );
                if (!success) {
                    const responseError = (() => {
                        try {
                            const payload = JSON.parse(xhr.responseText || '{}') as { error?: string };
                            return payload.error;
                        } catch {
                            return undefined;
                        }
                    })();
                    setUploadError(responseError || 'Ошибка загрузки');
                }
                xhrRef.current = null;
                resolve();
            };

            xhr.onerror = () => {
                setItems((prev) =>
                    prev.map((item) =>
                        targets.some((target) => target.id === item.id)
                            ? { ...item, status: 'error', error: 'Сбой сети' }
                            : item
                    )
                );
                setUploadError('Сбой сети');
                xhrRef.current = null;
                resolve();
            };

            xhr.onabort = () => {
                setItems((prev) =>
                    prev.map((item) =>
                        targets.some((target) => target.id === item.id)
                            ? { ...item, status: 'canceled', error: 'Отменено' }
                            : item
                    )
                );
                xhrRef.current = null;
                resolve();
            };

            xhr.open('POST', '/api/upload', true);
            xhr.send(formData);
        });

        if (cancelRef.current) {
            setUploading(false);
            return;
        }

        setUploading(false);
        if (uploadOk) {
            setFolderState((prev) => ({
                ...prev,
                [activeBase]: {
                    uploaded: true,
                    fileCount: targets.length,
                },
            }));
            setFolderAlert(`Фото в папке ${activeBase} успешно загружены`);
            setItems((prev) => {
                prev.forEach((item) => URL.revokeObjectURL(item.preview));
                return [];
            });
            setView('folders');
        }
    };

    const allUploaded =
        baseOptions.length > 0 &&
        baseOptions.every((base) => folderState[base]?.uploaded);

    const handleOpenFolder = (baseId: string) => {
        if (uploading || submitLoading) return;
        setActiveBase(baseId);
        setUploadError(null);
        setFolderAlert(null);
        setView('upload');
    };

    const handleSubmit = async () => {
        if (!allUploaded) {
            setSubmitError('Сначала загрузите фото по всем папкам БС');
            return;
        }
        setSubmitLoading(true);
        setSubmitError(null);
        setSubmitSuccess(null);
        try {
            const res = await fetch('/api/reports/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId,
                    baseIds: baseOptions,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
            if (!res.ok) {
                setSubmitError(data.error || 'Не удалось отправить фотоотчет');
                return;
            }
            setSubmitSuccess(data.message || 'Фотоотчет отправлен менеджеру');
            onSubmitted?.();
            setTimeout(() => {
                onClose();
            }, 800);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Ошибка отправки');
        } finally {
            setSubmitLoading(false);
        }
    };

    const reportFolder = activeBase
        ? `${taskId}-report/${activeBase}`
        : `${taskId}-report`;

    return (
        <Dialog
            open={open}
            onClose={handleDialogClose}
            fullWidth
            maxWidth="md"
            fullScreen={isMobile}
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: isMobile ? 0 : 4,
                        p: 1,
                        background:
                            'linear-gradient(160deg, rgba(255,255,255,0.95), rgba(235,240,248,0.95))',
                        border: '1px solid rgba(255,255,255,0.65)',
                        boxShadow: '0 36px 90px rgba(15, 23, 42, 0.25)',
                        backdropFilter: 'blur(18px)',
                    },
                },
            }}
        >
            <DialogTitle
                sx={{
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pr: 1,
                    gap: 1,
                }}
            >
                <Stack direction="row" alignItems="center" gap={1}>
                    {view === 'upload' && (
                        <IconButton onClick={handleBackToFolders} disabled={uploading}>
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                    <Typography variant="inherit">
                        {view === 'upload' ? `Папка ${activeBase}` : 'Загрузка фотоотчета'}
                    </Typography>
                </Stack>
                <IconButton onClick={handleDialogClose} disabled={uploading || submitLoading}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {view === 'folders' ? (
                    <>
                        <Typography variant="body2" color="text.secondary">
                            Загрузите фото по каждой БС, затем отправьте отчет менеджеру. Папки сохраняются по пути{' '}
                            {reportFolder}.
                        </Typography>
                        {folderAlert && <Alert severity="success">{folderAlert}</Alert>}
                        {submitError && <Alert severity="error">{submitError}</Alert>}
                        {submitSuccess && <Alert severity="success">{submitSuccess}</Alert>}

                        {baseOptions.length === 0 ? (
                            <Alert severity="warning">Нет папок БС для загрузки.</Alert>
                        ) : (
                            <Stack spacing={1.5}>
                                {baseOptions.map((baseId) => {
                                    const state = folderState[baseId];
                                    return (
                                        <Paper
                                            key={baseId}
                                            onClick={() => handleOpenFolder(baseId)}
                                            role="button"
                                            sx={{
                                                p: 2,
                                                borderRadius: 3,
                                                cursor: 'pointer',
                                                border: '1px solid rgba(15,23,42,0.08)',
                                                background:
                                                    'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(239,244,250,0.96))',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 2,
                                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                                '&:hover': {
                                                    transform: 'translateY(-2px)',
                                                    boxShadow: '0 14px 30px rgba(15,23,42,0.12)',
                                                },
                                            }}
                                        >
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <FolderOutlinedIcon />
                                                <Box>
                                                    <Typography fontWeight={600}>{baseId}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Папка фотоотчета
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                {state?.uploaded && (
                                                    <Chip
                                                        size="small"
                                                        icon={<CheckCircleIcon />}
                                                        label={`Загружено (${state.fileCount})`}
                                                        sx={{
                                                            borderRadius: 999,
                                                            bgcolor: 'rgba(34,197,94,0.16)',
                                                            color: '#0f3d1d',
                                                            fontWeight: 600,
                                                        }}
                                                    />
                                                )}
                                                <Typography variant="body2" color="text.secondary">
                                                    Открыть
                                                </Typography>
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        )}
                    </>
                ) : (
                    <>
                        <Typography variant="body2" color="text.secondary">
                            Загружайте фото для папки {activeBase}. Путь: {reportFolder}.
                        </Typography>
                        {uploadError && <Alert severity="error">{uploadError}</Alert>}
                        <Box
                            {...getRootProps()}
                            sx={{
                                border: '1.5px dashed',
                                borderColor: isDragActive ? 'primary.main' : 'rgba(15, 23, 42, 0.2)',
                                borderRadius: 4,
                                p: 3,
                                textAlign: 'center',
                                background:
                                    'linear-gradient(140deg, rgba(255,255,255,0.8), rgba(236,242,249,0.92))',
                                transition: 'all 0.2s ease',
                                cursor: uploading ? 'not-allowed' : 'pointer',
                                opacity: uploading ? 0.6 : 1,
                            }}
                        >
                            <input {...getInputProps()} disabled={uploading} />
                            <CloudUploadIcon fontSize="large" color="action" />
                            <Typography variant="h6" sx={{ mt: 1, mb: 0.5, fontWeight: 600 }}>
                                Перетащите фото или нажмите, чтобы выбрать
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                До 15 МБ каждое. Загрузка выполняется после нажатия «Загрузить».
                            </Typography>
                        </Box>

                        {items.length > 0 && (
                            <Stack spacing={1.25}>
                                {items.map((item) => (
                                    <Paper
                                        key={item.id}
                                        variant="outlined"
                                        sx={{
                                            p: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 1.5,
                                            borderRadius: 3,
                                            background:
                                                'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(241,245,251,0.92))',
                                            borderColor: 'rgba(15,23,42,0.08)',
                                        }}
                                    >
                                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                                            <Image
                                                src={item.preview}
                                                alt={item.file.name}
                                                width={64}
                                                height={64}
                                                style={{ objectFit: 'cover', borderRadius: 14 }}
                                                unoptimized
                                            />
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={{ wordBreak: 'break-word', fontWeight: 600 }}>
                                                    {item.file.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {getReadableSize(item.file.size)}
                                                </Typography>
                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                                    <Chip
                                                        size="small"
                                                        label={getStatusLabel(item.status)}
                                                        sx={{
                                                            borderRadius: 999,
                                                            fontWeight: 600,
                                                            bgcolor:
                                                                item.status === 'done'
                                                                    ? 'rgba(34,197,94,0.16)'
                                                                    : item.status === 'error'
                                                                      ? 'rgba(239,68,68,0.12)'
                                                                      : item.status === 'canceled'
                                                                        ? 'rgba(15,23,42,0.12)'
                                                                        : 'rgba(59,130,246,0.1)',
                                                        }}
                                                    />
                                                    {item.status === 'uploading' && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            {item.progress}%
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </Box>
                                        </Stack>
                                        <Stack spacing={1} alignItems="flex-end">
                                            {item.status === 'uploading' ? (
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={item.progress}
                                                    sx={{
                                                        width: 160,
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
                                            ) : (
                                                <Button
                                                    size="small"
                                                    color="inherit"
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    disabled={uploading}
                                                    startIcon={<CloseIcon />}
                                                    sx={{ textTransform: 'none', borderRadius: 999 }}
                                                >
                                                    Удалить
                                                </Button>
                                            )}
                                        </Stack>
                                    </Paper>
                                ))}
                            </Stack>
                        )}

                        {taskName && (
                            <Typography variant="caption" color="text.secondary">
                                Задача: {taskName}
                            </Typography>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, display: 'flex', justifyContent: 'space-between' }}>
                {view === 'folders' ? (
                    <>
                        <Button onClick={handleDialogClose} sx={{ textTransform: 'none', borderRadius: 999 }}>
                            Отмена
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => void handleSubmit()}
                            disabled={!allUploaded || submitLoading}
                            startIcon={<SendIcon />}
                            sx={{
                                textTransform: 'none',
                                borderRadius: 999,
                                fontWeight: 700,
                                px: 3,
                                background: allUploaded
                                    ? 'linear-gradient(135deg, rgba(0,122,255,0.95), rgba(88,86,214,0.95))'
                                    : 'rgba(148,163,184,0.6)',
                                boxShadow: allUploaded ? '0 12px 28px rgba(0, 122, 255, 0.35)' : 'none',
                                '&:hover': {
                                    background: allUploaded
                                        ? 'linear-gradient(135deg, rgba(0,113,240,0.98), rgba(72,69,212,0.98))'
                                        : 'rgba(148,163,184,0.6)',
                                },
                            }}
                        >
                            {submitLoading ? 'Отправка...' : 'Отправить'}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            onClick={uploading ? handleCancelUpload : handleBackToFolders}
                            sx={{ textTransform: 'none', borderRadius: 999 }}
                        >
                            {uploading ? 'Отменить загрузку' : 'Отмена'}
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => void handleUpload()}
                            disabled={uploading || items.length === 0}
                            startIcon={<CloudUploadIcon />}
                            sx={{
                                textTransform: 'none',
                                borderRadius: 999,
                                fontWeight: 700,
                                px: 3,
                                background: 'linear-gradient(135deg, rgba(0,122,255,0.95), rgba(88,86,214,0.95))',
                                boxShadow: '0 12px 28px rgba(0, 122, 255, 0.35)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, rgba(0,113,240,0.98), rgba(72,69,212,0.98))',
                                },
                            }}
                        >
                            {uploading ? 'Загрузка...' : 'Загрузить'}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
