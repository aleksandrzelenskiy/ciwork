import React from 'react';
import NextLink from 'next/link';
import {
    Button,
    Card,
    CardActions,
    CardContent,
    Chip,
    Container,
    Grid2 as Grid,
    Stack,
    Typography,
} from '@mui/material';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';

export default function ServicesPage() {
    return (
        <Container maxWidth='lg' sx={{ py: { xs: 2, md: 4 } }}>
            <Stack spacing={2.5}>
                <div>
                    <Typography variant='h4'>Инструменты</Typography>
                    <Typography color='text.secondary'>Внутренние инженерные сервисы платформы</Typography>
                </div>

                <Grid container spacing={2.5}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Stack spacing={1.5}>
                                    <Stack direction='row' spacing={1} alignItems='center'>
                                        <SettingsInputAntennaIcon color='primary' />
                                        <Typography variant='h6'>Проверка профиля РРЛ</Typography>
                                    </Stack>
                                    <Typography color='text.secondary'>
                                        Расчет профиля трассы, LoS, 1-й зоны Френеля (60%), влияния k-factor и рекомендации по высоте мачт.
                                    </Typography>
                                    <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
                                        <Chip label='LoS' size='small' />
                                        <Chip label='Fresnel 60%' size='small' />
                                        <Chip label='k-factor' size='small' />
                                        <Chip label='DEM profile' size='small' />
                                    </Stack>
                                </Stack>
                            </CardContent>
                            <CardActions sx={{ px: 2, pb: 2 }}>
                                <Button component={NextLink} href='/services/rrl-profile' variant='contained'>
                                    Открыть инструмент
                                </Button>
                            </CardActions>
                        </Card>
                    </Grid>
                </Grid>
            </Stack>
        </Container>
    );
}
