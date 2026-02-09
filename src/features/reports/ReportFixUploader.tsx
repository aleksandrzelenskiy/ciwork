import React from 'react';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    Stack,
    Typography,
    TextField,
    MenuItem,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useDropzone } from 'react-dropzone';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

type ReportFixUploaderProps = {
    open: boolean;
    onClose: () => void;
    taskId: string;
    baseId: string;
    onUploaded: () => void;
};

const MAX_FILE_SIZE_MB = 15;
const MAX_BATCH_FILES = 5;
const MAX_BATCH_MB = 20;

export default function ReportFixUploader({
    open,
    onClose,
    taskId,
    baseId,
    onUploaded,
}: ReportFixUploaderProps) {
    const { t } = useI18n();
    const [files, setFiles] = React.useState<File[]>([]);
    const [previews, setPreviews] = React.useState<{ name: string; url: string }[]>([]);
    const [uploading, setUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState<{ done: number; total: number } | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [folderConfigLoading, setFolderConfigLoading] = React.useState(false);
    const [folderConfigError, setFolderConfigError] = React.useState<string | null>(null);
    const [folderPaths, setFolderPaths] = React.useState<Array<{ id: string; path: string }>>([]);
    const [selectedFolderId, setSelectedFolderId] = React.useState('');

    React.useEffect(() => {
        if (!open) {
            setFiles([]);
            setError(null);
            setUploading(false);
            setUploadProgress(null);
            setFolderConfigLoading(false);
            setFolderConfigError(null);
            setFolderPaths([]);
            setSelectedFolderId('');
        }
    }, [open]);

    React.useEffect(() => {
        if (!open || !taskId) return;
        let cancelled = false;
        const loadConfig = async () => {
            setFolderConfigLoading(true);
            setFolderConfigError(null);
            try {
                const res = await fetch(
                    withBasePath(`/api/reports/config?taskId=${encodeURIComponent(taskId)}`),
                    { cache: 'no-store' }
                );
                const data = (await res.json().catch(() => ({}))) as {
                    folderPaths?: Array<{ id: string; path: string }>;
                    error?: string;
                };
                if (cancelled) return;
                if (!res.ok) {
                    setFolderConfigError(
                        data.error ||
                            t(
                                'reports.upload.folders.error.load',
                                'Не удалось загрузить структуру папок'
                            )
                    );
                    setFolderPaths([]);
                    return;
                }
                setFolderPaths(Array.isArray(data.folderPaths) ? data.folderPaths : []);
            } catch (loadError) {
                if (cancelled) return;
                setFolderConfigError(
                    loadError instanceof Error
                        ? loadError.message
                        : t(
                              'reports.upload.folders.error.load',
                              'Не удалось загрузить структуру папок'
                          )
                );
                setFolderPaths([]);
            } finally {
                if (!cancelled) {
                    setFolderConfigLoading(false);
                }
            }
        };
        void loadConfig();
        return () => {
            cancelled = true;
        };
    }, [open, taskId, t]);

    React.useEffect(() => {
        if (!files.length) {
            setPreviews([]);
            return;
        }
        const next = files.map((file) => ({
            name: file.name,
            url: URL.createObjectURL(file),
        }));
        setPreviews(next);
        return () => {
            next.forEach((preview) => URL.revokeObjectURL(preview.url));
        };
    }, [files]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': [] },
        multiple: true,
        maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
        onDrop: (acceptedFiles) => {
            setFiles((prev) => [...prev, ...acceptedFiles]);
            if (acceptedFiles.length > 0) {
                setError(null);
            }
        },
        onDropRejected: (rejections) => {
            const firstError = rejections[0]?.errors?.[0]?.message;
            setError(firstError || t('reports.fixUploader.error.rejected', 'Файлы не приняты'));
        },
    });

    const handleRemoveFile = (index: number) => {
        if (uploading) return;
        setFiles((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleClose = () => {
        if (uploading) return;
        setFiles([]);
        setError(null);
        setUploadProgress(null);
        onClose();
    };

    const handleUpload = async () => {
        if (!files.length) {
            setError(t('reports.fixUploader.error.noFiles', 'Добавьте фотографии исправлений'));
            return;
        }
        setUploading(true);
        setError(null);
        setUploadProgress({ done: 0, total: files.length });

        try {
            const maxBatchBytes = MAX_BATCH_MB * 1024 * 1024;
            const maxBatchFiles = MAX_BATCH_FILES;
            const batches: File[][] = [];
            let currentBatch: File[] = [];
            let currentBytes = 0;

            files.forEach((file) => {
                const size = Math.max(1, file.size);
                const wouldExceed =
                    currentBatch.length > 0 &&
                    (currentBatch.length >= maxBatchFiles || currentBytes + size > maxBatchBytes);
                if (wouldExceed) {
                    batches.push(currentBatch);
                    currentBatch = [];
                    currentBytes = 0;
                }
                currentBatch.push(file);
                currentBytes += size;
                if (currentBatch.length >= maxBatchFiles) {
                    batches.push(currentBatch);
                    currentBatch = [];
                    currentBytes = 0;
                }
            });
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
            }

            let uploadedCount = 0;
            for (const batch of batches) {
                const formData = new FormData();
                formData.append('taskId', taskId);
                formData.append('baseId', baseId);
                if (selectedFolderId.trim()) {
                    formData.append('folderId', selectedFolderId.trim());
                }
                batch.forEach((file) => formData.append('files', file));

                const res = await fetch(withBasePath('/api/reports/upload-fix'), {
                    method: 'POST',
                    body: formData,
                });
                const payload = (await res.json().catch(() => ({}))) as { error?: string; readOnly?: boolean };
                if (!res.ok) {
                    setError(
                        payload.readOnly
                            ? payload.error || t('reports.fixUploader.error.readOnly', 'Хранилище доступно только для чтения')
                            : payload.error || t('reports.fixUploader.error.uploadFailed', 'Не удалось загрузить исправления')
                    );
                    return;
                }
                uploadedCount += batch.length;
                setUploadProgress({ done: uploadedCount, total: files.length });
                setFiles((prev) => prev.filter((file) => !batch.includes(file)));
            }
            onUploaded();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('reports.fixUploader.error.uploadError', 'Ошибка загрузки'));
        } finally {
            setUploading(false);
            setUploadProgress(null);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitle>{t('reports.fixUploader.title', 'Исправления')}</DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        {t('reports.fixUploader.subtitle', 'Добавьте фото, подтверждающие устранение замечаний.')}
                    </Typography>
                    {folderConfigError && <Alert severity="warning">{folderConfigError}</Alert>}
                    {folderConfigLoading && <LinearProgress />}
                    {folderPaths.length > 0 && (
                        <Stack spacing={0.5}>
                            <TextField
                                select
                                label={t('reports.upload.folders.field.label', 'Папка внутри БС')}
                                value={selectedFolderId}
                                onChange={(event) => setSelectedFolderId(event.target.value)}
                                size="small"
                            >
                                <MenuItem value="">
                                    {t('reports.upload.folders.root', 'Корень БС')}
                                </MenuItem>
                                {folderPaths.map((folder) => (
                                    <MenuItem key={folder.id} value={folder.id}>
                                        {folder.path}
                                    </MenuItem>
                                ))}
                            </TextField>
                            <Typography variant="caption" color="text.secondary">
                                {t('reports.upload.folders.path', 'Путь загрузки: {path}', {
                                    path:
                                        baseId +
                                        (selectedFolderId
                                            ? ` / ${folderPaths.find((item) => item.id === selectedFolderId)?.path ?? ''}`
                                            : ''),
                                })}
                            </Typography>
                        </Stack>
                    )}
                    <Stack
                        {...getRootProps()}
                        sx={(theme) => ({
                            border:
                                theme.palette.mode === 'dark'
                                    ? '1px dashed rgba(148,163,184,0.35)'
                                    : '1px dashed rgba(15,23,42,0.25)',
                            borderRadius: 3,
                            p: 3,
                            textAlign: 'center',
                            background: isDragActive
                                ? theme.palette.mode === 'dark'
                                    ? 'rgba(59,130,246,0.14)'
                                    : 'rgba(59,130,246,0.06)'
                                : 'transparent',
                            cursor: 'pointer',
                        })}
                    >
                        <input {...getInputProps()} />
                        <Typography variant="body1">
                            {t('reports.fixUploader.dropzone', 'Перетащите фото сюда или нажмите для выбора')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {t('reports.fixUploader.filesCount', 'Добавлено файлов: {count}', { count: files.length })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {t('reports.fixUploader.limits', 'До {fileSize} МБ каждое. Партия до {files} файлов или {batchSize} МБ.', {
                                fileSize: MAX_FILE_SIZE_MB,
                                files: MAX_BATCH_FILES,
                                batchSize: MAX_BATCH_MB,
                            })}
                        </Typography>
                    </Stack>
                    {uploadProgress && (
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                {t('reports.fixUploader.progress', 'Загружено: {done}/{total}', {
                                    done: uploadProgress.done,
                                    total: uploadProgress.total,
                                })}
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                value={Math.round((uploadProgress.done / uploadProgress.total) * 100)}
                                sx={{ mt: 1, borderRadius: 999 }}
                            />
                        </Box>
                    )}
                    {previews.length > 0 && (
                        <Stack spacing={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {t('reports.fixUploader.previewTitle', 'Добавленные фото')}
                            </Typography>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                                    gap: 1,
                                }}
                            >
                                {previews.map((preview, index) => (
                                    <Box
                                        key={`${preview.name}-${index}`}
                                        sx={(theme) => ({
                                            position: 'relative',
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                            border:
                                                theme.palette.mode === 'dark'
                                                    ? '1px solid rgba(148,163,184,0.18)'
                                                    : '1px solid rgba(15,23,42,0.08)',
                                            height: 96,
                                        })}
                                    >
                                        <Box
                                            component="img"
                                            src={preview.url}
                                            alt={preview.name}
                                            sx={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                display: 'block',
                                            }}
                                        />
                                        <IconButton
                                            size="small"
                                            aria-label={t('reports.fixUploader.remove', 'Удалить {name}', { name: preview.name })}
                                            onClick={() => handleRemoveFile(index)}
                                            disabled={uploading}
                                            sx={(theme) => ({
                                                position: 'absolute',
                                                top: 4,
                                                right: 4,
                                                backgroundColor:
                                                    theme.palette.mode === 'dark'
                                                        ? 'rgba(2,6,14,0.75)'
                                                        : 'rgba(15,23,42,0.7)',
                                                color: '#fff',
                                                '&:hover': {
                                                    backgroundColor:
                                                        theme.palette.mode === 'dark'
                                                            ? 'rgba(2,6,14,0.85)'
                                                            : 'rgba(15,23,42,0.85)',
                                                },
                                            })}
                                        >
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                ))}
                            </Box>
                        </Stack>
                    )}
                    {error && <Alert severity="error">{error}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={uploading}>
                    {t('common.cancel', 'Отмена')}
                </Button>
                <Button variant="contained" onClick={handleUpload} disabled={uploading}>
                    {uploading ? t('reports.fixUploader.uploading', 'Загрузка...') : t('reports.fixUploader.upload', 'Загрузить')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
