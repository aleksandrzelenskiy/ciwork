import * as React from 'react';

import type { OrgWalletInfo, OrgWalletTx } from '@/types/org';
import { useI18n } from '@/i18n/I18nProvider';

type UseWalletState = {
    walletInfo: OrgWalletInfo | null;
    walletLoading: boolean;
    walletError: string | null;
    walletDialogOpen: boolean;
    walletTx: OrgWalletTx[];
    walletTxLoading: boolean;
    walletTxError: string | null;
    setWalletDialogOpen: (open: boolean) => void;
    fetchWalletInfo: () => Promise<void>;
    fetchWalletTransactions: () => Promise<void>;
};

export default function useWallet(org: string | undefined): UseWalletState {
    const { t } = useI18n();
    const [walletInfo, setWalletInfo] = React.useState<OrgWalletInfo | null>(null);
    const [walletLoading, setWalletLoading] = React.useState(false);
    const [walletError, setWalletError] = React.useState<string | null>(null);
    const [walletDialogOpen, setWalletDialogOpen] = React.useState(false);
    const [walletTx, setWalletTx] = React.useState<OrgWalletTx[]>([]);
    const [walletTxLoading, setWalletTxLoading] = React.useState(false);
    const [walletTxError, setWalletTxError] = React.useState<string | null>(null);

    const fetchWalletInfo = React.useCallback(async () => {
        if (!org) return;
        try {
            setWalletLoading(true);
            setWalletError(null);
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/wallet`, { cache: 'no-store' });
            const data = (await res.json().catch(() => null)) as
                | { wallet?: OrgWalletInfo; error?: string }
                | null;
            if (!res.ok || !data?.wallet) {
                setWalletError(data?.error || t('org.wallet.error.load', 'Не удалось загрузить баланс'));
                return;
            }
            setWalletInfo(data.wallet);
        } catch (err) {
            setWalletError(err instanceof Error ? err.message : t('org.wallet.error.load', 'Не удалось загрузить баланс'));
        } finally {
            setWalletLoading(false);
        }
    }, [org, t]);

    const fetchWalletTransactions = React.useCallback(async () => {
        if (!org) return;
        try {
            setWalletTxLoading(true);
            setWalletTxError(null);
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/wallet/transactions`,
                { cache: 'no-store' }
            );
            const data = (await res.json().catch(() => null)) as
                | { transactions?: OrgWalletTx[]; error?: string }
                | null;
            if (!res.ok || !Array.isArray(data?.transactions)) {
                setWalletTxError(data?.error || t('org.wallet.error.load', 'Не удалось загрузить операции'));
                return;
            }
            setWalletTx(data.transactions);
        } catch (err) {
            setWalletTxError(err instanceof Error ? err.message : t('org.wallet.error.load', 'Не удалось загрузить операции'));
        } finally {
            setWalletTxLoading(false);
        }
    }, [org, t]);

    return {
        walletInfo,
        walletLoading,
        walletError,
        walletDialogOpen,
        walletTx,
        walletTxLoading,
        walletTxError,
        setWalletDialogOpen,
        fetchWalletInfo,
        fetchWalletTransactions,
    };
}
