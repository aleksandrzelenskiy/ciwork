import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';

import type { IntegrationDTO } from '@/types/org';
import { integrationTypeLabel } from '@/utils/org';
import { UI_RADIUS } from '@/config/uiTokens';
import { useI18n } from '@/i18n/I18nProvider';

type OrgIntegrationsCardProps = {
    integrations: IntegrationDTO[];
    integrationsLoading: boolean;
    integrationsError: string | null;
    projectNameById: Map<string, string>;
    canRequestIntegrations: boolean;
    integrationRequestTooltip: string;
    integrationKeyTooltip: string;
    isSuperAdmin: boolean;
    onRefresh: () => void;
    onOpenDialog: () => void;
    onGenerateKey: () => void;
    onToggleStatus: (integration: IntegrationDTO) => void;
    onEditIntegration: (integration: IntegrationDTO) => void;
    onDeleteIntegration: (integration: IntegrationDTO) => void;
    masonryCardSx: SxProps<Theme>;
    cardBorder: string;
    isDarkMode: boolean;
    textSecondary: string;
    getAlertSx: (tone: 'warning' | 'error' | 'info') => SxProps<Theme>;
    buttonRadius: number;
};

export default function OrgIntegrationsCard({
    integrations,
    integrationsLoading,
    integrationsError,
    projectNameById,
    canRequestIntegrations,
    integrationRequestTooltip,
    integrationKeyTooltip,
    isSuperAdmin,
    onRefresh,
    onOpenDialog,
    onGenerateKey,
    onToggleStatus,
    onEditIntegration,
    onDeleteIntegration,
    masonryCardSx,
    cardBorder,
    isDarkMode,
    textSecondary,
    getAlertSx,
    buttonRadius,
}: OrgIntegrationsCardProps) {
    const { t } = useI18n();
    return (
        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                        <IntegrationInstructionsIcon fontSize="small" />
                        <Typography variant="subtitle1" fontWeight={600}>
                            {t('org.integrations.title', 'Интеграции')}
                        </Typography>
                    </Stack>
                    <Tooltip title={t('common.refresh', 'Обновить')}>
                        <span>
                            <IconButton onClick={onRefresh} disabled={integrationsLoading}>
                                <RefreshIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
                <Typography variant="body2" color={textSecondary}>
                    {t('org.integrations.subtitle', 'Подключайте Google Sheets, Telegram и 1C ERP.')}
                </Typography>
                {integrationsError && (
                    <Alert severity="warning" sx={getAlertSx('warning')}>
                        {integrationsError}
                    </Alert>
                )}
                {integrationsLoading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={18} />
                        <Typography variant="body2">
                            {t('org.integrations.loading', 'Загружаем интеграции…')}
                        </Typography>
                    </Stack>
                ) : integrations.length > 0 ? (
                    <Stack spacing={1}>
                        {integrations.slice(0, 3).map((integration) => {
                            const projectLabel =
                                integration.projectId && projectNameById.has(integration.projectId)
                                    ? projectNameById.get(integration.projectId)
                                    : t('org.integrations.allProjects', 'Все проекты');
                            const name = integration.name?.trim();
                            return (
                                <Box
                                    key={integration._id}
                                    sx={{
                                        borderRadius: UI_RADIUS.thin,
                                        p: 1.25,
                                        border: `1px solid ${cardBorder}`,
                                        backgroundColor: isDarkMode
                                            ? 'rgba(12,16,26,0.7)'
                                            : 'rgba(255,255,255,0.7)',
                                    }}
                                >
                                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                                        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                            <Typography variant="body2" fontWeight={600}>
                                                {name || integrationTypeLabel(integration.type, t)}
                                            </Typography>
                                            <Chip
                                                size="small"
                                                color={integration.status === 'active' ? 'success' : 'default'}
                                                label={
                                                    integration.status === 'active'
                                                        ? t('org.integrations.status.active', 'active')
                                                        : t('org.integrations.status.paused', 'paused')
                                                }
                                            />
                                        </Stack>
                                        <Stack direction="row" spacing={0.5}>
                                            <Tooltip
                                                title={
                                                    integration.status === 'active'
                                                        ? t('org.integrations.actions.pause', 'Приостановить')
                                                        : t('org.integrations.actions.enable', 'Включить')
                                                }
                                            >
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => onToggleStatus(integration)}
                                                        disabled={!canRequestIntegrations}
                                                    >
                                                        {integration.status === 'active' ? (
                                                            <PauseCircleOutlineIcon fontSize="small" />
                                                        ) : (
                                                            <PlayArrowIcon fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title={t('common.edit', 'Редактировать')}>
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => onEditIntegration(integration)}
                                                        disabled={!canRequestIntegrations}
                                                    >
                                                        <EditOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                            <Tooltip title={t('common.delete', 'Удалить')}>
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => onDeleteIntegration(integration)}
                                                        disabled={!canRequestIntegrations}
                                                    >
                                                        <DeleteOutlineOutlinedIcon fontSize="small" />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </Stack>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">
                                        {integrationTypeLabel(integration.type, t)} · {projectLabel}
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Stack>
                ) : (
                    <Typography variant="body2" color={textSecondary}>
                        {t('org.integrations.empty', 'Интеграций пока нет.')}
                    </Typography>
                )}
                <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                    <Tooltip title={integrationRequestTooltip}>
                        <span>
                            <Button
                                variant="contained"
                                onClick={onOpenDialog}
                                disabled={!canRequestIntegrations}
                                sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                            >
                                {t('org.integrations.actions.connect', 'Подключить')}
                            </Button>
                        </span>
                    </Tooltip>
                    <Tooltip title={integrationKeyTooltip}>
                        <span>
                            <Button
                                variant="outlined"
                                onClick={onGenerateKey}
                                disabled={!isSuperAdmin}
                                sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                            >
                                {t('org.integrations.actions.generateKey', 'Сгенерировать ключ API')}
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>
        </Box>
    );
}
