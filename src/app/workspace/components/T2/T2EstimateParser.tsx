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
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useDropzone, FileRejection } from 'react-dropzone';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { UI_RADIUS } from '@/config/uiTokens';

interface ExcelData {
    [sheetName: string]: Array<Record<string, unknown>>;
}

export type ParsedWorkItem = {
    workType: string;
    quantity: number;
    unit: string;
    note?: string;
};

export type ParsedEstimateResult = {
    bsNumber?: string;
    bsAddress?: string;
    totalCost?: number;
    workItems: ParsedWorkItem[];
    sourceFile?: File;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onApply: (data: ParsedEstimateResult) => void;
    operatorLabel?: string;
};

const T2EstimateParser: React.FC<Props> = ({ open, onClose, onApply, operatorLabel }) => {
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
    const tableHeadBg = isDark ? 'rgba(255,255,255,0.05)' : undefined;
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [excelData, setExcelData] = useState<ExcelData | null>(null);
    const [bsNumber, setBsNumber] = useState<string | null>(null);
    const [bsAddress, setBsAddress] = useState<string | null>(null);
    const [total, setTotal] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const resetState = () => {
        setFile(null);
        setUploading(false);
        setUploadProgress(0);
        setExcelData(null);
        setBsNumber(null);
        setBsAddress(null);
        setTotal(null);
        setError(null);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const findValueByLabel = (data: ExcelData, label: string): string | number | null => {
        for (const sheet of Object.values(data)) {
            for (const row of sheet) {
                const labelEntry = Object.entries(row).find(
                    ([, value]) => value === label
                );

                if (labelEntry) {
                    const [labelKey] = labelEntry;
                    const keys = Object.keys(row);
                    const labelIndex = keys.indexOf(labelKey);

                    if (labelIndex !== -1 && labelIndex < keys.length - 1) {
                        const valueKey = keys[labelIndex + 1];
                        const value = row[valueKey];

                        if (typeof value === 'string' || typeof value === 'number') {
                            return value;
                        }
                    }
                }
            }
        }
        return null;
    };

    const parseMainValues = (data: ExcelData) => {
        const totalVal = findValueByLabel(data, 'Итого с учетом Коэф.') as number | null;
        setTotal(totalVal ?? null);

        const bsNum = findValueByLabel(data, 'Номер БС:') as string | null;
        const bsAddr = findValueByLabel(data, 'Адрес БС:') as string | null;

        setBsNumber(bsNum ?? null);
        setBsAddress(bsAddr ?? null);
    };

    const getTableData = (): ParsedWorkItem[] => {
        if (!excelData) return [];

        const excludedValues = [
            'сайт',
            'комплект',
            'шт.',
            'м.куб.',
            'м.кв.',
            'т.',
            'оттяжка',
            'м.п.',
            'смена',
            'км.',
            'талреп',
            'перекрытие',
            'шт',
            'шт. ',
        ];

        return Object.values(excelData)
            .flat()
            .filter((row) => {
                const quantity = row['__EMPTY_2'];
                const empty1Value = String(row['__EMPTY_1']);

                return (
                    row['__EMPTY_1'] &&
                    typeof quantity === 'number' &&
                    quantity !== 0 &&
                    row['__EMPTY_3'] &&
                    !excludedValues.includes(empty1Value)
                );
            })
            .map((row) => ({
                workType: String(row['__EMPTY_1']),
                quantity: Number(row['__EMPTY_2']),
                unit: String(row['__EMPTY_3']),
                note: row['__EMPTY_17'] ? String(row['__EMPTY_17']) : '',
            }));
    };

    const onDrop = useCallback(
        (acceptedFiles: File[], fileRejections: FileRejection[]) => {
            setError(null);
            setExcelData(null);
            setBsNumber(null);
            setBsAddress(null);
            setTotal(null);

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

            const response = await fetch('/api/estimates', {
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
        const workItems = getTableData();

        onApply({
            bsNumber: bsNumber || undefined,
            bsAddress: bsAddress || undefined,
            totalCost: typeof total === 'number' ? total : undefined,
            workItems,
            sourceFile: file || undefined,
        });

        resetState();
        onClose();
    };

    const canApply = !!excelData;
    const hasParsedPreview = !!excelData || !!bsNumber || !!bsAddress || typeof total === 'number';

    const title = operatorLabel ? `Заполнить по смете (${operatorLabel})` : 'Заполнить по смете';

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
                            {uploading ? 'Обработка...' : 'Распарсить смету'}
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
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
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
                                {typeof total === 'number' && (
                                    <Typography variant="body2">
                                        <b>Сумма сметы, ₽:</b> {total.toFixed(2)}
                                    </Typography>
                                )}
                            </Box>

                            {excelData && (
                                <Box>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Состав работ
                                    </Typography>
                                    <Paper
                                        variant="outlined"
                                        sx={{
                                            borderRadius: UI_RADIUS.item,
                                            borderColor: surfaceBorder,
                                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : undefined,
                                        }}
                                    >
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow sx={{ backgroundColor: tableHeadBg }}>
                                                    <TableCell>Вид работ</TableCell>
                                                    <TableCell>Кол-во</TableCell>
                                                    <TableCell>Ед.</TableCell>
                                                    <TableCell>Примечание</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {getTableData().map((item, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell>{item.workType}</TableCell>
                                                        <TableCell>{item.quantity}</TableCell>
                                                        <TableCell>{item.unit}</TableCell>
                                                        <TableCell>{item.note}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Paper>
                                </Box>
                            )}
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

export default T2EstimateParser;
