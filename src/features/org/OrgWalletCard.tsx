import { Box, Button, Stack, Typography } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

type OrgWalletCardProps = {
    balance: number;
    currency: string;
    loading?: boolean;
    onOpen: () => void;
};

export default function OrgWalletCard({
    balance,
    currency,
    loading,
    onOpen,
}: OrgWalletCardProps) {
    return (
        <Box
            sx={{
                borderRadius: 4,
                p: 2.5,
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 20px 60px rgba(15,23,42,0.08)',
                minWidth: 220,
            }}
        >
            <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <AccountBalanceWalletIcon fontSize="small" />
                    <Typography variant="overline" sx={{ letterSpacing: 1 }}>
                        Баланс
                    </Typography>
                </Stack>
                <Typography variant="h4" fontWeight={700}>
                    {loading ? '—' : `${balance.toFixed(2)} ${currency}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Хранение списывается почасово, подписка — раз в месяц.
                </Typography>
                <Button
                    variant="outlined"
                    onClick={onOpen}
                    sx={{ borderRadius: 999, textTransform: 'none' }}
                >
                    История операций
                </Button>
            </Stack>
        </Box>
    );
}
