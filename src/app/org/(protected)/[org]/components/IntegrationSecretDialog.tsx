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

type IntegrationSecretDialogProps = {
    open: boolean;
    onClose: () => void;
    webhookSecret: string;
    cardHeaderSx: SxProps<Theme>;
    cardContentSx: SxProps<Theme>;
    dialogPaperSx: SxProps<Theme>;
    dialogActionsSx: SxProps<Theme>;
    alertSx: SxProps<Theme>;
};

export default function IntegrationSecretDialog({
    open,
    onClose,
    webhookSecret,
    cardHeaderSx,
    cardContentSx,
    dialogPaperSx,
    dialogActionsSx,
    alertSx,
}: IntegrationSecretDialogProps) {
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
            <DialogTitle sx={cardHeaderSx}>{t('org.integrations.webhook.title', 'Секрет вебхука')}</DialogTitle>
            <DialogContent dividers sx={cardContentSx}>
                <Stack spacing={2}>
                    <Alert severity="warning" sx={alertSx}>
                        {t(
                            'org.integrations.webhook.hint',
                            'Секрет показывается один раз. Сохраните его в безопасном месте.'
                        )}
                    </Alert>
                    <TextField
                        label={t('org.integrations.webhook.field', 'Webhook Secret')}
                        value={webhookSecret}
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
