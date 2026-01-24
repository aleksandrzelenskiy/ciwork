import * as React from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useI18n } from '@/i18n/I18nProvider';

type IntegrationKeyDialogProps = {
    open: boolean;
    onClose: () => void;
    keyId: string;
    keySecret: string;
    cardHeaderSx: SxProps<Theme>;
    cardContentSx: SxProps<Theme>;
    dialogPaperSx: SxProps<Theme>;
    dialogActionsSx: SxProps<Theme>;
    alertSx: SxProps<Theme>;
};

export default function IntegrationKeyDialog({
    open,
    onClose,
    keyId,
    keySecret,
    cardHeaderSx,
    cardContentSx,
    dialogPaperSx,
    dialogActionsSx,
    alertSx,
}: IntegrationKeyDialogProps) {
    const { t } = useI18n();
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: dialogPaperSx,
                },
            }}
        >
            <DialogTitle sx={cardHeaderSx}>{t('org.integrations.key.title', 'Ключ интеграции')}</DialogTitle>
            <DialogContent dividers sx={cardContentSx}>
                <Stack spacing={2}>
                    <Alert severity="warning" sx={alertSx}>
                        {t(
                            'org.integrations.key.hint',
                            'Ключ показывается один раз. Сохраните его в безопасном месте.'
                        )}
                    </Alert>
                    <TextField
                        label={t('org.integrations.key.id', 'Key ID')}
                        value={keyId}
                        fullWidth
                        InputProps={{ readOnly: true }}
                    />
                    <TextField
                        label={t('org.integrations.key.secret', 'Key Secret')}
                        value={keySecret}
                        fullWidth
                        InputProps={{ readOnly: true }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose}>{t('common.close', 'Закрыть')}</Button>
            </DialogActions>
        </Dialog>
    );
}
