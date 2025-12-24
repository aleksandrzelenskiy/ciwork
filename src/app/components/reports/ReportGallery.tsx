import { Box, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

type ReportGalleryProps = {
    title: string;
    photos: string[];
};

export default function ReportGallery({ title, photos }: ReportGalleryProps) {
    if (!photos.length) {
        return (
            <Box
                sx={{
                    borderRadius: 4,
                    border: '1px solid rgba(15,23,42,0.08)',
                    p: 3,
                    background: 'rgba(255,255,255,0.8)',
                }}
            >
                <Typography variant="subtitle1" fontWeight={600}>
                    {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Пока нет загруженных фото.
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                borderRadius: 4,
                border: '1px solid rgba(15,23,42,0.08)',
                p: 3,
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 24px 60px rgba(15,23,42,0.08)',
            }}
        >
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                {title}
            </Typography>
            <PhotoProvider>
                <Grid container spacing={1.5}>
                    {photos.map((photo, idx) => (
                        <Grid size={{ xs: 6, sm: 4, md: 3 }} key={`${photo}-${idx}`}>
                            <PhotoView src={photo}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={photo}
                                    alt={`Photo ${idx + 1}`}
                                    style={{
                                        width: '100%',
                                        aspectRatio: '1 / 1',
                                        objectFit: 'cover',
                                        borderRadius: '14px',
                                        cursor: 'pointer',
                                        boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                                    }}
                                />
                            </PhotoView>
                        </Grid>
                    ))}
                </Grid>
            </PhotoProvider>
        </Box>
    );
}
