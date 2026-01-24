import * as React from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import InviteMemberForm from '@/app/workspace/components/InviteMemberForm';
import { useI18n } from '@/i18n/I18nProvider';

type InviteMemberDialogProps = {
    open: boolean;
    onClose: () => void;
    orgSlug?: string;
    existingEmails: string[];
    cardHeaderSx: SxProps<Theme>;
    cardContentSx: SxProps<Theme>;
    dialogPaperSx: SxProps<Theme>;
    dialogActionsSx: SxProps<Theme>;
};

export default function InviteMemberDialog({
    open,
    onClose,
    orgSlug,
    existingEmails,
    cardHeaderSx,
    cardContentSx,
    dialogPaperSx,
    dialogActionsSx,
}: InviteMemberDialogProps) {
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
            <DialogTitle sx={cardHeaderSx}>
                {t('org.members.invite.title', 'Пригласить участника')}
            </DialogTitle>
            <DialogContent dividers sx={cardContentSx}>
                {orgSlug ? (
                    <InviteMemberForm
                        org={orgSlug}
                        defaultRole="executor"
                        // Передаём снимок, чтобы не было "уже в организации" сразу после генерации.
                        existingEmails={existingEmails}
                    />
                ) : null}
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button variant="text" color="primary" onClick={onClose}>
                    {t('common.close', 'Закрыть')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
