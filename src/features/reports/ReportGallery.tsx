import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { useI18n } from '@/i18n/I18nProvider';

type ReportGalleryProps = {
    title: string;
    photos: string[];
};

export default function ReportGallery({ title, photos }: ReportGalleryProps) {
    const { t } = useI18n();
    if (!photos.length) {
        return (
            <Box
                sx={(theme) => ({
                    borderRadius: 4,
                    border:
                        theme.palette.mode === 'dark'
                            ? '1px solid rgba(148,163,184,0.18)'
                            : '1px solid rgba(15,23,42,0.08)',
                    p: 3,
                    background:
                        theme.palette.mode === 'dark'
                            ? 'rgba(15,18,26,0.9)'
                            : 'rgba(255,255,255,0.8)',
                })}
            >
                <Typography variant="subtitle1" fontWeight={600}>
                    {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t('reports.gallery.empty', 'Пока нет загруженных фото.')}
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={(theme) => ({
                borderRadius: 4,
                border:
                    theme.palette.mode === 'dark'
                        ? '1px solid rgba(148,163,184,0.18)'
                        : '1px solid rgba(15,23,42,0.08)',
                p: 3,
                background:
                    theme.palette.mode === 'dark'
                        ? 'rgba(15,18,26,0.92)'
                        : 'rgba(255,255,255,0.9)',
                boxShadow:
                    theme.palette.mode === 'dark'
                        ? '0 24px 60px rgba(0,0,0,0.55)'
                        : '0 24px 60px rgba(15,23,42,0.08)',
            })}
        >
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                {title}
            </Typography>
            <PhotoProvider>
                <Grid container spacing={1.5}>
                    {photos.map((photo, idx) => (
                        <Grid size={{ xs: 6, sm: 4, md: 3 }} key={`${photo}-${idx}`}>
                            <PhotoView src={photo}>
                                <Box
                                    component="img"
                                    src={photo}
                                    alt={t('reports.gallery.photoAlt', 'Фото {index}', { index: idx + 1 })}
                                    sx={(theme) => ({
                                        width: '100%',
                                        aspectRatio: '1 / 1',
                                        objectFit: 'cover',
                                        borderRadius: '14px',
                                        cursor: 'pointer',
                                        boxShadow:
                                            theme.palette.mode === 'dark'
                                                ? '0 10px 30px rgba(0,0,0,0.4)'
                                                : '0 10px 30px rgba(15,23,42,0.12)',
                                    })}
                                />
                            </PhotoView>
                        </Grid>
                    ))}
                </Grid>
            </PhotoProvider>
        </Box>
    );
}
