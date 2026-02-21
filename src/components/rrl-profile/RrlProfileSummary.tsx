'use client';

import React from 'react';
import { Alert, Box, Card, CardContent, Chip, Grid2 as Grid, Stack, Typography } from '@mui/material';
import type { RrlProfileCalculateResponse } from '@/lib/rrl/types';

type Props = {
    result: RrlProfileCalculateResponse;
    elevationProvider?: string;
};

const formatMeters = (value: number) => `${value.toFixed(2)} м`;
const formatKm = (value: number) => `${(value / 1000).toFixed(3)} км`;

export default function RrlProfileSummary({ result, elevationProvider }: Props) {
    const { summary } = result;

    return (
        <Card>
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
                        <Chip
                            color={summary.losOk ? 'success' : 'error'}
                            label={`LoS: ${summary.losOk ? 'OK' : 'Блокируется'}`}
                        />
                        <Chip
                            color={summary.fresnelOk ? 'success' : 'warning'}
                            label={`Fresnel 60%: ${summary.fresnelOk ? 'OK' : 'Нарушение'}`}
                        />
                        {elevationProvider ? (
                            <Chip variant='outlined' color='info' label={`DEM: ${elevationProvider}`} />
                        ) : null}
                    </Stack>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Box>
                                <Typography variant='caption' color='text.secondary'>Длина трассы</Typography>
                                <Typography variant='h6'>{formatKm(summary.distanceMeters)}</Typography>
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Box>
                                <Typography variant='caption' color='text.secondary'>Мин. клиренс до рельефа</Typography>
                                <Typography variant='h6'>{formatMeters(summary.minClearance)}</Typography>
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Box>
                                <Typography variant='caption' color='text.secondary'>Мин. клиренс по 60% Френеля</Typography>
                                <Typography variant='h6'>{formatMeters(summary.minClearance60)}</Typography>
                            </Box>
                        </Grid>
                    </Grid>

                    <Alert severity={summary.fresnelOk ? 'success' : 'warning'}>
                        Критическая точка: {formatKm(summary.criticalPoint.distanceMeters)} | lat {summary.criticalPoint.lat.toFixed(6)} | lon {summary.criticalPoint.lon.toFixed(6)}
                    </Alert>

                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant='caption' color='text.secondary'>Рекомендация: поднять только A</Typography>
                            <Typography variant='body1'>{formatMeters(summary.recommendedLift.onlyA)}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant='caption' color='text.secondary'>Рекомендация: поднять только B</Typography>
                            <Typography variant='body1'>{formatMeters(summary.recommendedLift.onlyB)}</Typography>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Typography variant='caption' color='text.secondary'>Рекомендация: поднять обе мачты одинаково</Typography>
                            <Typography variant='body1'>{formatMeters(summary.recommendedLift.bothEqual)}</Typography>
                        </Grid>
                    </Grid>
                </Stack>
            </CardContent>
        </Card>
    );
}
