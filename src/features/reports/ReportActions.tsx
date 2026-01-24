import { Box, Button, Stack } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useI18n } from '@/i18n/I18nProvider';

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
    const { t } = useI18n();
    const showApprove = canApprove && status !== 'Agreed';
    const showFixUpload = canUploadFix && (status === 'Issues' || status === 'Fixed');
    const showEdit = canEdit && status !== 'Agreed';

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
                        ? 'rgba(15,18,26,0.94)'
                        : 'rgba(255,255,255,0.95)',
            })}
        >
            <Stack spacing={1.5}>
                {showEdit && (
                    <Button
                        variant="contained"
                        startIcon={<EditOutlinedIcon />}
                        onClick={onEdit}
                        sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                        {t('reports.actions.edit', 'Редактировать')}
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
                        {t('reports.actions.approve', 'Согласовать')}
                    </Button>
                )}
                {showFixUpload && (
                    <Button
                        variant="contained"
                        startIcon={<CloudUploadIcon />}
                        onClick={onUploadFix}
                        sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                        {t('reports.actions.uploadFix', 'Загрузить исправления')}
                    </Button>
                )}
            </Stack>
        </Box>
    );
}
