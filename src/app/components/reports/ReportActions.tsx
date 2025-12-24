import { Box, Button, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

type ReportActionsProps = {
    status: string;
    canApprove: boolean;
    canUploadFix: boolean;
    onApprove: () => void;
    onUploadFix: () => void;
};

export default function ReportActions({
    status,
    canApprove,
    canUploadFix,
    onApprove,
    onUploadFix,
}: ReportActionsProps) {
    const showApprove = canApprove && status !== 'Agreed';
    const showFixUpload = canUploadFix && (status === 'Issues' || status === 'Fixed');

    return (
        <Box
            sx={{
                borderRadius: 4,
                border: '1px solid rgba(15,23,42,0.08)',
                p: 3,
                background: 'rgba(255,255,255,0.95)',
            }}
        >
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Действия
            </Typography>
            <Stack spacing={1.5}>
                {showApprove && (
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleIcon />}
                        onClick={onApprove}
                        sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                        Согласовать
                    </Button>
                )}
                {showFixUpload && (
                    <Button
                        variant="contained"
                        startIcon={<CloudUploadIcon />}
                        onClick={onUploadFix}
                        sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                        Загрузить исправления
                    </Button>
                )}
            </Stack>
        </Box>
    );
}
