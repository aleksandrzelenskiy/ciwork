'use client';

import {
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ProfilePageContent from '@/app/profile/ProfilePageContent';

type ProfileDialogProps = {
    open: boolean;
    onClose: () => void;
    userId?: string | null;
    mode?: 'self' | 'public';
    title?: string;
};

export default function ProfileDialog({
    open,
    onClose,
    userId,
    mode = 'public',
    title,
}: ProfileDialogProps) {
    const resolvedTitle = title || 'Профиль пользователя';

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pr: 1,
                }}
            >
                <Typography variant="h6">{resolvedTitle}</Typography>
                <IconButton aria-label="Закрыть" onClick={onClose} size="small">
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0 }}>
                {mode === 'self' ? (
                    <ProfilePageContent mode="self" />
                ) : userId ? (
                    <ProfilePageContent mode="public" userId={userId} />
                ) : (
                    <Stack sx={{ p: 3 }}>
                        <Typography>Пользователь не выбран.</Typography>
                    </Stack>
                )}
            </DialogContent>
        </Dialog>
    );
}
