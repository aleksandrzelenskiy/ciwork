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
            <DialogTitle sx={cardHeaderSx}>Секрет вебхука</DialogTitle>
            <DialogContent dividers sx={cardContentSx}>
                <Stack spacing={2}>
                    <Alert severity="warning" sx={alertSx}>
                        Секрет показывается один раз. Сохраните его в безопасном месте.
                    </Alert>
                    <TextField
                        label="Webhook Secret"
                        value={webhookSecret}
                        fullWidth
                        InputProps={{ readOnly: true }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
}
