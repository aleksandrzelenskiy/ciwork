import * as React from 'react';
import {
    Avatar,
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
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import LinkIcon from '@mui/icons-material/Link';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { MemberDTO, MemberStatus } from '@/types/org';
import { makeAbsoluteUrl, roleLabel } from '@/utils/org';
import ProfileDialog from '@/features/profile/ProfileDialog';
import { useI18n } from '@/i18n/I18nProvider';

const initialsFromMember = (member: MemberDTO) => {
    const base = member.userName || member.userEmail || '';
    const parts = base.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

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
    canApproveRequests: boolean;
    onApproveRequest: (member: MemberDTO) => void;
    onDeclineRequest: (member: MemberDTO) => void;
    cardBaseSx: SxProps<Theme>;
    cardHeaderSx: SxProps<Theme>;
    cardContentSx: SxProps<Theme>;
    dialogPaperSx: SxProps<Theme>;
    dialogActionsSx: SxProps<Theme>;
    dialogContentBg?: string;
};

type TranslateFn = (key: string, fallback?: string, params?: Record<string, string | number>) => string;

function statusChip(status: MemberStatus, t: TranslateFn) {
    if (status === 'active') {
        return <Chip label={t('org.members.status.active', 'active')} size="small" color="success" />;
    }
    if (status === 'invited') {
        return <Chip label={t('org.members.status.invited', 'invited')} size="small" color="warning" variant="outlined" />;
    }
    return <Chip label={t('org.members.status.requested', 'requested')} size="small" color="info" variant="outlined" />;
}

const formatShortDate = (iso?: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
};

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
    canApproveRequests,
    onApproveRequest,
    onDeclineRequest,
    cardBaseSx,
    cardHeaderSx,
    cardContentSx,
    dialogPaperSx,
    dialogActionsSx,
    dialogContentBg,
}: MembersDialogProps) {
    const { t } = useI18n();
    const [profileUserId, setProfileUserId] = React.useState<string | null>(null);
    const [profileOpen, setProfileOpen] = React.useState(false);

    const openProfileDialog = (clerkUserId?: string | null) => {
        if (!clerkUserId) return;
        setProfileUserId(clerkUserId);
        setProfileOpen(true);
    };

    const closeProfileDialog = () => {
        setProfileOpen(false);
        setProfileUserId(null);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            fullScreen
            slotProps={{
                paper: {
                    sx: { ...dialogPaperSx, borderRadius: 0 },
                },
            }}
        >
            <DialogTitle sx={cardHeaderSx}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="inherit">{t('org.members.dialog.title', 'Участники организации')}</Typography>
                    <IconButton onClick={onClose}>
                        <CloseFullscreenIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent dividers sx={{ backgroundColor: dialogContentBg }}>
                <Card variant="outlined" sx={cardBaseSx}>
                    <CardHeader
                        sx={cardHeaderSx}
                        title={t('org.members.dialog.titleCount', 'Участники организации ({count})', {
                            count: members.length,
                        })}
                        subheader={t(
                            'org.members.dialog.subtitle',
                            'Действующие и приглашённые участники {org}',
                            { org: orgSlug ?? '' }
                        )}
                        action={
                            <Stack direction="row" spacing={1}>
                                <Tooltip
                                    title={
                                        showMemberSearch
                                            ? t('org.members.search.hide', 'Скрыть поиск')
                                            : t('org.members.search.show', 'Поиск по участникам')
                                    }
                                >
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
                                <Tooltip title={t('common.refresh', 'Обновить')}>
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
                                        label={t('org.members.search.field', 'Поиск по имени или e-mail')}
                                        value={memberSearch}
                                        onChange={(event) => onSearchChange(event.target.value)}
                                    />
                                    <Tooltip title={t('org.members.search.reset', 'Сбросить поиск')}>
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
                                <Typography>{t('org.members.loading', 'Загрузка участников…')}</Typography>
                            </Stack>
                        ) : (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>{t('org.members.table.name', 'Имя')}</TableCell>
                                        <TableCell>{t('org.members.table.email', 'E-mail')}</TableCell>
                                        <TableCell>{t('org.members.table.role', 'Роль')}</TableCell>
                                        <TableCell>{t('org.members.table.status', 'Статус')}</TableCell>
                                        <TableCell align="right">{t('common.actions', 'Действия')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredMembers.map((member) => {
                                        const isInvited = member.status === 'invited';
                                        const isRequested = member.status === 'requested';
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
                                                title={
                                                    isInvited
                                                        ? t(
                                                              'org.members.invite.sent',
                                                              'Приглашение отправлено, ожидаем подтверждения'
                                                          )
                                                        : undefined
                                                }
                                            >
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Avatar src={member.profilePic} sx={{ width: 28, height: 28 }}>
                                                            {initialsFromMember(member)}
                                                        </Avatar>
                                                        {member.clerkId ? (
                                                            <Button
                                                                variant="text"
                                                                size="small"
                                                                onClick={() => openProfileDialog(member.clerkId)}
                                                                sx={{ textTransform: 'none', px: 0, minWidth: 0 }}
                                                            >
                                                                {member.userName || '—'}
                                                            </Button>
                                                        ) : (
                                                            <Typography variant="body2">
                                                                {member.userName || '—'}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>{member.userEmail}</TableCell>
                                                <TableCell>{roleLabel(member.role, t)}</TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        {statusChip(member.status, t)}
                                                        {isInvited && member.inviteExpiresAt && (
                                                            <Chip
                                                                size="small"
                                                                variant="outlined"
                                                                label={t('org.members.invite.expires', 'до {date}', {
                                                                    date: formatExpire(member.inviteExpiresAt),
                                                                })}
                                                            />
                                                        )}
                                                        {isRequested && member.requestedAt && (
                                                            <Chip
                                                                size="small"
                                                                variant="outlined"
                                                                label={t('org.members.requestedAt', 'с {date}', {
                                                                    date: formatShortDate(member.requestedAt),
                                                                })}
                                                            />
                                                        )}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {inviteLink && (
                                                        <Tooltip title={t('org.members.invite.copy', 'Скопировать ссылку приглашения')}>
                                                            <IconButton
                                                                onClick={() => {
                                                                    void navigator.clipboard.writeText(inviteLink).then(onInviteLinkCopied);
                                                                }}
                                                            >
                                                                <LinkIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}

                                                    {isRequested && canApproveRequests && (
                                                        <>
                                                            <Tooltip title={t('org.members.request.approve', 'Одобрить запрос')}>
                                                                <IconButton onClick={() => onApproveRequest(member)}>
                                                                    <CheckCircleOutlineIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title={t('org.members.request.decline', 'Отклонить запрос')}>
                                                                <IconButton onClick={() => onDeclineRequest(member)}>
                                                                    <HighlightOffIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </>
                                                    )}

                                                    {member.role !== 'owner' && member.status !== 'requested' && (
                                                        <Tooltip title={t('org.members.role.change', 'Изменить роль')}>
                                                            <IconButton onClick={() => onEditRole(member)}>
                                                                <ManageAccountsIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}

                                                    {member.role !== 'owner' && member.status !== 'requested' && (
                                                        <Tooltip title={t('org.members.remove.title', 'Удалить участника')}>
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
                                                    {t('org.members.search.empty', 'Не найдено участников по запросу.')}
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
                <Button onClick={onClose}>{t('common.close', 'Закрыть')}</Button>
        </DialogActions>

            <ProfileDialog
                open={profileOpen}
                onClose={closeProfileDialog}
                clerkUserId={profileUserId}
            />
        </Dialog>
    );
}
