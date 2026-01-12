import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ResponsiveStyleValue } from '@mui/system';
import BusinessIcon from '@mui/icons-material/Business';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SettingsIcon from '@mui/icons-material/Settings';
import { UI_RADIUS } from '@/config/uiTokens';

type OrgOverviewPanelProps = {
    orgName?: string;
    orgSlug?: string;
    settingsTooltip: string;
    settingsButtonDisabled: boolean;
    canEditOrgSettings: boolean;
    onOpenOrgSettings: () => void;
    onGoToProjects: () => void;
    onInvite: () => void;
    disableCreationActions: boolean;
    inviteTooltip: string;
    primaryActionLabel?: string;
    primaryActionIcon?: React.ReactNode;
    secondaryActionLabel?: string;
    secondaryActionIcon?: React.ReactNode;
    actionButtonBaseSx: SxProps<Theme>;
    panelBaseSx: SxProps<Theme>;
    panelPadding: ResponsiveStyleValue<number | string>;
    statCardSx: SxProps<Theme>;
    textPrimary: string;
    textSecondary: string;
    headerBorder: string;
    iconBorderColor: string;
    iconBg: string;
    iconHoverBg: string;
    iconShadow: string;
    disabledIconColor: string;
    iconRadius: number;
    isDarkMode: boolean;
    activeProjectsCount: number;
    projectsLimitLabel: string;
    activeMembersCount: number;
    seatsLabel: string;
    subscriptionStatusLabel: string;
    subscriptionStatusColor: string;
    subscriptionStatusDescription: string;
    subscriptionEndLabel: string | null;
    roleLabelRu: string;
    tasksUsedLabel: string;
    publicTasksUsedLabel: string;
    tasksWeeklyLimitLabel: string;
    publicTasksLimitLabel: string;
    onOpenPlansDialog: () => void;
    subscriptionError: string | null;
    subscriptionLoading: boolean;
    billingReadOnly: boolean;
    billingReason?: string;
    billingGraceAvailable: boolean;
    isOwnerOrAdmin: boolean;
    onActivateGrace: () => void;
    isSubscriptionActive: boolean;
    isTrialExpired: boolean;
    formattedTrialEnd?: string | null;
    canStartTrial: boolean;
    startTrialLoading: boolean;
    onStartTrial: () => void;
    trialDaysLeft: number | null;
    isTrialActive: boolean;
    getAlertSx: (tone: 'error' | 'warning' | 'info') => SxProps<Theme>;
};

export default function OrgOverviewPanel({
    orgName,
    orgSlug,
    settingsTooltip,
    settingsButtonDisabled,
    canEditOrgSettings,
    onOpenOrgSettings,
    onGoToProjects,
    onInvite,
    disableCreationActions,
    inviteTooltip,
    primaryActionLabel,
    primaryActionIcon,
    secondaryActionLabel,
    secondaryActionIcon,
    actionButtonBaseSx,
    panelBaseSx,
    panelPadding,
    statCardSx,
    textPrimary,
    textSecondary,
    headerBorder,
    iconBorderColor,
    iconBg,
    iconHoverBg,
    iconShadow,
    disabledIconColor,
    iconRadius,
    isDarkMode,
    activeProjectsCount,
    projectsLimitLabel,
    activeMembersCount,
    seatsLabel,
    subscriptionStatusLabel,
    subscriptionStatusColor,
    subscriptionStatusDescription,
    subscriptionEndLabel,
    roleLabelRu,
    tasksUsedLabel,
    publicTasksUsedLabel,
    tasksWeeklyLimitLabel,
    publicTasksLimitLabel,
    onOpenPlansDialog,
    subscriptionError,
    subscriptionLoading,
    billingReadOnly,
    billingReason,
    billingGraceAvailable,
    isOwnerOrAdmin,
    onActivateGrace,
    isSubscriptionActive,
    isTrialExpired,
    formattedTrialEnd,
    canStartTrial,
    startTrialLoading,
    onStartTrial,
    trialDaysLeft,
    isTrialActive,
    getAlertSx,
}: OrgOverviewPanelProps) {
    const primaryLabel = primaryActionLabel ?? 'К проектам';
    const secondaryLabel = secondaryActionLabel ?? 'Пригласить';
    const primaryIcon = primaryActionIcon ?? <DriveFileMoveIcon />;
    const secondaryIcon = secondaryActionIcon ?? <PersonAddIcon />;

    return (
        <Box
            sx={{
                ...panelBaseSx,
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: isDarkMode
                        ? 'linear-gradient(120deg, rgba(59,130,246,0.18), transparent 60%)'
                        : 'linear-gradient(120deg, rgba(59,130,246,0.15), transparent 55%)',
                    pointerEvents: 'none',
                },
            }}
        >
            <Box sx={{ px: panelPadding }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={{ xs: 2, md: 3 }}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    justifyContent="space-between"
                >
                    <Box sx={{ width: '100%' }}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                            <Box
                                sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: UI_RADIUS.overlay,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isDarkMode
                                        ? 'rgba(59,130,246,0.18)'
                                        : 'rgba(59,130,246,0.15)',
                                    color: isDarkMode ? '#93c5fd' : '#1d4ed8',
                                    boxShadow: iconShadow,
                                }}
                            >
                                <BusinessIcon />
                            </Box>
                            <Typography
                                variant="h5"
                                fontWeight={700}
                                color={textPrimary}
                                sx={{ fontSize: { xs: '1.55rem', md: '1.95rem' } }}
                            >
                                {orgName || orgSlug}
                            </Typography>
                            <Tooltip title={settingsTooltip}>
                                <span>
                                    <IconButton
                                        onClick={canEditOrgSettings ? onOpenOrgSettings : undefined}
                                        disabled={settingsButtonDisabled}
                                        sx={{
                                            borderRadius: iconRadius,
                                            border: `1px solid ${iconBorderColor}`,
                                            backgroundColor: iconBg,
                                            boxShadow: iconShadow,
                                            '&:hover': { backgroundColor: iconHoverBg },
                                            '&.Mui-disabled': { color: disabledIconColor },
                                        }}
                                    >
                                        <SettingsIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Stack>
                        <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                            Управляйте подпиской, участниками и проектами организации.
                        </Typography>
                    </Box>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.25}
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                        sx={{ width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap', rowGap: 1 }}
                    >
                        <Button
                            variant="outlined"
                            onClick={onGoToProjects}
                            startIcon={primaryIcon}
                            sx={{
                                ...actionButtonBaseSx,
                                borderColor: headerBorder,
                                color: textPrimary,
                                backgroundColor: isDarkMode
                                    ? 'rgba(15,18,28,0.65)'
                                    : 'rgba(255,255,255,0.85)',
                            }}
                        >
                            {primaryLabel}
                        </Button>
                        <Tooltip title={inviteTooltip} disableHoverListener={!disableCreationActions}>
                            <span style={{ display: 'inline-flex' }}>
                                <Button
                                    variant="contained"
                                    disableElevation
                                    startIcon={secondaryIcon}
                                    onClick={onInvite}
                                    disabled={disableCreationActions}
                                    sx={{
                                        ...actionButtonBaseSx,
                                        border: 'none',
                                        color: '#ffffff',
                                        backgroundImage: disableCreationActions
                                            ? isDarkMode
                                                ? 'linear-gradient(120deg, rgba(148,163,184,0.4), rgba(100,116,139,0.35))'
                                                : 'linear-gradient(120deg, rgba(148,163,184,0.3), rgba(100,116,139,0.25))'
                                            : 'linear-gradient(120deg, #3b82f6, #6366f1)',
                                    }}
                                >
                                    {secondaryLabel}
                                </Button>
                            </span>
                        </Tooltip>
                    </Stack>
                </Stack>
            </Box>

            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={{ xs: 2, md: 2.5 }}
                useFlexGap
                sx={{
                    mt: { xs: 2.5, md: 3 },
                    px: { xs: 2, md: 2.5 },
                    flexWrap: { xs: 'nowrap', md: 'wrap' },
                }}
            >
                <Box sx={statCardSx}>
                    <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                        Активные проекты
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color={textPrimary}>
                        {activeProjectsCount}
                    </Typography>
                    <Typography variant="body2" color={textSecondary}>
                        из {projectsLimitLabel} доступных
                    </Typography>
                </Box>
                <Box sx={statCardSx}>
                    <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                        Рабочих мест
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color={textPrimary}>
                        {activeMembersCount}
                    </Typography>
                    <Typography variant="body2" color={textSecondary}>
                        Всего {seatsLabel}
                    </Typography>
                </Box>
                <Box sx={statCardSx}>
                    <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                        Задач за неделю
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color={textPrimary}>
                        {tasksUsedLabel}
                    </Typography>
                    <Typography variant="body2" color={textSecondary}>
                        из {tasksWeeklyLimitLabel} доступных
                    </Typography>
                </Box>
                <Box sx={statCardSx}>
                    <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                        Публичных задач
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color={textPrimary}>
                        {publicTasksUsedLabel}
                    </Typography>
                    <Typography variant="body2" color={textSecondary}>
                        из {publicTasksLimitLabel} в месяц
                    </Typography>
                </Box>
                <Box sx={statCardSx}>
                    <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                        Статус подписки
                    </Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ color: subscriptionStatusColor }}>
                        {subscriptionStatusLabel}
                    </Typography>
                    <Typography variant="body2" color={textSecondary}>
                        {subscriptionStatusDescription}
                    </Typography>
                    {subscriptionEndLabel && (
                        <Typography variant="body2" color={textSecondary}>
                            {subscriptionEndLabel}
                        </Typography>
                    )}
                    <Button
                        variant="text"
                        size="small"
                        onClick={onOpenPlansDialog}
                        sx={{ mt: 1, px: 0, textTransform: 'none' }}
                    >
                        Изменить
                    </Button>
                </Box>
                <Box sx={statCardSx}>
                    <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                        Ваша роль
                    </Typography>
                    <Typography variant="h6" fontWeight={600} color={textPrimary}>
                        {roleLabelRu}
                    </Typography>
                    <Typography variant="body2" color={textSecondary}>
                        Организация {orgName || orgSlug}
                    </Typography>
                </Box>
            </Stack>

            <Box sx={{ px: panelPadding }}>
                <Stack spacing={1.5} sx={{ mt: { xs: 2, md: 2.5 } }}>
                    {subscriptionError && (
                        <Alert severity="error" sx={getAlertSx('error')}>
                            Не удалось получить статус подписки: {subscriptionError}
                        </Alert>
                    )}
                    {!subscriptionError && subscriptionLoading && (
                        <Alert severity="info" sx={getAlertSx('info')}>
                            Проверяем статус подписки…
                        </Alert>
                    )}
                    {!subscriptionError && !subscriptionLoading && billingReadOnly && (
                        <Alert
                            severity="warning"
                            sx={getAlertSx('warning')}
                            action={
                                billingGraceAvailable && isOwnerOrAdmin ? (
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={onActivateGrace}
                                        sx={{
                                            ...actionButtonBaseSx,
                                            px: 2,
                                            py: 0.6,
                                            backgroundImage: 'linear-gradient(120deg, #f97316, #facc15)',
                                            color: '#2f1000',
                                        }}
                                    >
                                        Льготный период 3 дня
                                    </Button>
                                ) : undefined
                            }
                        >
                            {billingReason ?? 'Доступ ограничен: недостаточно средств'}
                        </Alert>
                    )}
                    {!subscriptionError && !subscriptionLoading && !isSubscriptionActive && !billingReadOnly && (
                        <Alert severity="warning" sx={getAlertSx('warning')}>
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={2}
                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                                justifyContent="space-between"
                            >
                                <Box>
                                    <Typography fontWeight={600} color={textPrimary}>
                                        Подписка не активна.
                                    </Typography>
                                    {isTrialExpired && formattedTrialEnd && (
                                        <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                            Пробный период завершился {formattedTrialEnd}.
                                        </Typography>
                                    )}
                                    <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                        Получите бесплатный пробный период на 10 дней с тарифом PRO.
                                    </Typography>
                                    {!canStartTrial && (
                                        <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                            Обратитесь к владельцу организации, чтобы активировать подписку.
                                        </Typography>
                                    )}
                                </Box>
                                {canStartTrial && (
                                    <Button
                                        variant="contained"
                                        onClick={onStartTrial}
                                        disabled={startTrialLoading}
                                        sx={{
                                            ...actionButtonBaseSx,
                                            px: { xs: 2.25, md: 2.75 },
                                            py: 0.9,
                                            backgroundImage: 'linear-gradient(120deg, #f97316, #facc15)',
                                            color: '#2f1000',
                                        }}
                                    >
                                        {startTrialLoading ? 'Запускаем…' : 'Активировать'}
                                    </Button>
                                )}
                            </Stack>
                        </Alert>
                    )}
                    {!subscriptionError && !subscriptionLoading && isTrialActive && (
                        <Alert severity="info" sx={getAlertSx('info')}>
                            Пробный период активен до {formattedTrialEnd ?? '—'}
                            {typeof trialDaysLeft === 'number' && (
                                <Typography component="span" sx={{ ml: 0.5 }}>
                                    (осталось {trialDaysLeft} дн.)
                                </Typography>
                            )}
                        </Alert>
                    )}
                </Stack>
            </Box>
        </Box>
    );
}
