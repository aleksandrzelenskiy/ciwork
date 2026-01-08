import * as React from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import type { MemberDTO, OrgRole } from '@/types/org';
import { roleLabel } from '@/utils/org';

type MemberRoleDialogProps = {
    open: boolean;
    onClose: () => void;
    member: MemberDTO | null;
    value: OrgRole;
    onChange: (role: OrgRole) => void;
    onSave: () => void;
    cardHeaderSx: SxProps<Theme>;
    cardContentSx: SxProps<Theme>;
    dialogPaperSx: SxProps<Theme>;
    dialogActionsSx: SxProps<Theme>;
};

export default function MemberRoleDialog({
    open,
    onClose,
    member,
    value,
    onChange,
    onSave,
    cardHeaderSx,
    cardContentSx,
    dialogPaperSx,
    dialogActionsSx,
}: MemberRoleDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            slotProps={{
                paper: {
                    sx: dialogPaperSx,
                },
            }}
        >
            <DialogTitle sx={cardHeaderSx}>
                Изменить роль участника
            </DialogTitle>
            <DialogContent sx={cardContentSx}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    {member?.userName || member?.userEmail}
                </Typography>
                <TextField
                    select
                    label="Роль"
                    fullWidth
                    value={value}
                    onChange={(event) => onChange(event.target.value as OrgRole)}
                    sx={{ mt: 1 }}
                >
                    {(['org_admin', 'manager', 'executor', 'viewer'] as OrgRole[]).map((role) => (
                        <MenuItem key={role} value={role}>
                            {roleLabel(role)}
                        </MenuItem>
                    ))}
                </TextField>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose}>Отмена</Button>
                <Button variant="contained" onClick={onSave}>
                    Сохранить
                </Button>
            </DialogActions>
        </Dialog>
    );
}
