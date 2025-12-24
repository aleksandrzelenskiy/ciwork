import React from 'react';
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, Stack, Typography, Alert } from '@mui/material';
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
    const [uploading, setUploading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) {
            setFiles([]);
            setError(null);
            setUploading(false);
        }
    }, [open]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: { 'image/*': [] },
        multiple: true,
        onDrop: (acceptedFiles) => {
            setFiles((prev) => [...prev, ...acceptedFiles]);
        },
    });

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
                        sx={{
                            border: '1px dashed rgba(15,23,42,0.25)',
                            borderRadius: 3,
                            p: 3,
                            textAlign: 'center',
                            background: isDragActive ? 'rgba(59,130,246,0.06)' : 'transparent',
                            cursor: 'pointer',
                        }}
                    >
                        <input {...getInputProps()} />
                        <Typography variant="body1">
                            Перетащите фото сюда или нажмите для выбора
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Добавлено файлов: {files.length}
                        </Typography>
                    </Stack>
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
