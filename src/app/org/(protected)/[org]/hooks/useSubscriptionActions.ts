import * as React from 'react';

import type { PatchSubscriptionResponse, SubscriptionBillingInfo, SubscriptionInfo } from '@/types/org';
import { DAY_MS, TRIAL_DURATION_DAYS } from '@/utils/org';

type SnackSetter = (state: { open: boolean; msg: string; sev: 'success' | 'error' | 'info' }) => void;

type UseSubscriptionActionsArgs = {
    org: string | undefined;
    setSubscription: React.Dispatch<React.SetStateAction<SubscriptionInfo | null>>;
    setBilling: React.Dispatch<React.SetStateAction<SubscriptionBillingInfo | null>>;
    setSubscriptionError: React.Dispatch<React.SetStateAction<string | null>>;
    setSnack: SnackSetter;
};

type UseSubscriptionActionsState = {
    startTrialLoading: boolean;
    startTrial: (canStartTrial: boolean) => Promise<void>;
    activateGrace: (canActivate: boolean) => Promise<void>;
};

export default function useSubscriptionActions({
    org,
    setSubscription,
    setBilling,
    setSubscriptionError,
    setSnack,
}: UseSubscriptionActionsArgs): UseSubscriptionActionsState {
    const [startTrialLoading, setStartTrialLoading] = React.useState(false);

    const startTrial = React.useCallback(
        async (canStartTrial: boolean) => {
            if (!org || !canStartTrial) return;
            setStartTrialLoading(true);
            setSubscriptionError(null);
            try {
                const now = new Date();
                const trialEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * DAY_MS);
                const res = await fetch(`/api/org/${encodeURIComponent(org)}/subscription`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'trial',
                        periodStart: now.toISOString(),
                        periodEnd: trialEnd.toISOString(),
                    }),
                });
                const data = (await res.json().catch(() => ({}))) as PatchSubscriptionResponse | { error?: string };
                if (!res.ok || !('ok' in data) || !data.ok) {
                    const msg = 'error' in data && data.error ? data.error : 'Не удалось активировать пробный период';
                    setSubscriptionError(msg);
                    setSnack({ open: true, msg, sev: 'error' });
                    return;
                }
                setSubscription(data.subscription);
                setBilling(data.billing);
                setSubscriptionError(null);
                setSnack({ open: true, msg: 'Пробный период активирован на 10 дней', sev: 'success' });
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Ошибка запуска пробного периода';
                setSubscriptionError(msg);
                setSnack({ open: true, msg, sev: 'error' });
            } finally {
                setStartTrialLoading(false);
            }
        },
        [org, setSubscription, setBilling, setSubscriptionError, setSnack]
    );

    const activateGrace = React.useCallback(
        async (canActivate: boolean) => {
            if (!org || !canActivate) return;
            setSubscriptionError(null);
            try {
                const res = await fetch(`/api/org/${encodeURIComponent(org)}/subscription/grace`, {
                    method: 'POST',
                });
                const data = (await res.json().catch(() => ({}))) as {
                    billing?: SubscriptionBillingInfo;
                    error?: string;
                };
                if (!res.ok || !data.billing) {
                    const msg = data?.error || 'Не удалось активировать grace';
                    setSnack({ open: true, msg, sev: 'error' });
                    return;
                }
                setBilling(data.billing);
                setSnack({ open: true, msg: 'Льготный период активирован на 3 дня', sev: 'success' });
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Ошибка активации grace';
                setSnack({ open: true, msg, sev: 'error' });
            }
        },
        [org, setBilling, setSubscriptionError, setSnack]
    );

    return {
        startTrialLoading,
        startTrial,
        activateGrace,
    };
}
