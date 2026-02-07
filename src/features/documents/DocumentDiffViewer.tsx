'use client';

import React from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    Stack,
    Typography,
} from '@mui/material';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

type DiffViewerProps = {
    open: boolean;
    onClose: () => void;
    currentFiles: string[];
    previousFiles: string[];
    buildProxyUrl: (fileUrl: string) => string;
};

type PdfDoc = pdfjsLib.PDFDocumentProxy;

const getDefaultPdf = (files: string[]) => files.find((file) => file.toLowerCase().endsWith('.pdf')) || '';

const useContainerWidth = () => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const [width, setWidth] = React.useState(480);

    React.useEffect(() => {
        if (!containerRef.current) return;
        const element = containerRef.current;
        const updateWidth = () => {
            const next = Math.max(280, Math.min(520, element.clientWidth || 480));
            setWidth(next);
        };
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return { containerRef, width };
};

export default function DocumentDiffViewer({
    open,
    onClose,
    currentFiles,
    previousFiles,
    buildProxyUrl,
}: DiffViewerProps) {
    const [currentFile, setCurrentFile] = React.useState('');
    const [previousFile, setPreviousFile] = React.useState('');
    const [currentDoc, setCurrentDoc] = React.useState<PdfDoc | null>(null);
    const [previousDoc, setPreviousDoc] = React.useState<PdfDoc | null>(null);
    const [pageNumber, setPageNumber] = React.useState(1);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [diffEnabled, setDiffEnabled] = React.useState(true);
    const [sensitivity, setSensitivity] = React.useState(55);
    const [singleColumn, setSingleColumn] = React.useState(false);

    const currentCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const previousCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const diffCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const previousScrollRef = React.useRef<HTMLDivElement | null>(null);
    const currentScrollRef = React.useRef<HTMLDivElement | null>(null);
    const diffScrollRef = React.useRef<HTMLDivElement | null>(null);
    const syncingScrollRef = React.useRef(false);
    const { containerRef, width: targetWidth } = useContainerWidth();

    const pageCount = Math.min(currentDoc?.numPages || 0, previousDoc?.numPages || 0);

    const hasPdfPair = currentFiles.length > 0 && previousFiles.length > 0;

    React.useEffect(() => {
        if (!open) return;
        setCurrentFile((prev) => (prev && currentFiles.includes(prev) ? prev : getDefaultPdf(currentFiles)));
        setPreviousFile((prev) => (prev && previousFiles.includes(prev) ? prev : getDefaultPdf(previousFiles)));
    }, [open, currentFiles, previousFiles]);

    React.useEffect(() => {
        if (!open) return;
        if (!currentFile || !previousFile) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        const loadDoc = async (fileUrl: string) => {
            const proxyUrl = buildProxyUrl(fileUrl);
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Не удалось загрузить PDF');
            const buffer = await response.arrayBuffer();
            return pdfjsLib.getDocument({ data: buffer }).promise;
        };

        Promise.all([loadDoc(currentFile), loadDoc(previousFile)])
            .then(([current, previous]) => {
                if (cancelled) return;
                setCurrentDoc(current);
                setPreviousDoc(previous);
                setPageNumber(1);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Не удалось открыть PDF');
                setCurrentDoc(null);
                setPreviousDoc(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [open, currentFile, previousFile, buildProxyUrl]);

    const renderPage = React.useCallback(
        async (doc: PdfDoc, canvas: HTMLCanvasElement) => {
            const page = await doc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1 });
            const scale = Math.max(0.5, targetWidth / viewport.width);
            const scaledViewport = page.getViewport({ scale });
            canvas.width = Math.floor(scaledViewport.width);
            canvas.height = Math.floor(scaledViewport.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        },
        [pageNumber, targetWidth]
    );

    const renderDiff = React.useCallback(() => {
        const currentCanvas = currentCanvasRef.current;
        const previousCanvas = previousCanvasRef.current;
        const diffCanvas = diffCanvasRef.current;
        if (!currentCanvas || !previousCanvas || !diffCanvas) return;
        const width = Math.min(currentCanvas.width, previousCanvas.width);
        const height = Math.min(currentCanvas.height, previousCanvas.height);
        if (!width || !height) return;

        if (!diffEnabled) {
            const diffCtx = diffCanvas.getContext('2d');
            if (diffCtx) diffCtx.clearRect(0, 0, width, height);
            return;
        }

        const currentCtx = currentCanvas.getContext('2d');
        const previousCtx = previousCanvas.getContext('2d');
        const diffCtx = diffCanvas.getContext('2d');
        if (!currentCtx || !previousCtx || !diffCtx) return;

        diffCanvas.width = width;
        diffCanvas.height = height;
        const currentData = currentCtx.getImageData(0, 0, width, height);
        const previousData = previousCtx.getImageData(0, 0, width, height);
        const diffData = diffCtx.createImageData(width, height);
        const threshold = Math.max(40, Math.min(280, (100 - sensitivity) * 4));
        const rowMin = new Array<number>(height).fill(Number.POSITIVE_INFINITY);
        const rowMax = new Array<number>(height).fill(Number.NEGATIVE_INFINITY);

        for (let i = 0; i < currentData.data.length; i += 4) {
            const dr = Math.abs(currentData.data[i] - previousData.data[i]);
            const dg = Math.abs(currentData.data[i + 1] - previousData.data[i + 1]);
            const db = Math.abs(currentData.data[i + 2] - previousData.data[i + 2]);
            const delta = dr + dg + db;
            if (delta > threshold) {
                diffData.data[i] = 255;
                diffData.data[i + 1] = 66;
                diffData.data[i + 2] = 66;
                diffData.data[i + 3] = 180;
                const pixelIndex = i / 4;
                const x = pixelIndex % width;
                const y = Math.floor(pixelIndex / width);
                if (x < rowMin[y]) rowMin[y] = x;
                if (x > rowMax[y]) rowMax[y] = x;
            } else {
                diffData.data[i + 3] = 0;
            }
        }

        diffCtx.putImageData(diffData, 0, 0);

        // Draw grouped diff blocks for clearer readability.
        diffCtx.save();
        diffCtx.strokeStyle = 'rgba(255, 193, 7, 0.9)';
        diffCtx.lineWidth = 2;
        const boxes: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];
        let activeBox: { x1: number; x2: number; y1: number; y2: number } | null = null;
        const padding = 6;

        for (let y = 0; y < height; y += 2) {
            const min = rowMin[y];
            const max = rowMax[y];
            if (!Number.isFinite(min) || !Number.isFinite(max)) {
                if (activeBox) {
                    boxes.push(activeBox);
                    activeBox = null;
                }
                continue;
            }
            if (!activeBox) {
                activeBox = { x1: min, x2: max, y1: y, y2: y };
                continue;
            }
            const overlaps = min <= activeBox.x2 + 12 && max >= activeBox.x1 - 12;
            if (overlaps) {
                activeBox.x1 = Math.min(activeBox.x1, min);
                activeBox.x2 = Math.max(activeBox.x2, max);
                activeBox.y2 = y;
            } else {
                boxes.push(activeBox);
                activeBox = { x1: min, x2: max, y1: y, y2: y };
            }
        }
        if (activeBox) boxes.push(activeBox);

        boxes.forEach((box) => {
            const x = Math.max(0, box.x1 - padding);
            const y = Math.max(0, box.y1 - padding);
            const w = Math.min(width, box.x2 + padding) - x;
            const h = Math.min(height, box.y2 + padding) - y;
            if (w > 6 && h > 6) diffCtx.strokeRect(x, y, w, h);
        });

        diffCtx.restore();
    }, [diffEnabled, sensitivity]);

    React.useEffect(() => {
        if (!currentDoc || !previousDoc) return;
        let cancelled = false;
        const run = async () => {
            if (!currentCanvasRef.current || !previousCanvasRef.current) return;
            await Promise.all([
                renderPage(currentDoc, currentCanvasRef.current),
                renderPage(previousDoc, previousCanvasRef.current),
            ]);
            if (!cancelled) renderDiff();
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [currentDoc, previousDoc, renderPage, renderDiff]);

    React.useEffect(() => {
        renderDiff();
    }, [diffEnabled, sensitivity, renderDiff]);

    const pageLabel = pageCount > 0 ? `Страница ${pageNumber} из ${pageCount}` : 'Страница';

    const syncScroll = React.useCallback((source: HTMLDivElement | null) => {
        if (!source) return;
        if (syncingScrollRef.current) return;
        syncingScrollRef.current = true;
        const { scrollTop, scrollLeft } = source;
        [previousScrollRef.current, currentScrollRef.current, diffScrollRef.current].forEach((node) => {
            if (node && node !== source) {
                node.scrollTop = scrollTop;
                node.scrollLeft = scrollLeft;
            }
        });
        window.requestAnimationFrame(() => {
            syncingScrollRef.current = false;
        });
    }, []);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
            <DialogTitle>Сравнение PDF</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                        <FormControl fullWidth>
                            <InputLabel id="diff-current-file">Текущий файл</InputLabel>
                            <Select
                                labelId="diff-current-file"
                                value={currentFile}
                                label="Текущий файл"
                                onChange={(event) => setCurrentFile(event.target.value)}
                            >
                                {currentFiles.length === 0 ? (
                                    <MenuItem value="" disabled>
                                        PDF не найден
                                    </MenuItem>
                                ) : (
                                    currentFiles.map((file) => (
                                        <MenuItem key={file} value={file}>
                                            {file.split('/').slice(-1)[0]}
                                        </MenuItem>
                                    ))
                                )}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel id="diff-previous-file">Предыдущий файл</InputLabel>
                            <Select
                                labelId="diff-previous-file"
                                value={previousFile}
                                label="Предыдущий файл"
                                onChange={(event) => setPreviousFile(event.target.value)}
                            >
                                {previousFiles.length === 0 ? (
                                    <MenuItem value="" disabled>
                                        PDF не найден
                                    </MenuItem>
                                ) : (
                                    previousFiles.map((file) => (
                                        <MenuItem key={file} value={file}>
                                            {file.split('/').slice(-1)[0]}
                                        </MenuItem>
                                    ))
                                )}
                            </Select>
                        </FormControl>
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                        <Typography variant="body2">{pageLabel}</Typography>
                        <Stack direction="row" spacing={1}>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={pageNumber <= 1}
                                onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                            >
                                Назад
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                disabled={pageCount === 0 || pageNumber >= pageCount}
                                onClick={() => setPageNumber((prev) => Math.min(pageCount, prev + 1))}
                            >
                                Вперед
                            </Button>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                                size="small"
                                variant={diffEnabled ? 'contained' : 'outlined'}
                                onClick={() => setDiffEnabled((prev) => !prev)}
                                disabled={!hasPdfPair}
                            >
                                {diffEnabled ? 'Скрыть diff' : 'Показать diff'}
                            </Button>
                            <Button
                                size="small"
                                variant={singleColumn ? 'contained' : 'outlined'}
                                onClick={() => setSingleColumn((prev) => !prev)}
                            >
                                {singleColumn ? 'Три колонки' : 'Одна колонка'}
                            </Button>
                            <Box sx={{ width: 220 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Чувствительность
                                </Typography>
                                <Slider
                                    size="small"
                                    value={sensitivity}
                                    onChange={(_, value) => setSensitivity(value as number)}
                                    min={10}
                                    max={90}
                                />
                            </Box>
                        </Stack>
                    </Stack>

                    {error && <Typography color="error">{error}</Typography>}
                    {loading && <CircularProgress size={24} />}

                    {!hasPdfPair ? (
                        <Typography variant="body2" color="text.secondary">
                            Нет PDF-файлов для сравнения. Загрузите PDF в текущей и предыдущей версии.
                        </Typography>
                    ) : (
                        <Box ref={containerRef}>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    md: singleColumn ? '1fr' : '1fr 1fr 1fr',
                                },
                                gap: 2,
                            }}
                        >
                            <Stack spacing={1}>
                                <Typography variant="subtitle2">Предыдущая версия</Typography>
                                <Box
                                    ref={previousScrollRef}
                                    onScroll={() => syncScroll(previousScrollRef.current)}
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        p: 1,
                                        maxHeight: 520,
                                        overflow: 'auto',
                                        bgcolor: 'background.paper',
                                    }}
                                >
                                    <canvas ref={previousCanvasRef} style={{ width: '100%', height: 'auto' }} />
                                </Box>
                            </Stack>
                            <Stack spacing={1}>
                                <Typography variant="subtitle2">Текущая версия</Typography>
                                <Box
                                    ref={currentScrollRef}
                                    onScroll={() => syncScroll(currentScrollRef.current)}
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        p: 1,
                                        maxHeight: 520,
                                        overflow: 'auto',
                                        bgcolor: 'background.paper',
                                    }}
                                >
                                    <canvas ref={currentCanvasRef} style={{ width: '100%', height: 'auto' }} />
                                </Box>
                            </Stack>
                            <Stack spacing={1}>
                                <Typography variant="subtitle2">Различия</Typography>
                                <Box
                                    ref={diffScrollRef}
                                    onScroll={() => syncScroll(diffScrollRef.current)}
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        p: 1,
                                        maxHeight: 520,
                                        overflow: 'auto',
                                        bgcolor: 'background.paper',
                                    }}
                                >
                                    <canvas ref={diffCanvasRef} style={{ width: '100%', height: 'auto' }} />
                                </Box>
                            </Stack>
                        </Box>
                    </Box>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
}
