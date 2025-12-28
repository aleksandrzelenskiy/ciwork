import { Box, Button, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

type ReportActionsProps = {
    status: string;
    canApprove: boolean;
    canUploadFix: boolean;
    canEdit: boolean;
    onApprove: () => void;
    onUploadFix: () => void;
    onEdit: () => void;
};

export default function ReportActions({
    status,
    canApprove,
    canUploadFix,
    canEdit,
    onApprove,
    onUploadFix,
    onEdit,
}: ReportActionsProps) {
    const showApprove = canApprove && status !== 'Agreed';
    const showFixUpload = canUploadFix && (status === 'Issues' || status === 'Fixed');
    const showEdit = canEdit && status !== 'Agreed';

    return (
        <Box
            sx={{
                borderRadius: 4,
                border: '1px solid rgba(15,23,42,0.08)',
                p: 3,
                background: 'rgba(255,255,255,0.95)',
            }}
        >
            <Stack spacing={1.5}>
                {showEdit && (
                    <Button
                        variant="contained"
                        startIcon={<EditOutlinedIcon />}
                        onClick={onEdit}
                        sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                        Редактировать
                    </Button>
                )}
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
