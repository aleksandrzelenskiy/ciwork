// src/app/workspace/components/TaskGeoLocation.tsx
'use client';

import * as React from 'react';
import {
    Box,
    Typography,
    Stack,
    Divider,
    Dialog,
    AppBar,
    Toolbar,
    IconButton,
} from '@mui/material';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CloseIcon from '@mui/icons-material/Close';
import {
    YMaps,
    Map,
    Placemark,
    FullscreenControl,
    TypeSelector,
    ZoomControl,
    GeolocationControl,
    SearchControl,
} from '@pbe/react-yandex-maps';
import { useI18n } from '@/i18n/I18nProvider';

export type TaskGeoLocationProps = {
    locations?: Array<{
        name?: string;
        coordinates: string;
    }>;
};

const parseCoords = (s?: string): [number, number] | null => {
    if (!s) return null;
    const parts = s.trim().split(/[ ,;]+/).map(Number).filter((n) => !Number.isNaN(n));
    if (parts.length >= 2) return [parts[0], parts[1]] as [number, number];
    return null;
};

export default function TaskGeoLocation({ locations = [] }: TaskGeoLocationProps) {
    const { t, locale } = useI18n();
    const [mapOpen, setMapOpen] = React.useState(false);
    const [selectedPoint, setSelectedPoint] = React.useState<{
        coords: [number, number];
        title: string;
    } | null>(null);
    const [activeLocationMeta, setActiveLocationMeta] = React.useState<{
        name?: string;
        coordinates: string;
    } | null>(null);

    const handleOpen = (loc: { name?: string; coordinates: string }, idx: number) => {
        const coords = parseCoords(loc.coordinates);
        if (!coords) return;
        setSelectedPoint({
            coords,
            title: loc.name || t('task.geo.point', 'Точка {index}', { index: idx + 1 }),
        });
        setActiveLocationMeta(loc);
        setMapOpen(true);
    };

    const buildBalloonContent = (loc: { name?: string; coordinates: string }) => {
        const coords = parseCoords(loc.coordinates);
        const coordString =
            coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
                ? `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`
                : loc.coordinates;

        const title = loc.name || t('task.geo.pointTitle', 'Точка');
        const routeUrl =
            coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
                ? `https://yandex.ru/maps/?rtext=~${coords[0]},${coords[1]}&rtt=auto`
                : null;
        return `<div style="font-family:Inter,Arial,sans-serif;min-width:220px;max-width:260px;">
            <div style="font-weight:600;margin-bottom:6px;">${title}</div>
            <div style="margin-bottom:4px;">${t('task.geo.coordinates', 'Координаты')}: ${coordString || '—'}</div>
            ${
                routeUrl
                    ? `<a href="${routeUrl}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:6px;color:#1976d2;text-decoration:none;font-weight:600;margin-top:6px;">${t('task.geo.route', 'Маршрут')} <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#1976d2" viewBox="0 0 24 24"><path d="m9 6 2-4 2 4 4 .5-3 3.3.8 4.2L12 12.7l-3.8 1.3.8-4.2-3-3.3z"/></svg></span></a>`
                    : ''
            }
        </div>`;
    };

    const mapState = selectedPoint
        ? {
              center: selectedPoint.coords,
              zoom: 14,
              type: 'yandex#hybrid' as const,
              controls: [] as string[],
          }
        : {
              center: [55.751244, 37.618423] as [number, number],
              zoom: 4,
              type: 'yandex#map' as const,
              controls: [] as string[],
          };

    return (
        <Box sx={{ lineHeight: 1.6 }}>
            <Typography
                variant="body1"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1, lineHeight: 1.6 }}
            >
                <LocationOnOutlinedIcon fontSize="small" />
                {t('task.sections.geo', 'Геолокация')}
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            {locations.length > 0 ? (
                <Stack gap={1}>
                    {locations.map((loc, idx) => (
                        <Box key={idx}>
                            <Typography variant="body1" sx={{ fontWeight: 500, lineHeight: 1.6 }}>
                                {loc.name || t('task.geo.point', 'Точка {index}', { index: idx + 1 })}
                            </Typography>
                            <Typography
                                variant="body1"
                                color="primary"
                                sx={{ cursor: 'pointer', lineHeight: 1.6 }}
                                onClick={() => handleOpen(loc, idx)}
                            >
                                {loc.coordinates}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            ) : (
                <Typography color="text.secondary" variant="body1" sx={{ lineHeight: 1.6 }}>
                    {t('task.geo.empty', 'Геоданных нет')}
                </Typography>
            )}

            <Dialog fullScreen open={mapOpen} onClose={() => setMapOpen(false)}>
                <AppBar sx={{ position: 'relative' }}>
                    <Toolbar>
                        <IconButton
                            edge="start"
                            color="inherit"
                            onClick={() => setMapOpen(false)}
                            aria-label={t('common.close', 'Закрыть')}
                        >
                            <CloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                            {selectedPoint?.title ?? t('task.geo.map', 'Карта')}
                        </Typography>
                    </Toolbar>
                </AppBar>
                <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
                    <YMaps
                        query={{
                            apikey: '1c3860d8-3994-4e6e-841b-31ad57f69c78',
                            lang: locale === 'ru' ? 'ru_RU' : 'en_US',
                        }}
                    >
                        <Map
                            state={mapState}
                            width="100%"
                            height="100%"
                            modules={[
                                'control.ZoomControl',
                                'control.TypeSelector',
                                'control.FullscreenControl',
                                'control.GeolocationControl',
                                'control.SearchControl',
                                'geoObject.addon.balloon',
                            ]}
                        >
                            <ZoomControl />
                            <TypeSelector />
                            <GeolocationControl />
                            <SearchControl />
                            {selectedPoint && (
                                <Placemark
                                    geometry={selectedPoint.coords}
                                    properties={{
                                        balloonContent: buildBalloonContent(
                                            activeLocationMeta || {
                                                name: selectedPoint.title,
                                                coordinates: selectedPoint.coords.join(', '),
                                            }
                                        ),
                                        hintContent: selectedPoint.title,
                                        iconCaption: selectedPoint.title,
                                    }}
                                    options={{
                                        preset: 'islands#redIcon',
                                        iconColor: '#ef4444',
                                        hideIconOnBalloonOpen: false,
                                    }}
                                    modules={['geoObject.addon.balloon', 'geoObject.addon.hint']}
                                />
                            )}
                            <FullscreenControl />
                        </Map>
                    </YMaps>
                </Box>
            </Dialog>
        </Box>
    );
}
