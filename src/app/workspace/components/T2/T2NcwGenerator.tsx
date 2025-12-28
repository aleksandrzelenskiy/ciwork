'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { PDFDownloadLink, PDFViewer, pdf } from '@react-pdf/renderer';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import SaveIcon from '@mui/icons-material/Save';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { PdfTemplate } from '@/features/shared/PdfTemplate';

dayjs.locale('ru');

type Props = {
    taskId?: string;
    orgSlug?: string;
    projectKey?: string;
    initialOrderNumber?: string | null;
    initialOrderDate?: string | null;
    initialOrderSignDate?: string | null;
    initialCompletionDate?: string | null;
    initialBsNumber?: string | null;
    initialAddress?: string | null;
    open?: boolean;
    onSaved?: (url?: string) => void;
    onClose?: () => void;
};

type SnackState = { open: boolean; msg: string; severity: 'success' | 'error' };

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

function toDayjs(value?: string | null): Dayjs | null {
    if (!value) return null;
    const d = dayjs(value);
    return d.isValid() ? d : null;
}

export const T2NcwGenerator = ({
    taskId: taskIdProp,
    orgSlug,
    projectKey,
    initialCompletionDate,
    initialOrderNumber,
    initialOrderDate,
    initialOrderSignDate,
    initialBsNumber,
    initialAddress,
    open = true,
    onSaved,
    onClose,
}: Props) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const cardBg = isDark ? 'rgba(10,13,20,0.92)' : 'rgba(255,255,255,0.95)';
    const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const cardShadow = isDark ? '0 30px 80px rgba(0,0,0,0.65)' : '0 20px 50px rgba(15,23,42,0.12)';
    const inputBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.96)';
    const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)';
    const textInputSx = {
        '& .MuiOutlinedInput-root': {
            backgroundColor: inputBg,
            '& fieldset': { borderColor: inputBorder },
            '&:hover fieldset': { borderColor: isDark ? 'rgba(125,211,252,0.5)' : 'rgba(59,130,246,0.4)' },
            '&.Mui-focused fieldset': { borderColor: isDark ? 'rgba(59,130,246,0.9)' : 'rgba(59,130,246,0.7)' },
        },
    };
    const cardSx = {
        p: 2.5,
        borderRadius: 3,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        backdropFilter: 'blur(10px)',
    };
    const previewBoxBg = isDark ? 'rgba(16,21,32,0.95)' : '#fff';

    const params = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const taskIdFromQuery = params?.get('taskId') ?? '';
    const taskIdFromPath = useMemo(() => {
        const parts = (pathname || '').split('/').filter(Boolean);
        const ix = parts.lastIndexOf('tasks');
        if (ix >= 0 && parts[ix + 1]) return parts[ix + 1];
        return '';
    }, [pathname]);

    const taskId = (taskIdProp || taskIdFromQuery || taskIdFromPath || '').toUpperCase();

    const initialOrderNumberParam = params?.get('orderNumber') ?? '';
    const initialOrderDateParam = params?.get('orderDate') ?? '';
    const initialOrderSignDateParam = params?.get('orderSignDate') ?? '';
    const initialCompletionDateParam = params?.get('completionDate') ?? '';
    const initialObjectNumberParam = params?.get('objectNumber') ?? '';
    const initialObjectAddressParam = params?.get('objectAddress') ?? '';
    const initialOrderDateFromProps = useMemo(
        () => toDayjs(initialOrderDate),
        [initialOrderDate],
    );
    const initialOrderSignDateFromProps = useMemo(
        () => toDayjs(initialOrderSignDate),
        [initialOrderSignDate],
    );
    const initialCompletionDateFromProps = useMemo(
        () => toDayjs(initialCompletionDate),
        [initialCompletionDate],
    );

    const [contractNumber, setContractNumber] = useState('27-1/25');
    const [contractDate, setContractDate] = useState<Dayjs | null>(dayjs('2025-04-07'));

    const [orderNumber, setOrderNumber] = useState(initialOrderNumber ?? initialOrderNumberParam);
    const [objectNumber, setObjectNumber] = useState(initialBsNumber ?? initialObjectNumberParam);
    const [objectAddress, setObjectAddress] = useState(initialAddress ?? initialObjectAddressParam);

    const [orderDate, setOrderDate] = useState<Dayjs | null>(() => {
        if (initialOrderDate) return toDayjs(initialOrderDate);
        if (initialOrderDateParam) return dayjs(initialOrderDateParam);
        return null;
    });
    const [completionDate, setCompletionDate] = useState<Dayjs | null>(() => {
        if (initialCompletionDate) return toDayjs(initialCompletionDate);
        if (initialCompletionDateParam) return dayjs(initialCompletionDateParam);
        if (initialOrderSignDate) return toDayjs(initialOrderSignDate);
        if (initialOrderSignDateParam) return dayjs(initialOrderSignDateParam);
        return null;
    });

    const [saving, setSaving] = useState(false);
    const [snack, setSnack] = useState<SnackState>({
        open: false,
        msg: '',
        severity: 'success',
    });

    useEffect(() => {
        const nextOrderNumber = initialOrderNumber ?? initialOrderNumberParam;
        const orderDateFromParams = initialOrderDateParam ? dayjs(initialOrderDateParam) : null;
        const completionDateFromParams = initialCompletionDateParam
            ? dayjs(initialCompletionDateParam)
            : null;
        const nextOrderDate = initialOrderDateFromProps ?? orderDateFromParams ?? null;
        const nextCompletion =
            initialCompletionDateFromProps ??
            completionDateFromParams ??
            initialOrderSignDateFromProps ??
            nextOrderDate ??
            null;
        const nextObjectNumber = initialBsNumber ?? initialObjectNumberParam;
        const nextObjectAddress = initialAddress ?? initialObjectAddressParam;

        setContractNumber('27-1/25');
        setContractDate(dayjs('2025-04-07'));
        setOrderNumber(nextOrderNumber ?? '');
        setObjectNumber(nextObjectNumber ?? '');
        setObjectAddress(nextObjectAddress ?? '');
        setOrderDate(nextOrderDate ?? null);
        setCompletionDate(nextCompletion);
    }, [
        initialOrderNumber,
        initialOrderDate,
        initialOrderSignDate,
        initialCompletionDate,
        initialBsNumber,
        initialAddress,
        initialOrderNumberParam,
        initialOrderDateParam,
        initialCompletionDateParam,
        initialOrderDateFromProps,
        initialOrderSignDateFromProps,
        initialCompletionDateFromProps,
        initialObjectNumberParam,
        initialObjectAddressParam,
        open,
    ]);

    const isValid =
        !!contractNumber &&
        !!contractDate &&
        !!orderNumber &&
        !!objectNumber &&
        !!objectAddress &&
        !!orderDate &&
        !!completionDate &&
        completionDate.isAfter(orderDate);

    const formData = {
        orderNumber,
        objectNumber,
        objectAddress,
        contractNumber,
        contractDate: contractDate?.format('DD.MM.YYYY') || '',
        orderDate: orderDate?.format('DD.MM.YYYY') || '',
        completionDate: completionDate?.format('DD.MM.YYYY') || '',
    };

    const handleSaveToTask = async () => {
        setSaving(true);
        try {
            if (!taskId) {
                setSnack({ open: true, msg: 'Не удалось определить taskId', severity: 'error' });
                return;
            }
            if (!isValid || !completionDate) {
                setSnack({ open: true, msg: 'Заполните форму корректно', severity: 'error' });
                return;
            }

            const instance = pdf(<PdfTemplate {...formData} />);
            const blob = await instance.toBlob();

            const fd = new FormData();
            const filename = `Уведомление_${orderNumber || taskId}.pdf`;
            fd.append('file', blob, filename);
            fd.append('taskId', taskId);
            fd.append('subfolder', 'documents');
            if (orgSlug) fd.append('orgSlug', orgSlug);
            if (projectKey) fd.append('projectKey', projectKey);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: fd,
            });

            let uploadBody: unknown = null;
            try {
                uploadBody = await uploadResponse.json();
            } catch {
                /* ignore */
            }

            if (!uploadResponse.ok) {
                const msg =
                    uploadBody &&
                    typeof uploadBody === 'object' &&
                    'error' in uploadBody &&
                    typeof (uploadBody as { error?: unknown }).error === 'string'
                        ? (uploadBody as { error?: string }).error
                        : `HTTP ${uploadResponse.status}`;
                setSnack({ open: true, msg: `Ошибка сохранения: ${msg}`, severity: 'error' });
                return;
            }

            const uploadedUrl =
                uploadBody &&
                typeof uploadBody === 'object' &&
                'urls' in uploadBody &&
                Array.isArray((uploadBody as { urls?: unknown }).urls) &&
                (uploadBody as { urls: unknown[] }).urls.length > 0
                    ? String((uploadBody as { urls: unknown[] }).urls[0])
                    : undefined;

            if (completionDate) {
                const metaResponse = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workCompletionDate: completionDate.toDate().toISOString(),
                        ncwUrl: uploadedUrl,
                    }),
                });

                if (!metaResponse.ok) {
                    const metaBody = await metaResponse.json().catch(() => null);
                    const msg =
                        metaBody &&
                        typeof metaBody === 'object' &&
                        'error' in metaBody &&
                        typeof (metaBody as { error?: unknown }).error === 'string'
                            ? (metaBody as { error?: string }).error
                            : `HTTP ${metaResponse.status}`;
                    setSnack({
                        open: true,
                        msg: `Ошибка сохранения данных задачи: ${msg}`,
                        severity: 'error',
                    });
                    return;
                }
            }

            setSnack({ open: true, msg: 'Уведомление сохранено', severity: 'success' });

            if (onSaved) {
                onSaved(uploadedUrl);
            } else {
                onClose?.();
                router.push(`/tasks/${encodeURIComponent(taskId)}`);
            }
        } catch (e: unknown) {
            setSnack({ open: true, msg: `Ошибка сохранения: ${errorMessage(e)}`, severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box
                mt={open ? 4 : 0}
                display="flex"
                flexDirection={{ xs: 'column', md: 'row' }}
                gap={{ xs: 3, md: 4 }}
                sx={{ width: '100%' }}
            >
                <Stack spacing={3} flex={1} sx={cardSx}>
                    <Typography variant="h5">Генерация уведомления о завершении работ</Typography>

                    <TextField
                        label="Номер договора"
                        value={contractNumber}
                        onChange={(e) => setContractNumber(e.target.value)}
                        fullWidth
                        sx={textInputSx}
                    />

                    <DatePicker
                        label="Дата договора"
                        format="DD.MM.YYYY"
                        value={contractDate}
                        onChange={setContractDate}
                        slotProps={{ textField: { fullWidth: true, sx: textInputSx } }}
                    />

                    <TextField
                        label="Номер заказа"
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        fullWidth
                        sx={textInputSx}
                    />

                    <DatePicker
                        label="Дата заказа"
                        format="DD.MM.YYYY"
                        value={orderDate}
                        onChange={setOrderDate}
                        slotProps={{ textField: { fullWidth: true, sx: textInputSx } }}
                    />

                    <DatePicker
                        label="Дата окончания работ"
                        format="DD.MM.YYYY"
                        value={completionDate}
                        onChange={setCompletionDate}
                        slotProps={{ textField: { fullWidth: true, sx: textInputSx } }}
                    />

                    <TextField
                        label="Номер объекта"
                        value={objectNumber}
                        onChange={(e) => setObjectNumber(e.target.value)}
                        fullWidth
                        sx={textInputSx}
                    />

                    <TextField
                        label="Адрес объекта"
                        value={objectAddress}
                        onChange={(e) => setObjectAddress(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                        sx={textInputSx}
                    />
                </Stack>

                <Stack
                    spacing={2}
                    flex={{ xs: 'none', md: 1 }}
                    sx={{
                        flexBasis: { xs: '100%', md: '55%' },
                        ...cardSx,
                    }}
                >
                    <Typography variant="h5">Предпросмотр</Typography>
                    <Box
                        sx={{
                            borderRadius: 2,
                            border: `1px solid ${cardBorder}`,
                            overflow: 'hidden',
                            height: { xs: 380, md: 560 },
                            backgroundColor: previewBoxBg,
                            boxShadow: cardShadow,
                        }}
                    >
                        <PDFViewer width="100%" height="100%">
                            <PdfTemplate {...formData} />
                        </PDFViewer>
                    </Box>

                    {orderDate && completionDate && completionDate.isBefore(orderDate) && (
                        <Alert severity="error">
                            Дата окончания работ не может быть раньше даты заказа.
                        </Alert>
                    )}

                    <Box display="flex" justifyContent="center" flexWrap="wrap" gap={2}>
                        <PDFDownloadLink
                            document={<PdfTemplate {...formData} />}
                            fileName={`Уведомление_${orderNumber || 'UOR'}.pdf`}
                        >
                            {({ loading }) => (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={<CloudDownloadIcon />}
                                >
                                    {loading ? (
                                        <>
                                            <CircularProgress size={18} sx={{ mr: 1, color: 'inherit' }} />
                                            Генерация…
                                        </>
                                    ) : (
                                        'Скачать PDF'
                                    )}
                                </Button>
                            )}
                        </PDFDownloadLink>

                        <Button
                            variant="outlined"
                            startIcon={<SaveIcon />}
                            disabled={saving || !isValid}
                            onClick={handleSaveToTask}
                            title={taskId ? `Сохранить в задачу ${taskId}` : 'taskId не определён'}
                        >
                            {saving ? (
                                <>
                                    <CircularProgress size={18} sx={{ mr: 1 }} />
                                    Сохранение…
                                </>
                            ) : (
                                'Сохранить в задачу'
                            )}
                        </Button>
                    </Box>
                </Stack>
            </Box>

            <Snackbar
                open={snack.open}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                message={snack.msg}
                autoHideDuration={4000}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </LocalizationProvider>
    );
};

export const NcwGenerator = T2NcwGenerator;
