'use client';

import React, { useCallback, useState } from 'react';
import {
    Box,
    Typography,
    Button,
    LinearProgress,
    Alert,
    Collapse,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useDropzone, FileRejection } from 'react-dropzone';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { UI_RADIUS } from '@/config/uiTokens';
import { withBasePath } from '@/utils/basePath';

interface ExcelData {
    [sheetName: string]: Array<Record<string, unknown>>;
}

type ExcelRow = Record<string, unknown>;

export type ParsedBeIdResult = {
    bsNumber?: string;
    bsAddress?: string;
    bsLatitude?: number;
    bsLongitude?: number;
    taskDescription?: string;
    sourceFile?: File;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onApply: (data: ParsedBeIdResult) => void;
    operatorLabel?: string;
};

const normalizeText = (value: unknown): string =>
    String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const normalized = value.replace(/\s+/g, '').replace(',', '.');
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

const findValueByLabelMatcherInRows = (
    rows: ExcelRow[],
    matcher: (text: string) => boolean,
    prefer: 'number' | 'string' | 'any' = 'any'
): string | number | null => {
    for (const row of rows) {
        for (const [key, value] of Object.entries(row)) {
            if (typeof value !== 'string') continue;
            if (!matcher(normalizeText(value))) continue;

            const entries = Object.entries(row);
            const labelIndex = entries.findIndex(([entryKey]) => entryKey === key);
            const candidates: Array<string | number> = [];
            if (labelIndex >= 0) {
                for (let i = labelIndex + 1; i < entries.length; i += 1) {
                    const entryValue = entries[i][1];
                    if (typeof entryValue === 'string' || typeof entryValue === 'number') {
                        candidates.push(entryValue);
                    }
                }
            } else {
                for (const [, entryValue] of entries) {
                    if (typeof entryValue === 'string' || typeof entryValue === 'number') {
                        candidates.push(entryValue);
                    }
                }
            }

            for (const candidate of candidates) {
                if (prefer === 'number') {
                    const num = toNumber(candidate);
                    if (num !== null) return num;
                } else if (prefer === 'string') {
                    if (typeof candidate === 'string' && candidate.trim()) return candidate;
                    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
                        return String(candidate);
                    }
                } else {
                    return candidate;
                }
            }
        }
    }
    return null;
};

const findValueByLabelMatcher = (
    data: ExcelData,
    matcher: (text: string) => boolean,
    prefer: 'number' | 'string' | 'any' = 'any'
): string | number | null => {
    for (const sheet of Object.values(data)) {
        const value = findValueByLabelMatcherInRows(sheet, matcher, prefer);
        if (value !== null) return value;
    }
    return null;
};

const findValueByLabelMatchers = (
    data: ExcelData,
    matchers: Array<(text: string) => boolean>,
    prefer: 'number' | 'string' | 'any' = 'any'
): string | number | null => {
    for (const matcher of matchers) {
        const value = findValueByLabelMatcher(data, matcher, prefer);
        if (value !== null) return value;
    }
    return null;
};

const BeIdParser: React.FC<Props> = ({ open, onClose, onApply, operatorLabel }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const dialogBg = isDark ? 'rgba(10,13,20,0.92)' : 'rgba(255,255,255,0.95)';
    const dialogBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const cardBg = isDark
        ? 'linear-gradient(145deg, rgba(14,18,28,0.9), rgba(16,24,38,0.92))'
        : 'linear-gradient(135deg, #f7f9fc, #f0f4fb)';
    const dropHoverBg = isDark
        ? 'linear-gradient(135deg, rgba(30,41,59,0.95), rgba(37,44,68,0.9))'
        : 'linear-gradient(135deg, #e9f3ff, #eef2ff)';
    const surfaceBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,0.35)';
    const previewBg = isDark
        ? 'linear-gradient(135deg, rgba(18,24,36,0.92), rgba(22,30,46,0.92))'
        : 'linear-gradient(135deg, #f8fafc, #eef2ff)';
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [excelData, setExcelData] = useState<ExcelData | null>(null);
    const [bsNumber, setBsNumber] = useState<string | null>(null);
    const [bsAddress, setBsAddress] = useState<string | null>(null);
    const [bsLatitude, setBsLatitude] = useState<number | null>(null);
    const [bsLongitude, setBsLongitude] = useState<number | null>(null);
    const [taskDescription, setTaskDescription] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const resetState = () => {
        setFile(null);
        setUploading(false);
        setUploadProgress(0);
        setExcelData(null);
        setBsNumber(null);
        setBsAddress(null);
        setBsLatitude(null);
        setBsLongitude(null);
        setTaskDescription(null);
        setError(null);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const parseMainValues = (data: ExcelData) => {
        const bsNum = findValueByLabelMatchers(
            data,
            [
                (text) => text === 'номер',
                (text) => text.startsWith('номер') && !text.includes('позици'),
            ],
            'string'
        ) as string | null;
        const bsAddr = findValueByLabelMatchers(
            data,
            [(text) => text.includes('адрес')],
            'string'
        ) as string | null;
        const lat = findValueByLabelMatchers(
            data,
            [(text) => text.includes('широта')],
            'number'
        ) as number | null;
        const lon = findValueByLabelMatchers(
            data,
            [(text) => text.includes('долгота')],
            'number'
        ) as number | null;
        const desc = findValueByLabelMatchers(
            data,
            [(text) => text.includes('доп. информация')],
            'string'
        ) as string | null;

        setBsNumber(bsNum ? String(bsNum).trim() : null);
        setBsAddress(bsAddr ? String(bsAddr).trim() : null);
        setBsLatitude(typeof lat === 'number' ? lat : null);
        setBsLongitude(typeof lon === 'number' ? lon : null);
        setTaskDescription(desc ? String(desc).trim() : null);
    };

    const onDrop = useCallback(
        (acceptedFiles: File[], fileRejections: FileRejection[]) => {
            setError(null);
            setExcelData(null);
            setBsNumber(null);
            setBsAddress(null);
            setBsLatitude(null);
            setBsLongitude(null);
            setTaskDescription(null);

            if (fileRejections.length > 0) {
                setError('Файл отклонён. Загрузите корректный Excel (.xlsx / .xls).');
            }

            if (acceptedFiles.length > 0) {
                setFile(acceptedFiles[0]);
            }
        },
        []
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
        },
        maxFiles: 1,
        multiple: false,
    });

    const handleUpload = async () => {
        if (!file) return;

        try {
            setUploading(true);
            setUploadProgress(10);
            setError(null);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(withBasePath('/api/estimates'), {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                setError((result as { error?: string }).error || 'Ошибка разбора файла');
                return;
            }

            setUploadProgress(70);
            const result = await response.json();
            const data = result.data as ExcelData;

            setExcelData(data);
            parseMainValues(data);
            setUploadProgress(100);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Ошибка при разборе файла');
        } finally {
            setUploading(false);
            setTimeout(() => setUploadProgress(0), 800);
        }
    };

    const handleApply = () => {
        onApply({
            bsNumber: bsNumber || undefined,
            bsAddress: bsAddress || undefined,
            bsLatitude: typeof bsLatitude === 'number' ? bsLatitude : undefined,
            bsLongitude: typeof bsLongitude === 'number' ? bsLongitude : undefined,
            taskDescription: taskDescription || undefined,
            sourceFile: file || undefined,
        });

        resetState();
        onClose();
    };

    const canApply = !!excelData;
    const hasParsedPreview =
        !!excelData ||
        !!bsNumber ||
        !!bsAddress ||
        typeof bsLatitude === 'number' ||
        typeof bsLongitude === 'number' ||
        !!taskDescription;

    const title = operatorLabel ? `Заполнить по ID (${operatorLabel})` : 'Заполнить по ID';

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: dialogBg,
                    border: `1px solid ${dialogBorder}`,
                    borderRadius: UI_RADIUS.tooltip,
                    boxShadow: isDark
                        ? '0 35px 80px rgba(0,0,0,0.65)'
                        : '0 25px 60px rgba(15,23,42,0.15)',
                    backdropFilter: 'blur(12px)',
                },
            }}
        >
            <DialogTitle>{title}</DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <Box
                        {...getRootProps()}
                        sx={{
                            borderRadius: UI_RADIUS.tooltip,
                            p: 2,
                            cursor: 'pointer',
                            background: isDragActive ? dropHoverBg : cardBg,
                            transition: 'all 200ms ease',
                            textAlign: 'center',
                            boxShadow: `inset 0 0 0 1px ${surfaceBorder}`,
                            minHeight: 120,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1,
                        }}
                    >
                        <input {...getInputProps()} />
                        <CloudUploadIcon sx={{ color: '#2563eb' }} />
                        <Box>
                            <Typography variant="body2" fontWeight={600}>
                                {file ? file.name : 'Перетащите Excel сюда или нажмите'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Поддерживаются .xlsx / .xls
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={handleUpload}
                            disabled={uploading || !file}
                        >
                            {uploading ? 'Обработка...' : 'Распарсить файл'}
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            onClick={resetState}
                            disabled={uploading || (!file && !hasParsedPreview)}
                        >
                            Сбросить
                        </Button>
                        {uploading && (
                            <Box sx={{ flex: 1 }}>
                                <LinearProgress variant="determinate" value={uploadProgress} />
                            </Box>
                        )}
                    </Box>

                    <Collapse in={!!error}>
                        {error && (
                            <Alert
                                severity="error"
                                sx={{ mt: 1 }}
                                action={
                                    <IconButton
                                        size="small"
                                        color="inherit"
                                        onClick={() => setError(null)}
                                    >
                                        <CloseIcon fontSize="inherit" />
                                    </IconButton>
                                }
                            >
                                {error}
                            </Alert>
                        )}
                    </Collapse>

                    <Collapse in={hasParsedPreview} timeout={250} unmountOnExit>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderRadius: UI_RADIUS.tooltip,
                                background: previewBg,
                                boxShadow: isDark
                                    ? '0 20px 50px rgba(0,0,0,0.45)'
                                    : '0 12px 30px rgba(15,23,42,0.12)',
                                borderColor: surfaceBorder,
                            }}
                        >
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                {bsNumber && (
                                    <Typography variant="body2">
                                        <b>БС:</b> {bsNumber}
                                    </Typography>
                                )}
                                {bsAddress && (
                                    <Typography variant="body2">
                                        <b>Адрес:</b> {bsAddress}
                                    </Typography>
                                )}
                                {typeof bsLatitude === 'number' && (
                                    <Typography variant="body2">
                                        <b>Широта:</b> {bsLatitude}
                                    </Typography>
                                )}
                                {typeof bsLongitude === 'number' && (
                                    <Typography variant="body2">
                                        <b>Долгота:</b> {bsLongitude}
                                    </Typography>
                                )}
                                {taskDescription && (
                                    <Typography variant="body2">
                                        <b>Описание:</b> {taskDescription}
                                    </Typography>
                                )}
                            </Box>
                        </Paper>
                    </Collapse>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Отмена</Button>
                <Button
                    onClick={handleApply}
                    variant="contained"
                    disabled={!canApply}
                >
                    Применить к задаче
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default BeIdParser;
