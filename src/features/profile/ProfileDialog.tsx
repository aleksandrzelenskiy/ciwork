'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import ProfilePageContent from '@/app/profile/ProfilePageContent';

type ProfileDialogProps = {
    open: boolean;
    onClose: () => void;
    clerkUserId?: string | null;
    mode?: 'self' | 'public';
};

export default function ProfileDialog({
    open,
    onClose,
    clerkUserId,
    mode = 'public',
}: ProfileDialogProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [forceFullScreen, setForceFullScreen] = React.useState(false);
    const fullScreen = isMobile || forceFullScreen;
    const handleClose = React.useCallback(() => {
        setForceFullScreen(false);
        onClose();
    }, [onClose]);

    React.useEffect(() => {
        if (!open) return;
        const handleMessengerOpen = () => {
            handleClose();
        };
        window.addEventListener('messenger:open', handleMessengerOpen);
        return () => {
            window.removeEventListener('messenger:open', handleMessengerOpen);
        };
    }, [open, handleClose]);

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            fullWidth
            maxWidth="md"
            fullScreen={fullScreen}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pr: 1,
                }}
            >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
                    <IconButton
                        aria-label={fullScreen ? 'Свернуть' : 'Развернуть'}
                        onClick={() => setForceFullScreen((prev) => !prev)}
                        size="small"
                    >
                        {fullScreen ? (
                            <CloseFullscreenIcon fontSize="small" />
                        ) : (
                            <OpenInFullIcon fontSize="small" />
                        )}
                    </IconButton>
                    <IconButton aria-label="Закрыть" onClick={handleClose} size="small">
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
                {mode === 'self' ? (
                    <ProfilePageContent mode="self" />
                ) : clerkUserId ? (
                    <ProfilePageContent mode="public" userId={clerkUserId} />
                ) : (
                    <Stack sx={{ p: 3 }}>
                        <Typography>Пользователь не выбран.</Typography>
                    </Stack>
                )}
            </DialogContent>
        </Dialog>
    );
}
