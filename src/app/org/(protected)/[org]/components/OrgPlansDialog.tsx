import * as React from 'react';
import {
    Dialog,
    DialogContent,
} from '@mui/material';

import OrgPlansPanel from '@/features/org/OrgPlansPanel';

type OrgPlansDialogProps = {
    open: boolean;
    orgSlug?: string;
    onClose: () => void;
};

export default function OrgPlansDialog({
    open,
    orgSlug,
    onClose,
}: OrgPlansDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullScreen
            PaperProps={{
                sx: {
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                },
            }}
        >
            <DialogContent sx={{ p: 0 }}>
                {orgSlug ? (
                    <OrgPlansPanel
                        orgSlug={orgSlug}
                        showClose
                        onClose={onClose}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
