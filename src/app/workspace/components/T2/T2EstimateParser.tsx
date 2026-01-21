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
import { withBasePath } from '@/utils/basePath';

interface ExcelData {
    [sheetName: string]: Array<Record<string, unknown>>;
}

type ExcelRow = Record<string, unknown>;

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

const EXCLUDED_WORK_TYPES = new Set([
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
]);

const normalizeText = (value: unknown): string =>
    String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

const getColumnIndexFromKey = (key: string): number | null => {
    if (key === '__EMPTY') return 0;
    const match = /^__EMPTY_(\d+)$/.exec(key);
    return match ? Number(match[1]) : null;
};

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

            const labelIndex = getColumnIndexFromKey(key);
            const candidates: Array<string | number> = [];

            if (labelIndex !== null) {
                const indexedValues = Object.entries(row)
                    .map(([entryKey, entryValue]) => ({
                        index: getColumnIndexFromKey(entryKey),
                        value: entryValue,
                    }))
                    .filter((entry) => entry.index !== null && entry.index > labelIndex)
                    .sort((a, b) => (a.index as number) - (b.index as number));

                for (const entry of indexedValues) {
                    if (typeof entry.value === 'string' || typeof entry.value === 'number') {
                        candidates.push(entry.value);
                    }
                }
            } else {
                for (const entryValue of Object.values(row)) {
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

type TableMapping = {
    headerRowIndex: number;
    workTypeIndex: number | null;
    quantityIndex: number | null;
    unitIndex: number | null;
    noteIndex: number | null;
};

const findTableMappingInRows = (
    rows: ExcelRow[]
): { rows: ExcelRow[]; mapping: TableMapping } | null => {
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        let quantityIndex: number | null = null;
        let unitIndex: number | null = null;
        let noteIndex: number | null = null;
        let workTypeIndex: number | null = null;

        for (const [key, value] of Object.entries(row)) {
            if (typeof value !== 'string') continue;
            const text = normalizeText(value);

            if (text.includes('кол-во') || text.includes('количество')) {
                quantityIndex = getColumnIndexFromKey(key);
            }
            if (text.includes('ед. изм') || text.includes('ед изм') || text.includes('единиц')) {
                unitIndex = getColumnIndexFromKey(key);
            }
            if (text.includes('коммент') || text.includes('примеч')) {
                noteIndex = getColumnIndexFromKey(key);
            }
            if (text.includes('вид работ')) {
                workTypeIndex = getColumnIndexFromKey(key);
            }
        }

        if (quantityIndex !== null && unitIndex !== null) {
            if (workTypeIndex === null && i > 0) {
                for (const [key, value] of Object.entries(rows[i - 1])) {
                    if (typeof value !== 'string') continue;
                    if (normalizeText(value).includes('вид работ')) {
                        workTypeIndex = getColumnIndexFromKey(key);
                        break;
                    }
                }
            }

            if (noteIndex === null && i > 0) {
                for (const [key, value] of Object.entries(rows[i - 1])) {
                    if (typeof value !== 'string') continue;
                    const text = normalizeText(value);
                    if (text.includes('коммент') || text.includes('примеч')) {
                        noteIndex = getColumnIndexFromKey(key);
                        break;
                    }
                }
            }

            if (workTypeIndex === null && quantityIndex > 0) {
                workTypeIndex = quantityIndex - 1;
            }

            return {
                rows,
                mapping: {
                    headerRowIndex: i,
                    workTypeIndex,
                    quantityIndex,
                    unitIndex,
                    noteIndex,
                },
            };
        }
    }
    return null;
};

const countWorkItems = (
    rows: ExcelRow[],
    mapping: TableMapping
): number => {
    let count = 0;
    for (let i = mapping.headerRowIndex + 1; i < rows.length; i += 1) {
        const row = rows[i];
        const workTypeValue = getRowValueByIndex(row, mapping.workTypeIndex);
        const quantityValue = getRowValueByIndex(row, mapping.quantityIndex);
        const unitValue = getRowValueByIndex(row, mapping.unitIndex);

        const workType = typeof workTypeValue === 'string' ? workTypeValue.trim() : '';
        const quantity = toNumber(quantityValue);
        const unit = unitValue ? String(unitValue).trim() : '';

        if (!workType || quantity === null || quantity === 0 || !unit) continue;
        if (EXCLUDED_WORK_TYPES.has(normalizeText(workType))) continue;

        count += 1;
    }
    return count;
};

const findTableMapping = (
    data: ExcelData
): { rows: ExcelRow[]; mapping: TableMapping } | null => {
    let best: { rows: ExcelRow[]; mapping: TableMapping; score: number } | null = null;

    for (const rows of Object.values(data)) {
        const mappingInfo = findTableMappingInRows(rows);
        if (!mappingInfo) continue;

        const score = countWorkItems(rows, mappingInfo.mapping);
        if (!best || score > best.score) {
            best = { ...mappingInfo, score };
        }
    }

    return best ? { rows: best.rows, mapping: best.mapping } : null;
};

const getRowValueByIndex = (row: ExcelRow, index: number | null): unknown => {
    if (index === null) return undefined;
    for (const [key, value] of Object.entries(row)) {
        if (getColumnIndexFromKey(key) === index) return value;
    }
    return undefined;
};

const getRowNote = (row: ExcelRow, noteIndex: number | null, workType?: string): string => {
    if (noteIndex !== null) {
        const noteCandidates = Object.entries(row)
            .map(([key, value]) => ({
                index: getColumnIndexFromKey(key),
                value,
            }))
            .filter(
                (entry) =>
                    entry.index !== null &&
                    (entry.index as number) >= noteIndex &&
                    typeof entry.value === 'string' &&
                    entry.value.trim()
            )
            .sort((a, b) => (b.value as string).length - (a.value as string).length);

        if (noteCandidates.length > 0) {
            return String(noteCandidates[0].value);
        }
    }

    const normalizedWorkType = normalizeText(workType ?? '');
    const fallback = Object.values(row)
        .filter((value) => typeof value === 'string')
        .map((value) => String(value).trim())
        .filter(
            (value) =>
                value.length > 20 && normalizeText(value) !== normalizedWorkType
        );

    return fallback.length > 0 ? fallback[0] : '';
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

    const parseMainValues = (data: ExcelData) => {
        const tableInfo = findTableMapping(data);
        const totalMatchers = [
            (text: string) => text.includes('итого с ндс'),
            (text: string) => text.includes('итого с учетом коэф'),
            (text: string) => text === 'итого',
        ];
        const totalVal = (tableInfo
            ? findValueByLabelMatcherInRows(tableInfo.rows, totalMatchers[0], 'number') ??
              findValueByLabelMatcherInRows(tableInfo.rows, totalMatchers[1], 'number') ??
              findValueByLabelMatcherInRows(tableInfo.rows, totalMatchers[2], 'number')
            : findValueByLabelMatchers(data, totalMatchers, 'number')) as number | null;
        setTotal(totalVal ?? null);

        const bsNum = findValueByLabelMatchers(
            data,
            [(text) => text.includes('номер бс'), (text) => text.includes('№ бс')],
            'string'
        ) as string | null;
        const bsAddr = findValueByLabelMatchers(
            data,
            [(text) => text.includes('адрес бс')],
            'string'
        ) as string | null;

        setBsNumber(bsNum ?? null);
        setBsAddress(bsAddr ?? null);
    };

    const getTableData = (): ParsedWorkItem[] => {
        if (!excelData) return [];

        const tableInfo = findTableMapping(excelData);
        const rows = tableInfo ? tableInfo.rows : Object.values(excelData).flat();
        const mapping = tableInfo?.mapping;

        const startIndex = mapping ? mapping.headerRowIndex + 1 : 0;
        const items: ParsedWorkItem[] = [];

        for (let i = startIndex; i < rows.length; i += 1) {
            const row = rows[i];
            const workTypeValue = mapping
                ? getRowValueByIndex(row, mapping.workTypeIndex)
                : row['__EMPTY_1'];
            const quantityValue = mapping
                ? getRowValueByIndex(row, mapping.quantityIndex)
                : row['__EMPTY_2'];
            const unitValue = mapping
                ? getRowValueByIndex(row, mapping.unitIndex)
                : row['__EMPTY_3'];

            const workType = typeof workTypeValue === 'string' ? workTypeValue.trim() : '';
            const quantity = toNumber(quantityValue);
            const unit = unitValue ? String(unitValue).trim() : '';

            if (!workType || quantity === null || quantity === 0 || !unit) continue;
            if (EXCLUDED_WORK_TYPES.has(normalizeText(workType))) continue;

            const note = mapping
                ? getRowNote(row, mapping.noteIndex, workType)
                : row['__EMPTY_17']
                ? String(row['__EMPTY_17'])
                : '';

            items.push({
                workType,
                quantity,
                unit,
                note,
            });
        }

        if (items.length === 0 && !mapping) {
            return items;
        }

        if (items.length === 0 && mapping) {
            return Object.values(excelData)
                .flat()
                .filter((row) => {
                    const quantity = row['__EMPTY_2'];
                    const workType = row['__EMPTY_1'];
                    const unit = row['__EMPTY_3'];

                    return (
                        typeof workType === 'string' &&
                        typeof quantity === 'number' &&
                        quantity !== 0 &&
                        typeof unit === 'string' &&
                        !EXCLUDED_WORK_TYPES.has(normalizeText(workType))
                    );
                })
                .map((row) => ({
                    workType: String(row['__EMPTY_1']),
                    quantity: Number(row['__EMPTY_2']),
                    unit: String(row['__EMPTY_3']),
                    note: row['__EMPTY_17'] ? String(row['__EMPTY_17']) : '',
                }));
        }

        return items;
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
