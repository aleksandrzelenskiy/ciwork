'use client';

import React, { useMemo } from 'react';
import { Box, Card, CardContent, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { RrlProfileCalculateResponse } from '@/lib/rrl/types';

type XUnit = 'm' | 'km';

type Props = {
    result: RrlProfileCalculateResponse;
    xUnit: XUnit;
    onXUnitChange: (next: XUnit) => void;
};

type ChartPoint = RrlProfileCalculateResponse['samples'][number] & {
    xAxisValue: number;
};

const formatAxisX = (value: number, xUnit: XUnit) => (xUnit === 'km' ? `${value.toFixed(2)} км` : `${value.toFixed(0)} м`);

export default function RrlProfileChart({ result, xUnit, onXUnitChange }: Props) {
    const data = useMemo<ChartPoint[]>(() => {
        const divider = xUnit === 'km' ? 1000 : 1;
        return result.samples.map((sample) => ({
            ...sample,
            xAxisValue: sample.distanceMeters / divider,
        }));
    }, [result.samples, xUnit]);

    const criticalX = xUnit === 'km'
        ? result.summary.criticalPoint.distanceMeters / 1000
        : result.summary.criticalPoint.distanceMeters;

    return (
        <Card>
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' alignItems={{ xs: 'flex-start', sm: 'center' }}>
                        <Typography variant='h6'>Профиль трассы</Typography>
                        <RadioGroup
                            row
                            value={xUnit}
                            onChange={(event) => onXUnitChange(event.target.value as XUnit)}
                        >
                            <FormControlLabel value='m' control={<Radio size='small' />} label='Ось X: метры' />
                            <FormControlLabel value='km' control={<Radio size='small' />} label='Ось X: километры' />
                        </RadioGroup>
                    </Stack>

                    <Box sx={{ width: '100%', height: 420 }}>
                        <ResponsiveContainer>
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray='3 3' />
                                <XAxis
                                    dataKey='xAxisValue'
                                    tickFormatter={(value) => formatAxisX(Number(value), xUnit)}
                                />
                                <YAxis unit=' м' />
                                <Tooltip
                                    formatter={(value: number, name) => {
                                        const labels: Record<string, string> = {
                                            terrain: 'Рельеф',
                                            terrainEff: 'Рельеф + выпуклость',
                                            los: 'LoS',
                                            fresnelLimitLine: 'Граница 60% Френеля',
                                            fresnelR1: 'F1',
                                            clearance60: 'Клиренс 60%',
                                        };

                                        return [`${Number(value).toFixed(2)} м`, labels[name] ?? name];
                                    }}
                                    labelFormatter={(labelValue, payload) => {
                                        const point = payload?.[0]?.payload as ChartPoint | undefined;
                                        if (!point) {
                                            return String(labelValue);
                                        }

                                        return `${formatAxisX(point.xAxisValue, xUnit)} | lat ${point.lat.toFixed(5)}, lon ${point.lon.toFixed(5)}`;
                                    }}
                                />
                                <Legend />

                                <ReferenceLine x={criticalX} stroke='#d32f2f' strokeDasharray='5 5' label='Critical' />

                                <Line type='monotone' dataKey='terrain' stroke='#5d4037' dot={false} strokeWidth={2} name='terrain' />
                                <Line type='monotone' dataKey='terrainEff' stroke='#8d6e63' dot={false} strokeWidth={2} name='terrainEff' />
                                <Line type='monotone' dataKey='los' stroke='#1e88e5' dot={false} strokeWidth={2} name='los' />
                                <Line type='monotone' dataKey='fresnelLimitLine' stroke='#2e7d32' dot={false} strokeWidth={2} name='fresnelLimitLine' />
                            </LineChart>
                        </ResponsiveContainer>
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    );
}
