import { Alert, Box, Dialog, DialogActions, DialogContent, DialogTitle, Button, Stack, Typography, CircularProgress } from '@mui/material';

type WalletTx = {
    id: string;
    amount: number;
    type: string;
    source: string;
    balanceAfter: number;
    createdAt: string;
    meta?: Record<string, unknown>;
};

type OrgWalletTransactionsDialogProps = {
    open: boolean;
    onClose: () => void;
    loading: boolean;
    error?: string | null;
    transactions: WalletTx[];
};

const formatAmount = (tx: WalletTx) => {
    const sign = tx.type === 'debit' ? '-' : '+';
    return `${sign}${tx.amount.toFixed(2)} ₽`;
};

const formatTitle = (tx: WalletTx) => {
    if (tx.source === 'storage_overage') {
        return 'Списание за хранение';
    }
    if (tx.type === 'credit') {
        return 'Пополнение';
    }
    return 'Списание';
};

const formatDetails = (tx: WalletTx) => {
    if (tx.source === 'storage_overage' && tx.meta) {
        const overageGb = tx.meta.overageGb as number | undefined;
        const hourKey = tx.meta.hourKey as string | undefined;
        return `Сверх лимита: ${overageGb ?? '—'} ГБ · период ${hourKey ?? '—'}`;
    }
    if (tx.source === 'manual') {
        return 'Изменено вручную администратором';
    }
    return '';
};

export default function OrgWalletTransactionsDialog({
    open,
    onClose,
    loading,
    error,
    transactions,
}: OrgWalletTransactionsDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>История операций</DialogTitle>
            <DialogContent>
                <Stack spacing={2}>
                    {loading && (
                        <Box display="flex" justifyContent="center" py={2}>
                            <CircularProgress size={24} />
                        </Box>
                    )}
                    {!loading && error && <Alert severity="error">{error}</Alert>}
                    {!loading && !error && transactions.length === 0 && (
                        <Typography color="text.secondary">Операций пока нет.</Typography>
                    )}
                    {!loading && !error && transactions.map((tx) => (
                        <Box
                            key={tx.id}
                            sx={{
                                borderRadius: 3,
                                border: '1px solid rgba(15,23,42,0.08)',
                                p: 2,
                                background: 'rgba(255,255,255,0.9)',
                            }}
                        >
                            <Stack direction="row" justifyContent="space-between" spacing={2}>
                                <Box>
                                    <Typography fontWeight={600}>{formatTitle(tx)}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {new Date(tx.createdAt).toLocaleString('ru-RU')}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatDetails(tx)}
                                    </Typography>
                                </Box>
                                <Box textAlign="right">
                                    <Typography
                                        fontWeight={700}
                                        color={tx.type === 'debit' ? 'error' : 'success.main'}
                                    >
                                        {formatAmount(tx)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Баланс: {tx.balanceAfter.toFixed(2)} ₽
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
                    ))}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
}
