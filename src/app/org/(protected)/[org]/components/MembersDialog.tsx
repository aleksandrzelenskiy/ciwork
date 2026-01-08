import * as React from 'react';
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import LinkIcon from '@mui/icons-material/Link';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { MemberDTO, MemberStatus } from '@/types/org';
import { makeAbsoluteUrl, roleLabel } from '@/utils/org';

type MembersDialogProps = {
    open: boolean;
    onClose: () => void;
    members: MemberDTO[];
    filteredMembers: MemberDTO[];
    loading: boolean;
    showMemberSearch: boolean;
    memberSearch: string;
    onToggleSearch: () => void;
    onSearchChange: (value: string) => void;
    onClearSearch: () => void;
    inviteTooltip: string;
    disableCreationActions: boolean;
    onInvite: () => void;
    onRefresh: () => void;
    orgSlug?: string;
    frontendBase: string;
    formatExpire: (iso?: string) => string;
    onEditRole: (member: MemberDTO) => void;
    onRemoveMember: (member: MemberDTO) => void;
    onInviteLinkCopied: () => void;
    cardBaseSx: SxProps<Theme>;
    cardHeaderSx: SxProps<Theme>;
    cardContentSx: SxProps<Theme>;
    dialogPaperSx: SxProps<Theme>;
    dialogActionsSx: SxProps<Theme>;
    dialogContentBg?: string;
};

function statusChip(status: MemberStatus) {
    return status === 'active'
        ? <Chip label="active" size="small" color="success" />
        : <Chip label="invited" size="small" color="warning" variant="outlined" />;
}

export default function MembersDialog({
    open,
    onClose,
    members,
    filteredMembers,
    loading,
    showMemberSearch,
    memberSearch,
    onToggleSearch,
    onSearchChange,
    onClearSearch,
    inviteTooltip,
    disableCreationActions,
    onInvite,
    onRefresh,
    orgSlug,
    frontendBase,
    formatExpire,
    onEditRole,
    onRemoveMember,
    onInviteLinkCopied,
    cardBaseSx,
    cardHeaderSx,
    cardContentSx,
    dialogPaperSx,
    dialogActionsSx,
    dialogContentBg,
}: MembersDialogProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            slotProps={{
                paper: {
                    sx: dialogPaperSx,
                },
            }}
        >
            <DialogTitle sx={cardHeaderSx}>
                Участники организации
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: dialogContentBg }}>
                <Card variant="outlined" sx={cardBaseSx}>
                    <CardHeader
                        sx={cardHeaderSx}
                        title={`Участники организации (${members.length})`}
                        subheader={`Действующие и приглашённые участники ${orgSlug ?? ''}`}
                        action={
                            <Stack direction="row" spacing={1}>
                                <Tooltip title={showMemberSearch ? 'Скрыть поиск' : 'Поиск по участникам'}>
                                    <span>
                                        <IconButton
                                            onClick={onToggleSearch}
                                            color={showMemberSearch ? 'primary' : 'default'}
                                        >
                                            <PersonSearchIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Tooltip title={inviteTooltip}>
                                    <span>
                                        <IconButton
                                            onClick={onInvite}
                                            disabled={disableCreationActions}
                                        >
                                            <PersonAddIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Tooltip title="Обновить">
                                    <span>
                                        <IconButton onClick={onRefresh} disabled={loading}>
                                            <RefreshIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Stack>
                        }
                    />
                    <CardContent sx={cardContentSx}>
                        {showMemberSearch && (
                            <Stack sx={{ mb: 2, maxWidth: 360 }} spacing={1}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <TextField
                                        size="small"
                                        fullWidth
                                        label="Поиск по имени или e-mail"
                                        value={memberSearch}
                                        onChange={(event) => onSearchChange(event.target.value)}
                                    />
                                    <Tooltip title="Сбросить поиск">
                                        <IconButton onClick={onClearSearch}>
                                            <CancelIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Stack>
                        )}

                        {loading ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                                <CircularProgress size={20} />
                                <Typography>Загрузка участников…</Typography>
                            </Stack>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Имя</TableCell>
                                        <TableCell>E-mail</TableCell>
                                        <TableCell>Роль</TableCell>
                                        <TableCell>Статус</TableCell>
                                        <TableCell align="right">Действия</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredMembers.map((member) => {
                                        const isInvited = member.status === 'invited';
                                        const invitePath = `/org/${encodeURIComponent(String(orgSlug))}/join?token=${encodeURIComponent(
                                            member.inviteToken || ''
                                        )}`;
                                        const inviteLink =
                                            isInvited && member.inviteToken
                                                ? (frontendBase ? makeAbsoluteUrl(frontendBase, invitePath) : invitePath)
                                                : undefined;

                                        return (
                                            <TableRow
                                                key={member._id}
                                                sx={isInvited ? { opacity: 0.85 } : undefined}
                                                title={isInvited ? 'Приглашение отправлено, ожидаем подтверждения' : undefined}
                                            >
                                                <TableCell>{member.userName || '—'}</TableCell>
                                                <TableCell>{member.userEmail}</TableCell>
                                                <TableCell>{roleLabel(member.role)}</TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        {statusChip(member.status)}
                                                        {isInvited && member.inviteExpiresAt && (
                                                            <Chip
                                                                size="small"
                                                                variant="outlined"
                                                                label={`до ${formatExpire(member.inviteExpiresAt)}`}
                                                            />
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {inviteLink && (
                                                        <Tooltip title="Скопировать ссылку приглашения">
                                                            <IconButton
                                                                onClick={() => {
                                                                    void navigator.clipboard.writeText(inviteLink).then(onInviteLinkCopied);
                                                                }}
                                                            >
                                                                <LinkIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}

                                                    {member.role !== 'owner' && (
                                                        <Tooltip title="Изменить роль">
                                                            <IconButton onClick={() => onEditRole(member)}>
                                                                <ManageAccountsIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}

                                                    {member.role !== 'owner' && (
                                                        <Tooltip title="Удалить участника">
                                                            <IconButton onClick={() => onRemoveMember(member)}>
                                                                <DeleteOutlineOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}

                                    {filteredMembers.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5}>
                                                <Typography color="text.secondary">
                                                    Не найдено участников по запросу.
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
}
