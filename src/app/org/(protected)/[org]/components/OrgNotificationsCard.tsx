import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Stack,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

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
    return (
        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={600}>
                    Уведомления
                </Typography>
                {walletError && (
                    <Alert severity="warning" sx={getAlertSx('warning')}>
                        Не удалось загрузить баланс: {walletError}
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
                                Повторить
                            </Button>
                        }
                    >
                        Не удалось загрузить реквизиты: {orgSettingsError}
                    </Alert>
                )}
            </Stack>
        </Box>
    );
}
