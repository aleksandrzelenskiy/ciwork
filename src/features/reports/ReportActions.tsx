import { Box, Button, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useI18n } from '@/i18n/I18nProvider';

type ReportActionsProps = {
    status: string;
    canApprove: boolean;
    canUploadFix: boolean;
    canEdit: boolean;
    canSubmit?: boolean;
    submitLoading?: boolean;
    canDelete?: boolean;
    deleteLoading?: boolean;
    onApprove: () => void;
    onUploadFix: () => void;
    onEdit: () => void;
    onSubmit?: () => void;
    onDelete?: () => void;
};

export default function ReportActions({
    status,
    canApprove,
    canUploadFix,
    canEdit,
    canSubmit = false,
    submitLoading = false,
    canDelete = false,
    deleteLoading = false,
    onApprove,
    onUploadFix,
    onEdit,
    onSubmit,
    onDelete,
}: ReportActionsProps) {
    const { t } = useI18n();
    const showApprove = canApprove && status !== 'Agreed';
    const showFixUpload = canUploadFix && (status === 'Issues' || status === 'Fixed');
    const showEdit = canEdit && status !== 'Agreed';
    const showSubmit = canSubmit && showEdit && typeof onSubmit === 'function';
    const showDelete = canDelete && typeof onDelete === 'function';

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
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {t('reports.actions.title', 'Действия')}
                </Typography>
                {showEdit && (
                    <Button
                        variant="outlined"
                        startIcon={<EditOutlinedIcon />}
                        onClick={onEdit}
                        sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                        {t('reports.actions.edit', 'Редактировать')}
                    </Button>
                )}
                {showSubmit && (
                    <Button
                        variant="contained"
                        startIcon={<SendIcon />}
                        onClick={onSubmit}
                        disabled={submitLoading}
                        sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                        {submitLoading
                            ? t('reports.submit.loading', 'Отправка…')
                            : t('reports.submit.action', 'Отправить')}
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
                {showDelete && (
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={onDelete}
                        disabled={deleteLoading}
                        sx={{ textTransform: 'none', borderRadius: 999 }}
                    >
                        {deleteLoading
                            ? t('reports.actions.deleteLoading', 'Удаление…')
                            : t('reports.actions.delete', 'Удалить')}
                    </Button>
                )}
            </Stack>
        </Box>
    );
}
