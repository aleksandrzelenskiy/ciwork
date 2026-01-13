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
    Stack,
    Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useDropzone } from 'react-dropzone';

type ReportFixUploaderProps = {
    open: boolean;
    onClose: () => void;
    taskId: string;
    baseId: string;
    onUploaded: () => void;
};

export default function ReportFixUploader({
    open,
    onClose,
    taskId,
    baseId,
    onUploaded,
}: ReportFixUploaderProps) {
    const [files, setFiles] = React.useState<File[]>([]);
    const [previews, setPreviews] = React.useState<{ name: string; url: string }[]>([]);
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) {
            setFiles([]);
            setError(null);
            setUploading(false);
        }
    }, [open]);

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
        onDrop: (acceptedFiles) => {
            setFiles((prev) => [...prev, ...acceptedFiles]);
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
        onClose();
    };

    const handleUpload = async () => {
        if (!files.length) {
            setError('Добавьте фотографии исправлений');
            return;
        }
        setUploading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('taskId', taskId);
            formData.append('baseId', baseId);
            files.forEach((file) => formData.append('files', file));

            const res = await fetch('/api/reports/upload-fix', {
                method: 'POST',
                body: formData,
            });
            const payload = (await res.json().catch(() => ({}))) as { error?: string; readOnly?: boolean };
            if (!res.ok) {
                setError(
                    payload.readOnly
                        ? payload.error || 'Хранилище доступно только для чтения'
                        : payload.error || 'Не удалось загрузить исправления'
                );
                return;
            }
            onUploaded();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <DialogTitle>Исправления</DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                        Добавьте фото, подтверждающие устранение замечаний.
                    </Typography>
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
                            Перетащите фото сюда или нажмите для выбора
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Добавлено файлов: {files.length}
                        </Typography>
                    </Stack>
                    {previews.length > 0 && (
                        <Stack spacing={1}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                Добавленные фото
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
                                            aria-label={`Удалить ${preview.name}`}
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
                    Отмена
                </Button>
                <Button variant="contained" onClick={handleUpload} disabled={uploading}>
                    {uploading ? 'Загрузка...' : 'Загрузить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
