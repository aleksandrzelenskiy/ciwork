'use client';

import React, { useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, Container, Grid2 as Grid, Stack, Typography } from '@mui/material';
import RrlProfileForm, {
    type CoordinateMode,
    type RrlProfileFormErrors,
    type RrlProfileFormValues,
} from '@/components/rrl-profile/RrlProfileForm';
import RrlProfileSummary from '@/components/rrl-profile/RrlProfileSummary';
import RrlProfileChart from '@/components/rrl-profile/RrlProfileChart';
import RrlProfileTable from '@/components/rrl-profile/RrlProfileTable';
import type { ApiErrorPayload, RrlProfileCalculateResponse } from '@/lib/rrl/types';
import { withBasePath } from '@/utils/basePath';

type ApiSuccessPayload = RrlProfileCalculateResponse & {
    meta?: {
        elevationProvider?: string;
    };
};

const isApiErrorPayload = (payload: unknown): payload is ApiErrorPayload => {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
    );
};

const defaultValues: RrlProfileFormValues = {
    aName: '',
    aLat: '',
    aLon: '',
    bName: '',
    bLat: '',
    bLon: '',
    antennaA: '30',
    antennaB: '20',
    freqGHz: '18',
    kFactor: '1.33',
    stepMeters: '30',
};

const exampleValues: RrlProfileFormValues = {
    aName: '75-519',
    aLat: '52.072472',
    aLon: '113.376417',
    bName: '75-002',
    bLat: '52.074328',
    bLon: '113.385764',
    antennaA: '30',
    antennaB: '20',
    freqGHz: '18',
    kFactor: '1.33',
    stepMeters: '30',
};

const parseNumber = (value: string): number => Number(value);

const validate = (values: RrlProfileFormValues): RrlProfileFormErrors => {
    const errors: RrlProfileFormErrors = {};

    const aLat = parseNumber(values.aLat);
    const aLon = parseNumber(values.aLon);
    const bLat = parseNumber(values.bLat);
    const bLon = parseNumber(values.bLon);
    const antennaA = parseNumber(values.antennaA);
    const antennaB = parseNumber(values.antennaB);
    const freqGHz = parseNumber(values.freqGHz);
    const kFactor = parseNumber(values.kFactor);
    const stepMeters = parseNumber(values.stepMeters);

    if (!Number.isFinite(aLat) || aLat < -90 || aLat > 90) errors.aLat = 'lat: диапазон [-90..90]';
    if (!Number.isFinite(aLon) || aLon < -180 || aLon > 180) errors.aLon = 'lon: диапазон [-180..180]';
    if (!Number.isFinite(bLat) || bLat < -90 || bLat > 90) errors.bLat = 'lat: диапазон [-90..90]';
    if (!Number.isFinite(bLon) || bLon < -180 || bLon > 180) errors.bLon = 'lon: диапазон [-180..180]';

    if (!Number.isFinite(antennaA) || antennaA < 0) errors.antennaA = 'Высота >= 0';
    if (!Number.isFinite(antennaB) || antennaB < 0) errors.antennaB = 'Высота >= 0';
    if (!Number.isFinite(freqGHz) || freqGHz <= 0) errors.freqGHz = 'Частота > 0';
    if (!Number.isFinite(kFactor) || kFactor <= 0) errors.kFactor = 'k > 0';
    if (!Number.isFinite(stepMeters) || stepMeters <= 0) errors.stepMeters = 'Шаг > 0';

    if (
        Number.isFinite(aLat) &&
        Number.isFinite(aLon) &&
        Number.isFinite(bLat) &&
        Number.isFinite(bLon) &&
        aLat === bLat &&
        aLon === bLon
    ) {
        errors.bLat = 'Точки A и B совпадают';
        errors.bLon = 'Точки A и B совпадают';
    }

    return errors;
};

export default function RrlProfilePage() {
    const [values, setValues] = useState<RrlProfileFormValues>(defaultValues);
    const [errors, setErrors] = useState<RrlProfileFormErrors>({});
    const [result, setResult] = useState<RrlProfileCalculateResponse | null>(null);
    const [elevationProvider, setElevationProvider] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [coordinateMode, setCoordinateMode] = useState<CoordinateMode>('dd');
    const [xUnit, setXUnit] = useState<'m' | 'km'>('km');

    const hasResult = Boolean(result);

    const payload = useMemo(() => {
        return {
            a: {
                lat: parseNumber(values.aLat),
                lon: parseNumber(values.aLon),
                name: values.aName || undefined,
            },
            b: {
                lat: parseNumber(values.bLat),
                lon: parseNumber(values.bLon),
                name: values.bName || undefined,
            },
            antennaA: parseNumber(values.antennaA),
            antennaB: parseNumber(values.antennaB),
            freqGHz: parseNumber(values.freqGHz),
            kFactor: parseNumber(values.kFactor),
            stepMeters: parseNumber(values.stepMeters),
        };
    }, [values]);

    const updateField = (field: keyof RrlProfileFormValues, value: string) => {
        setValues((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleReset = () => {
        setValues(defaultValues);
        setErrors({});
        setResult(null);
        setServerError(null);
        setElevationProvider(undefined);
    };

    const handleSubmit = async () => {
        const nextErrors = validate(values);
        setErrors(nextErrors);
        setServerError(null);

        if (Object.keys(nextErrors).length > 0) {
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(withBasePath('/api/rrl-profile/calculate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = (await response.json().catch(() => null)) as
                | ApiSuccessPayload
                | ApiErrorPayload
                | null;

            if (!response.ok || !data || isApiErrorPayload(data)) {
                const message =
                    isApiErrorPayload(data)
                        ? `${data.error.message}${data.error.details ? `: ${data.error.details}` : ''}`
                        : 'Ошибка расчёта профиля';
                setServerError(message);
                setResult(null);
                setElevationProvider(undefined);
                return;
            }

            setResult(data);
            setElevationProvider(data.meta?.elevationProvider);
        } catch (error) {
            setServerError((error as Error).message || 'Ошибка сети');
            setResult(null);
            setElevationProvider(undefined);
        } finally {
            setLoading(false);
        }
    };

    const handleExportJson = () => {
        if (!result) {
            return;
        }

        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rrl-profile-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Container maxWidth='xl' sx={{ py: { xs: 2, md: 4 } }}>
            <Stack spacing={2.5}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent='space-between' alignItems={{ xs: 'flex-start', md: 'center' }} gap={1.5}>
                    <div>
                        <Typography variant='h4'>Проверка профиля РРЛ</Typography>
                        <Typography color='text.secondary'>LoS, зона Френеля, кривизна Земли с учётом k-factor</Typography>
                    </div>

                    {hasResult ? (
                        <Button variant='outlined' onClick={handleExportJson}>Экспорт JSON</Button>
                    ) : null}
                </Stack>

                <RrlProfileForm
                    values={values}
                    errors={errors}
                    loading={loading}
                    coordinateMode={coordinateMode}
                    onCoordinateModeChange={setCoordinateMode}
                    onChange={updateField}
                    onSubmit={handleSubmit}
                    onReset={handleReset}
                    onFillExample={() => {
                        setValues(exampleValues);
                        setErrors({});
                        setServerError(null);
                    }}
                    onPresetK={(value) => updateField('kFactor', String(value))}
                />

                {loading ? (
                    <Alert icon={<CircularProgress size={18} />} severity='info'>
                        Расчёт профиля выполняется. Получаем DEM и считаем кривые...
                    </Alert>
                ) : null}

                {serverError ? <Alert severity='error'>{serverError}</Alert> : null}

                {result ? (
                    <Grid container spacing={2.5}>
                        <Grid size={12}>
                            <RrlProfileSummary result={result} elevationProvider={elevationProvider} />
                        </Grid>
                        <Grid size={12}>
                            <RrlProfileChart result={result} xUnit={xUnit} onXUnitChange={setXUnit} />
                        </Grid>
                        <Grid size={12}>
                            <RrlProfileTable result={result} />
                        </Grid>
                    </Grid>
                ) : null}
            </Stack>
        </Container>
    );
}
