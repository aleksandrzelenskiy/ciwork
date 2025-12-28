import { Box, Typography } from '@mui/material';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel, normalizeStatusTitle } from '@/utils/statusLabels';

type ReportStatusPillProps = {
    status: string;
    label?: string;
};

export default function ReportStatusPill({ status, label }: ReportStatusPillProps) {
    const normalizedStatus = normalizeStatusTitle(status);
    const color = getStatusColor(normalizedStatus);
    const resolvedLabel = label ?? getStatusLabel(normalizedStatus);
    return (
        <Box
            sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.5,
                py: 0.5,
                borderRadius: 999,
                backgroundColor: color,
                color: '#fff',
                fontWeight: 600,
                letterSpacing: 0.2,
            }}
        >
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {resolvedLabel}
            </Typography>
        </Box>
    );
}
