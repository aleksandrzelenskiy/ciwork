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
            <DialogTitle sx={cardHeaderSx}>Ключ интеграции</DialogTitle>
            <DialogContent dividers sx={cardContentSx}>
                <Stack spacing={2}>
                    <Alert severity="warning" sx={alertSx}>
                        Ключ показывается один раз. Сохраните его в безопасном месте.
                    </Alert>
                    <TextField
                        label="Key ID"
                        value={keyId}
                        fullWidth
                        InputProps={{ readOnly: true }}
                    />
                    <TextField
                        label="Key Secret"
                        value={keySecret}
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
