import * as React from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Stack,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

import type { OrgWalletInfo, OrgWalletTx } from '@/types/org';

const txTypeLabel = (type: string) => {
    if (type === 'debit') return 'Списание';
    if (type === 'credit') return 'Пополнение';
    return type || '—';
};

type OrgWalletCardProps = {
    walletLoading: boolean;
    walletInfo: OrgWalletInfo | null;
    walletTxLoading: boolean;
    walletTxError: string | null;
    walletTx: OrgWalletTx[];
    onOpenHistory: () => void;
    masonryCardSx: SxProps<Theme>;
    textSecondary: string;
    buttonRadius: number;
};

export default function OrgWalletCard({
    walletLoading,
    walletInfo,
    walletTxLoading,
    walletTxError,
    walletTx,
    onOpenHistory,
    masonryCardSx,
    textSecondary,
    buttonRadius,
}: OrgWalletCardProps) {
    return (
        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <AccountBalanceWalletIcon fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={600}>
                        Баланс организации
                    </Typography>
                </Stack>
                <Typography variant="h4" fontWeight={700}>
                    {walletLoading
                        ? '—'
                        : `${(walletInfo?.balance ?? 0).toFixed(2)} ${walletInfo?.currency ?? 'RUB'}`}
                </Typography>
                <Typography variant="body2" color={textSecondary}>
                    Списания за хранение рассчитываются почасово.
                </Typography>
                <Stack spacing={0.75}>
                    {walletTxLoading ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={16} />
                            <Typography variant="body2">Загружаем операции…</Typography>
                        </Stack>
                    ) : walletTxError ? (
                        <Typography variant="body2" color={textSecondary}>
                            Не удалось загрузить операции: {walletTxError}
                        </Typography>
                    ) : walletTx.length > 0 ? (
                        walletTx.slice(0, 3).map((tx) => (
                            <Stack key={tx.id} direction="row" justifyContent="space-between">
                                <Typography
                                    variant="body2"
                                    color={tx.type === 'debit' ? 'error.main' : tx.type === 'credit' ? 'success.main' : textSecondary}
                                >
                                    {txTypeLabel(tx.type)}
                                </Typography>
                                <Typography variant="body2" fontWeight={600}>
                                    {tx.amount.toFixed(2)} {walletInfo?.currency ?? 'RUB'}
                                </Typography>
                            </Stack>
                        ))
                    ) : (
                        <Typography variant="body2" color={textSecondary}>
                            Операций пока нет.
                        </Typography>
                    )}
                </Stack>
                <Button
                    variant="outlined"
                    onClick={onOpenHistory}
                    sx={{ borderRadius: buttonRadius, textTransform: 'none', alignSelf: 'flex-start' }}
                >
                    История операций
                </Button>
            </Stack>
        </Box>
    );
}
