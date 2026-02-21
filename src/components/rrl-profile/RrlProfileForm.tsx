'use client';

import React, { useMemo, useState } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
    Alert,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    FormControl,
    Grid2 as Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';

export type CoordinateMode = 'dd' | 'dms';

export type RrlProfileFormValues = {
    aName: string;
    aLat: string;
    aLon: string;
    bName: string;
    bLat: string;
    bLon: string;
    antennaA: string;
    antennaB: string;
    freqGHz: string;
    kFactor: string;
    stepMeters: string;
};

export type RrlProfileFormErrors = Partial<Record<keyof RrlProfileFormValues, string>>;

type DmsCoordinate = {
    deg: string;
    min: string;
    sec: string;
    hem: 'N' | 'S' | 'E' | 'W';
};

type Props = {
    values: RrlProfileFormValues;
    errors: RrlProfileFormErrors;
    loading: boolean;
    coordinateMode: CoordinateMode;
    onCoordinateModeChange: (value: CoordinateMode) => void;
    onChange: (field: keyof RrlProfileFormValues, value: string) => void;
    onSubmit: () => void;
    onReset: () => void;
    onFillExample: () => void;
    onPresetK: (value: number) => void;
};

const defaultDms: DmsCoordinate = {
    deg: '',
    min: '',
    sec: '',
    hem: 'N',
};

const decimalToDms = (decimal: number, isLat: boolean): DmsCoordinate => {
    const abs = Math.abs(decimal);
    const deg = Math.floor(abs);
    const rem = (abs - deg) * 60;
    const min = Math.floor(rem);
    const sec = (rem - min) * 60;

    const hem = isLat
        ? decimal < 0
            ? 'S'
            : 'N'
        : decimal < 0
            ? 'W'
            : 'E';

    return {
        deg: String(deg),
        min: String(min),
        sec: sec.toFixed(4),
        hem,
    };
};

const dmsToDecimal = (dms: DmsCoordinate): number => {
    const deg = Number(dms.deg);
    const min = Number(dms.min);
    const sec = Number(dms.sec);

    if ([deg, min, sec].some((value) => Number.isNaN(value))) {
        return Number.NaN;
    }

    const value = deg + min / 60 + sec / 3600;
    const sign = dms.hem === 'S' || dms.hem === 'W' ? -1 : 1;
    return sign * value;
};

export default function RrlProfileForm({
    values,
    errors,
    loading,
    coordinateMode,
    onCoordinateModeChange,
    onChange,
    onSubmit,
    onReset,
    onFillExample,
    onPresetK,
}: Props) {
    const [aLatDms, setALatDms] = useState<DmsCoordinate>(defaultDms);
    const [aLonDms, setALonDms] = useState<DmsCoordinate>({ ...defaultDms, hem: 'E' });
    const [bLatDms, setBLatDms] = useState<DmsCoordinate>(defaultDms);
    const [bLonDms, setBLonDms] = useState<DmsCoordinate>({ ...defaultDms, hem: 'E' });

    const isDmsMode = coordinateMode === 'dms';

    const canConvertDms = useMemo(() => {
        if (!isDmsMode) {
            return false;
        }

        const valuesToCheck = [
            dmsToDecimal(aLatDms),
            dmsToDecimal(aLonDms),
            dmsToDecimal(bLatDms),
            dmsToDecimal(bLonDms),
        ];

        return valuesToCheck.every((value) => Number.isFinite(value));
    }, [aLatDms, aLonDms, bLatDms, bLonDms, isDmsMode]);

    const syncDmsFromDecimal = () => {
        const aLat = Number(values.aLat);
        const aLon = Number(values.aLon);
        const bLat = Number(values.bLat);
        const bLon = Number(values.bLon);

        if (Number.isFinite(aLat)) setALatDms(decimalToDms(aLat, true));
        if (Number.isFinite(aLon)) setALonDms(decimalToDms(aLon, false));
        if (Number.isFinite(bLat)) setBLatDms(decimalToDms(bLat, true));
        if (Number.isFinite(bLon)) setBLonDms(decimalToDms(bLon, false));
    };

    const applyDmsToDecimal = () => {
        onChange('aLat', dmsToDecimal(aLatDms).toFixed(6));
        onChange('aLon', dmsToDecimal(aLonDms).toFixed(6));
        onChange('bLat', dmsToDecimal(bLatDms).toFixed(6));
        onChange('bLon', dmsToDecimal(bLonDms).toFixed(6));
    };

    return (
        <Card>
            <CardContent>
                <Stack spacing={2.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' gap={1.5}>
                        <Typography variant='h6'>Параметры пролёта РРЛ</Typography>
                        <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
                            <Button variant='text' onClick={onFillExample}>Пример</Button>
                            <Button variant='text' onClick={onReset}>Сбросить</Button>
                        </Stack>
                    </Stack>

                    <Stack direction='row' spacing={1} alignItems='center'>
                        <FormControl size='small' sx={{ minWidth: 220 }}>
                            <InputLabel id='coord-mode-label'>Формат координат</InputLabel>
                            <Select
                                labelId='coord-mode-label'
                                label='Формат координат'
                                value={coordinateMode}
                                onChange={(event) => {
                                    const next = event.target.value as CoordinateMode;
                                    onCoordinateModeChange(next);
                                    if (next === 'dms') {
                                        syncDmsFromDecimal();
                                    }
                                }}
                            >
                                <MenuItem value='dd'>Decimal Degrees</MenuItem>
                                <MenuItem value='dms'>DMS</MenuItem>
                            </Select>
                        </FormControl>

                        {isDmsMode ? (
                            <Button variant='outlined' size='small' onClick={applyDmsToDecimal} disabled={!canConvertDms}>
                                Конвертировать DMS в Decimal
                            </Button>
                        ) : null}
                    </Stack>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Stack spacing={1.2}>
                                <Typography variant='subtitle1'>Точка A</Typography>
                                <TextField
                                    label='Имя точки A'
                                    value={values.aName}
                                    onChange={(event) => onChange('aName', event.target.value)}
                                    size='small'
                                    fullWidth
                                />

                                {isDmsMode ? (
                                    <DmsEditor
                                        title='Координаты A (DMS)'
                                        lat={aLatDms}
                                        lon={aLonDms}
                                        onLatChange={setALatDms}
                                        onLonChange={setALonDms}
                                    />
                                ) : (
                                    <>
                                        <TextField
                                            label='Latitude A'
                                            value={values.aLat}
                                            onChange={(event) => onChange('aLat', event.target.value)}
                                            size='small'
                                            fullWidth
                                            error={Boolean(errors.aLat)}
                                            helperText={errors.aLat}
                                        />
                                        <TextField
                                            label='Longitude A'
                                            value={values.aLon}
                                            onChange={(event) => onChange('aLon', event.target.value)}
                                            size='small'
                                            fullWidth
                                            error={Boolean(errors.aLon)}
                                            helperText={errors.aLon}
                                        />
                                    </>
                                )}

                                <TextField
                                    label='Высота антенны A, м (AGL)'
                                    value={values.antennaA}
                                    onChange={(event) => onChange('antennaA', event.target.value)}
                                    size='small'
                                    fullWidth
                                    error={Boolean(errors.antennaA)}
                                    helperText={errors.antennaA}
                                />
                            </Stack>
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                            <Stack spacing={1.2}>
                                <Typography variant='subtitle1'>Точка B</Typography>
                                <TextField
                                    label='Имя точки B'
                                    value={values.bName}
                                    onChange={(event) => onChange('bName', event.target.value)}
                                    size='small'
                                    fullWidth
                                />

                                {isDmsMode ? (
                                    <DmsEditor
                                        title='Координаты B (DMS)'
                                        lat={bLatDms}
                                        lon={bLonDms}
                                        onLatChange={setBLatDms}
                                        onLonChange={setBLonDms}
                                    />
                                ) : (
                                    <>
                                        <TextField
                                            label='Latitude B'
                                            value={values.bLat}
                                            onChange={(event) => onChange('bLat', event.target.value)}
                                            size='small'
                                            fullWidth
                                            error={Boolean(errors.bLat)}
                                            helperText={errors.bLat}
                                        />
                                        <TextField
                                            label='Longitude B'
                                            value={values.bLon}
                                            onChange={(event) => onChange('bLon', event.target.value)}
                                            size='small'
                                            fullWidth
                                            error={Boolean(errors.bLon)}
                                            helperText={errors.bLon}
                                        />
                                    </>
                                )}

                                <TextField
                                    label='Высота антенны B, м (AGL)'
                                    value={values.antennaB}
                                    onChange={(event) => onChange('antennaB', event.target.value)}
                                    size='small'
                                    fullWidth
                                    error={Boolean(errors.antennaB)}
                                    helperText={errors.antennaB}
                                />
                            </Stack>
                        </Grid>
                    </Grid>

                    <Divider />

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <TextField
                                label='Частота, ГГц'
                                value={values.freqGHz}
                                onChange={(event) => onChange('freqGHz', event.target.value)}
                                size='small'
                                fullWidth
                                error={Boolean(errors.freqGHz)}
                                helperText={errors.freqGHz}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Stack spacing={0.5}>
                                <Stack direction='row' alignItems='center' spacing={0.5}>
                                    <Typography variant='caption' color='text.secondary'>
                                        Коэффициент рефракции k
                                    </Typography>
                                    <Tooltip title='Эффективный радиус Земли = k * 6371000. Типовое значение для нормальной рефракции: 1.33'>
                                        <IconButton size='small'>
                                            <InfoOutlinedIcon fontSize='inherit' />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                                <TextField
                                    value={values.kFactor}
                                    onChange={(event) => onChange('kFactor', event.target.value)}
                                    size='small'
                                    fullWidth
                                    error={Boolean(errors.kFactor)}
                                    helperText={errors.kFactor}
                                />
                            </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Stack spacing={0.5}>
                                <Stack direction='row' alignItems='center' spacing={0.5}>
                                    <Typography variant='caption' color='text.secondary'>
                                        Шаг дискретизации, м
                                    </Typography>
                                    <Tooltip title='Чем меньше шаг, тем точнее профиль и выше нагрузка на API высот.'>
                                        <IconButton size='small'>
                                            <InfoOutlinedIcon fontSize='inherit' />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                                <TextField
                                    value={values.stepMeters}
                                    onChange={(event) => onChange('stepMeters', event.target.value)}
                                    size='small'
                                    fullWidth
                                    error={Boolean(errors.stepMeters)}
                                    helperText={errors.stepMeters}
                                />
                            </Stack>
                        </Grid>
                    </Grid>

                    <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap' alignItems='center'>
                        <Typography variant='body2' color='text.secondary'>Сценарии k:</Typography>
                        {[1.33, 1.0, 0.67].map((scenario) => (
                            <Chip
                                key={scenario}
                                label={`k=${scenario}`}
                                color={Number(values.kFactor) === scenario ? 'primary' : 'default'}
                                onClick={() => onPresetK(scenario)}
                            />
                        ))}
                        <Tooltip title='Критерий прохождения: клиренс не ниже 0.6 * F1 по всей трассе.'>
                            <Chip label='Что такое 60% Френеля?' variant='outlined' />
                        </Tooltip>
                    </Stack>

                    <Alert severity='info'>
                        Примечание: DEM-профиль не учитывает новые здания/мачты и локальные препятствия. Данные SRTM/Copernicus/ASTER имеют ограниченную точность.
                    </Alert>

                    <Stack direction='row' spacing={1.2}>
                        <Button variant='contained' onClick={onSubmit} disabled={loading}>
                            Рассчитать
                        </Button>
                        <Button variant='outlined' onClick={onReset} disabled={loading}>
                            Сбросить
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

type DmsEditorProps = {
    title: string;
    lat: DmsCoordinate;
    lon: DmsCoordinate;
    onLatChange: React.Dispatch<React.SetStateAction<DmsCoordinate>>;
    onLonChange: React.Dispatch<React.SetStateAction<DmsCoordinate>>;
};

function DmsEditor({ title, lat, lon, onLatChange, onLonChange }: DmsEditorProps) {
    return (
        <Stack spacing={1}>
            <Typography variant='caption' color='text.secondary'>{title}</Typography>
            <DmsRow label='Lat' value={lat} onChange={onLatChange} hemispheres={['N', 'S']} />
            <DmsRow label='Lon' value={lon} onChange={onLonChange} hemispheres={['E', 'W']} />
        </Stack>
    );
}

type DmsRowProps = {
    label: string;
    value: DmsCoordinate;
    onChange: React.Dispatch<React.SetStateAction<DmsCoordinate>>;
    hemispheres: Array<'N' | 'S'> | Array<'E' | 'W'>;
};

function DmsRow({ label, value, onChange, hemispheres }: DmsRowProps) {
    return (
        <Grid container spacing={1} alignItems='center'>
            <Grid size={1.2}>
                <Typography variant='body2'>{label}</Typography>
            </Grid>
            <Grid size={3.4}>
                <TextField
                    size='small'
                    label='°'
                    value={value.deg}
                    onChange={(event) => onChange((prev) => ({ ...prev, deg: event.target.value }))}
                    fullWidth
                />
            </Grid>
            <Grid size={3.4}>
                <TextField
                    size='small'
                    label='′'
                    value={value.min}
                    onChange={(event) => onChange((prev) => ({ ...prev, min: event.target.value }))}
                    fullWidth
                />
            </Grid>
            <Grid size={3.4}>
                <TextField
                    size='small'
                    label='″'
                    value={value.sec}
                    onChange={(event) => onChange((prev) => ({ ...prev, sec: event.target.value }))}
                    fullWidth
                />
            </Grid>
            <Grid size={0.6}>
                <FormControl size='small' fullWidth>
                    <Select
                        value={value.hem}
                        onChange={(event) => onChange((prev) => ({ ...prev, hem: event.target.value as DmsCoordinate['hem'] }))}
                    >
                        {hemispheres.map((hem) => (
                            <MenuItem key={hem} value={hem}>{hem}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Grid>
        </Grid>
    );
}
