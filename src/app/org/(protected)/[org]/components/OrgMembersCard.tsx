import * as React from 'react';
import {
    Box,
    Button,
    CircularProgress,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

import type { MemberDTO } from '@/types/org';
import { roleLabel } from '@/utils/org';
import { UI_RADIUS } from '@/config/uiTokens';

type OrgMembersCardProps = {
    loading: boolean;
    membersPreview: MemberDTO[];
    activeMembersCount: number;
    invitedMembersCount: number;
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

export default function OrgMembersCard({
    loading,
    membersPreview,
    activeMembersCount,
    invitedMembersCount,
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
    return (
        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="subtitle1" fontWeight={600}>
                        Участники
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Tooltip title="Открыть список">
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
                    Активных: {activeMembersCount}, приглашённых: {invitedMembersCount}.
                </Typography>
                {loading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={18} />
                        <Typography variant="body2">Загружаем участников…</Typography>
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
                                <Typography variant="body2" fontWeight={600}>
                                    {member.userName || 'Без имени'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {member.userEmail} · {roleLabel(member.role)}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                ) : (
                    <Typography variant="body2" color={textSecondary}>
                        Участников пока нет.
                    </Typography>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                    <Button
                        variant="contained"
                        onClick={onOpenDialog}
                        sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                    >
                        Открыть список
                    </Button>
                    <Tooltip title={inviteTooltip} disableHoverListener={!disableCreationActions}>
                        <span>
                            <Button
                                variant="outlined"
                                onClick={onInvite}
                                disabled={disableCreationActions}
                                sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                            >
                                Пригласить
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>
        </Box>
    );
}
