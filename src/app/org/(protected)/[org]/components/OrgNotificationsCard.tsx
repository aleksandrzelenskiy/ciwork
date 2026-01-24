import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Stack,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { useI18n } from '@/i18n/I18nProvider';

type OrgNotificationsCardProps = {
    walletError: string | null;
    orgSettingsError: string | null;
    onRetryOrgSettings: () => void;
    orgSettingsLoading: boolean;
    masonryCardSx: SxProps<Theme>;
    getAlertSx: (tone: 'warning' | 'error' | 'info') => SxProps<Theme>;
    buttonRadius: number;
};

export default function OrgNotificationsCard({
    walletError,
    orgSettingsError,
    onRetryOrgSettings,
    orgSettingsLoading,
    masonryCardSx,
    getAlertSx,
    buttonRadius,
}: OrgNotificationsCardProps) {
    const { t } = useI18n();
    return (
        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>
                    {t('org.notifications.title', 'Уведомления')}
                </Typography>
                {walletError && (
                    <Alert severity="warning" sx={getAlertSx('warning')}>
                        {t('org.notifications.walletError', 'Не удалось загрузить баланс: {error}', {
                            error: walletError,
                        })}
                    </Alert>
                )}
                {orgSettingsError && (
                    <Alert
                        severity="warning"
                        variant="outlined"
                        sx={getAlertSx('warning')}
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={onRetryOrgSettings}
                                disabled={orgSettingsLoading}
                                sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                            >
                                {t('common.retry', 'Повторить')}
                            </Button>
                        }
                    >
                        {t('org.notifications.settingsError', 'Не удалось загрузить реквизиты: {error}', {
                            error: orgSettingsError,
                        })}
                    </Alert>
                )}
            </Stack>
        </Box>
    );
}
