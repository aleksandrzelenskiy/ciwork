import * as React from 'react';
import {
    Avatar,
    Box,
    Button,
    CircularProgress,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import GroupIcon from '@mui/icons-material/Group';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

import type { MemberDTO } from '@/types/org';
import { roleLabel } from '@/utils/org';
import { formatDateShort } from '@/utils/date';
import { UI_RADIUS } from '@/config/uiTokens';
import ProfileDialog from '@/features/profile/ProfileDialog';
import { useI18n } from '@/i18n/I18nProvider';

type OrgMembersCardProps = {
    loading: boolean;
    membersPreview: MemberDTO[];
    activeMembersCount: number;
    invitedMembersCount: number;
    requestedMembersCount: number;
    onOpenDialog: () => void;
    onInvite: () => void;
    inviteTooltip: string;
    disableCreationActions: boolean;
    masonryCardSx: SxProps<Theme>;
    cardBorder: string;
    isDarkMode: boolean;
    textSecondary: string;
    buttonRadius: number;
};

const initialsFromMember = (member: MemberDTO) => {
    const base = member.userName || member.userEmail || '';
    const parts = base.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export default function OrgMembersCard({
    loading,
    membersPreview,
    activeMembersCount,
    invitedMembersCount,
    requestedMembersCount,
    onOpenDialog,
    onInvite,
    inviteTooltip,
    disableCreationActions,
    masonryCardSx,
    cardBorder,
    isDarkMode,
    textSecondary,
    buttonRadius,
}: OrgMembersCardProps) {
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
        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                        <GroupIcon fontSize="small" />
                        <Typography variant="subtitle1" fontWeight={600}>
                            {t('org.members.title', 'Участники')}
                        </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                        <Tooltip title={t('common.openList', 'Открыть список')}>
                            <span>
                                <IconButton onClick={onOpenDialog}>
                                    <OpenInFullIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title={inviteTooltip}>
                            <span>
                                <IconButton onClick={onInvite} disabled={disableCreationActions}>
                                    <PersonAddIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                </Stack>
                <Typography variant="body2" color={textSecondary}>
                    {t('org.members.counts', 'Активных: {active}, приглашённых: {invited}, запросов: {requested}.', {
                        active: activeMembersCount,
                        invited: invitedMembersCount,
                        requested: requestedMembersCount,
                    })}
                </Typography>
                {loading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={18} />
                        <Typography variant="body2">{t('org.members.loading', 'Загружаем участников…')}</Typography>
                    </Stack>
                ) : membersPreview.length > 0 ? (
                    <Stack spacing={1}>
                        {membersPreview.map((member) => (
                            <Box
                                key={member._id}
                                sx={{
                                    borderRadius: UI_RADIUS.thin,
                                    p: 1.25,
                                    border: `1px solid ${cardBorder}`,
                                    backgroundColor: isDarkMode
                                        ? 'rgba(12,16,26,0.7)'
                                        : 'rgba(255,255,255,0.7)',
                                }}
                            >
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Avatar src={member.profilePic} sx={{ width: 32, height: 32 }}>
                                        {initialsFromMember(member)}
                                    </Avatar>
                                    <Box>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            {member.clerkId ? (
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    onClick={() => openProfileDialog(member.clerkId)}
                                                    sx={{ textTransform: 'none', px: 0, minWidth: 0, fontWeight: 600 }}
                                                >
                                                    {member.userName || t('common.noName', 'Без имени')}
                                                </Button>
                                            ) : (
                                                <Typography variant="body2" fontWeight={600}>
                                                    {member.userName || t('common.noName', 'Без имени')}
                                                </Typography>
                                            )}
                                            <Typography variant="caption" color="text.secondary">
                                                {roleLabel(member.role, t)}
                                            </Typography>
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary">
                                            {member.userEmail || '—'}
                                        </Typography>
                                        {member.status === 'requested' && member.requestedAt && (
                                            <Typography variant="caption" color="info.main">
                                                {t('org.members.requestedAtLabel', 'Запрос от {date}', {
                                                    date: formatDateShort(member.requestedAt),
                                                })}
                                            </Typography>
                                        )}
                                    </Box>
                                </Stack>
                            </Box>
                        ))}
                    </Stack>
                ) : (
                    <Typography variant="body2" color={textSecondary}>
                        {t('org.members.empty', 'Участников пока нет.')}
                    </Typography>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                    <Button
                        variant="contained"
                        onClick={onOpenDialog}
                        sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                    >
                        {t('common.openList', 'Открыть список')}
                    </Button>
                    <Tooltip title={inviteTooltip} disableHoverListener={!disableCreationActions}>
                        <span>
                            <Button
                                variant="outlined"
                                onClick={onInvite}
                                disabled={disableCreationActions}
                                sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                            >
                                {t('org.members.invite.action', 'Пригласить')}
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>

            <ProfileDialog
                open={profileOpen}
                onClose={closeProfileDialog}
                clerkUserId={profileUserId}
            />
        </Box>
    );
}
