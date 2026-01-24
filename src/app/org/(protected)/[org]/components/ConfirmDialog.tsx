import * as React from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useI18n } from '@/i18n/I18nProvider';

type ConfirmDialogProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    confirmColor?: 'error' | 'primary';
    loading?: boolean;
    cardHeaderSx: SxProps<Theme>;
    cardContentSx: SxProps<Theme>;
    dialogPaperSx: SxProps<Theme>;
    dialogActionsSx: SxProps<Theme>;
};

export default function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel,
    confirmColor = 'primary',
    loading = false,
    cardHeaderSx,
    cardContentSx,
    dialogPaperSx,
    dialogActionsSx,
}: ConfirmDialogProps) {
    const { t } = useI18n();
    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onClose}
            slotProps={{
                paper: {
                    sx: dialogPaperSx,
                },
            }}
        >
            <DialogTitle sx={cardHeaderSx}>
                {title}
            </DialogTitle>
            <DialogContent sx={cardContentSx}>
                <Typography variant="body2">
                    {description}
                </Typography>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose} disabled={loading}>
                    {t('common.cancel', 'Отмена')}
                </Button>
                <Button
                    color={confirmColor}
                    variant="contained"
                    onClick={onConfirm}
                    disabled={loading}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
