import { Box, Typography, Stack } from '@mui/material';
import ReportStatusPill from '@/app/components/reports/ReportStatusPill';

type ReportHeaderProps = {
    taskId: string;
    taskName?: string | null;
    baseId: string;
    createdByName?: string | null;
    createdAt?: string;
    status: string;
};

export default function ReportHeader({
    taskId,
    taskName,
    baseId,
    createdByName,
    createdAt,
    status,
}: ReportHeaderProps) {
    return (
        <Stack spacing={1.5}>
            <Typography
                variant="overline"
                sx={{ letterSpacing: 2, color: 'rgba(15,23,42,0.55)' }}
            >
                Фотоотчет
            </Typography>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
            >
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {taskName || taskId}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.6)' }}>
                        Задача {taskId} · БС {baseId}
                    </Typography>
                </Box>
                <ReportStatusPill status={status} />
            </Stack>
            <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.65)' }}>
                Создан {createdAt || '—'} · {createdByName || 'Исполнитель'}
            </Typography>
        </Stack>
    );
}
