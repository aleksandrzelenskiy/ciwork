import * as React from 'react';

import type {
    GetSubscriptionResponse,
    PlanConfig,
    SubscriptionBillingInfo,
    SubscriptionInfo,
} from '@/types/org';
import { withBasePath } from '@/utils/basePath';

type UseSubscriptionState = {
    subscription: SubscriptionInfo | null;
    billing: SubscriptionBillingInfo | null;
    subscriptionLoading: boolean;
    subscriptionError: string | null;
    planConfigs: PlanConfig[];
    loadSubscription: () => Promise<void>;
    loadPlanConfigs: () => Promise<void>;
    setSubscription: React.Dispatch<React.SetStateAction<SubscriptionInfo | null>>;
    setBilling: React.Dispatch<React.SetStateAction<SubscriptionBillingInfo | null>>;
    setSubscriptionError: React.Dispatch<React.SetStateAction<string | null>>;
};

export default function useSubscription(
    org: string | undefined,
    canManage: boolean
): UseSubscriptionState {
    const [subscription, setSubscription] = React.useState<SubscriptionInfo | null>(null);
    const [billing, setBilling] = React.useState<SubscriptionBillingInfo | null>(null);
    const [subscriptionLoading, setSubscriptionLoading] = React.useState(true);
    const [subscriptionError, setSubscriptionError] = React.useState<string | null>(null);
    const [planConfigs, setPlanConfigs] = React.useState<PlanConfig[]>([]);

    const loadSubscription = React.useCallback(async () => {
        if (!org || !canManage) return;
        setSubscriptionLoading(true);
        setSubscriptionError(null);
        try {
            const res = await fetch(
                withBasePath(`/api/org/${encodeURIComponent(org)}/subscription`),
                { cache: 'no-store' }
            );
            const data = (await res.json().catch(() => ({}))) as GetSubscriptionResponse | { error?: string };
            if (!res.ok || !('subscription' in data)) {
                setSubscription(null);
                setBilling(null);
                setSubscriptionError('error' in data && data.error ? data.error : 'Не удалось загрузить подписку');
                return;
            }
            setSubscription(data.subscription);
            setBilling(data.billing);
            setSubscriptionError(null);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Ошибка загрузки подписки';
            setSubscription(null);
            setBilling(null);
            setSubscriptionError(msg);
        } finally {
            setSubscriptionLoading(false);
        }
    }, [org, canManage]);

    const loadPlanConfigs = React.useCallback(async () => {
        try {
            const res = await fetch(withBasePath('/api/plans'), { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as { plans?: PlanConfig[] };
            if (!res.ok || !Array.isArray(data.plans)) {
                setPlanConfigs([]);
                return;
            }
            setPlanConfigs(data.plans);
        } catch {
            setPlanConfigs([]);
        }
    }, []);

    return {
        subscription,
        billing,
        subscriptionLoading,
        subscriptionError,
        planConfigs,
        loadSubscription,
        loadPlanConfigs,
        setSubscription,
        setBilling,
        setSubscriptionError,
    };
}
