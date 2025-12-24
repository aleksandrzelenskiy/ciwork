import { Box, Typography } from '@mui/material';
import { getStatusColor } from '@/utils/statusColors';

type ReportStatusPillProps = {
    status: string;
    label?: string;
};

export default function ReportStatusPill({ status, label }: ReportStatusPillProps) {
    const color = getStatusColor(status);
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
                {label ?? status}
            </Typography>
        </Box>
    );
}
