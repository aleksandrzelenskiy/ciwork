'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    Divider,
    Stack,
    Typography,
} from '@mui/material';

type PlanCode = 'basic' | 'pro' | 'business' | 'enterprise';

type PlanConfig = {
    plan: PlanCode;
    title: string;
    priceRubMonthly: number;
    projectsLimit: number | null;
    seatsLimit: number | null;
    tasksWeeklyLimit: number | null;
    storageIncludedGb: number | null;
    storageOverageRubPerGbMonth: number;
    storagePackageGb: number | null;
    storagePackageRubMonthly: number | null;
    features: string[];
};

type SubscriptionInfo = {
    plan: PlanCode;
    status: string;
};

type BillingInfo = {
    isActive: boolean;
    readOnly: boolean;
    reason?: string;
    graceAvailable: boolean;
    graceUntil?: string | null;
    priceRubMonthly: number;
};

type OrgInfoResponse = { org?: { name?: string }; role?: string; error?: string };
type PlansResponse = { plans: PlanConfig[] } | { error: string };
type SubscriptionResponse = { subscription: SubscriptionInfo; billing: BillingInfo } | { error: string };

const formatLimit = (value: number | null, fallback = 'Без ограничений') =>
    typeof value === 'number' ? value : fallback;

export default function OrgPlansPage() {
    const params = useParams<{ org: string }>();
    const orgSlug = params?.org;
    const [plans, setPlans] = React.useState<PlanConfig[]>([]);
    const [subscription, setSubscription] = React.useState<SubscriptionInfo | null>(null);
    const [billing, setBilling] = React.useState<BillingInfo | null>(null);
    const [orgName, setOrgName] = React.useState<string>('');
    const [role, setRole] = React.useState<string>('');
    const [loading, setLoading] = React.useState(true);
    const [savingPlan, setSavingPlan] = React.useState<PlanCode | null>(null);
    const [error, setError] = React.useState<string | null>(null);
    const [notice, setNotice] = React.useState<string | null>(null);

    const canChangePlan = role === 'owner' || role === 'org_admin';
    const currentPlanConfig = plans.find((plan) => plan.plan === subscription?.plan) ?? plans[0];

    const loadData = React.useCallback(async () => {
        if (!orgSlug) return;
        setLoading(true);
        setError(null);
        try {
            const [plansRes, subRes, orgRes] = await Promise.all([
                fetch('/api/plans', { cache: 'no-store' }),
                fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription`, { cache: 'no-store' }),
                fetch(`/api/org/${encodeURIComponent(orgSlug)}`, { cache: 'no-store' }),
            ]);
            const plansPayload = (await plansRes.json().catch(() => null)) as PlansResponse | null;
            const subPayload = (await subRes.json().catch(() => null)) as SubscriptionResponse | null;
            const orgPayload = (await orgRes.json().catch(() => null)) as OrgInfoResponse | null;

            if (!plansRes.ok || !plansPayload || !('plans' in plansPayload)) {
                setError(plansPayload && 'error' in plansPayload ? plansPayload.error ?? 'Не удалось загрузить тарифы' : 'Не удалось загрузить тарифы');
                return;
            }
            if (!subRes.ok || !subPayload || !('subscription' in subPayload)) {
                setError(subPayload && 'error' in subPayload ? subPayload.error ?? 'Не удалось загрузить подписку' : 'Не удалось загрузить подписку');
                return;
            }

            setPlans(plansPayload.plans);
            setSubscription(subPayload.subscription);
            setBilling(subPayload.billing);
            setOrgName(orgPayload?.org?.name ?? orgSlug ?? '');
            setRole(orgPayload?.role ?? '');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
        } finally {
            setLoading(false);
        }
    }, [orgSlug]);

    React.useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleSwitchPlan = async (plan: PlanCode) => {
        if (!orgSlug) return;
        setSavingPlan(plan);
        setNotice(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, status: 'active' }),
            });
            const payload = (await res.json().catch(() => null)) as SubscriptionResponse | { error?: string } | null;
            if (!res.ok || !payload || !('subscription' in payload)) {
                setNotice(payload && 'error' in payload ? payload.error ?? 'Не удалось сменить тариф' : 'Не удалось сменить тариф');
                return;
            }
            setSubscription(payload.subscription);
            setBilling(payload.billing);
            setNotice('Тариф обновлен');
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Не удалось сменить тариф');
        } finally {
            setSavingPlan(null);
        }
    };

    const handleActivateGrace = async () => {
        if (!orgSlug) return;
        setSavingPlan('basic');
        setNotice(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription/grace`, {
                method: 'POST',
            });
            const payload = (await res.json().catch(() => null)) as { billing?: BillingInfo; error?: string } | null;
            if (!res.ok || !payload?.billing) {
                setNotice(payload?.error ?? 'Не удалось активировать grace');
                return;
            }
            setBilling(payload.billing);
            setNotice('Grace активирован на 3 дня');
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Не удалось активировать grace');
        } finally {
            setSavingPlan(null);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
            <Stack spacing={3} sx={{ maxWidth: 1100, mx: 'auto' }}>
                <Box>
                    <Typography variant="h4" fontWeight={700}>
                        Тарифы {orgName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Выберите подходящий тариф или докупите хранилище при необходимости.
                    </Typography>
                </Box>

                {billing?.readOnly && (
                    <Alert severity="warning" action={billing.graceAvailable && canChangePlan ? (
                        <Button color="inherit" size="small" onClick={handleActivateGrace}>
                            Grace на 3 дня
                        </Button>
                    ) : undefined}>
                        {billing.reason ?? 'Доступ ограничен до оплаты подписки'}
                    </Alert>
                )}
                {notice && <Alert severity="info">{notice}</Alert>}

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    {plans.map((plan) => {
                        const isCurrent = subscription?.plan === plan.plan;
                        return (
                            <Card key={plan.plan} sx={{ flex: 1, borderColor: isCurrent ? '#3b82f6' : 'divider', borderWidth: 1 }}>
                                <CardHeader
                                    title={plan.title}
                                    subheader={plan.priceRubMonthly > 0 ? `${plan.priceRubMonthly} ₽ / мес` : 'Бесплатно'}
                                />
                                <CardContent>
                                    <Stack spacing={1.5}>
                                        <Typography variant="body2">
                                            Проекты: {formatLimit(plan.projectsLimit)}
                                        </Typography>
                                        <Typography variant="body2">
                                            Рабочие места: {formatLimit(plan.seatsLimit)}
                                        </Typography>
                                        <Typography variant="body2">
                                            Задачи/нед: {formatLimit(plan.tasksWeeklyLimit)}
                                        </Typography>
                                        <Typography variant="body2">
                                            Хранилище: {formatLimit(plan.storageIncludedGb, 'По договоренности')} GB
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Сверх лимита: {plan.storageOverageRubPerGbMonth} ₽/GB/мес (помесячно, списание по часам)
                                        </Typography>
                                        <Divider />
                                        <Stack spacing={0.5}>
                                            {plan.features.map((feature, idx) => (
                                                <Typography key={`${plan.plan}-feature-${idx}`} variant="body2" color="text.secondary">
                                                    {feature}
                                                </Typography>
                                            ))}
                                        </Stack>
                                        {plan.plan === 'enterprise' ? (
                                            <Button variant="outlined" fullWidth disabled>
                                                Индивидуально
                                            </Button>
                                        ) : (
                                            <Button
                                                variant={isCurrent ? 'outlined' : 'contained'}
                                                fullWidth
                                                disabled={!canChangePlan || savingPlan !== null}
                                                onClick={() => handleSwitchPlan(plan.plan)}
                                            >
                                                {isCurrent ? 'Текущий тариф' : 'Перейти'}
                                            </Button>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>

                <Card variant="outlined">
                    <CardHeader title="Дополнительное хранилище" />
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography variant="body2" color="text.secondary">
                                Пакеты дают скидку на доп. объём по сравнению с почасовым списанием.
                            </Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                                <Box>
                                    <Typography fontWeight={600}>
                                        Пакет {currentPlanConfig?.storagePackageGb ?? 0} GB
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {currentPlanConfig?.storagePackageRubMonthly ?? 0} ₽ / мес (списывается пропорционально оставшимся часам)
                                    </Typography>
                                </Box>
                                <Button
                                    variant="contained"
                                    disabled={
                                        !canChangePlan ||
                                        savingPlan !== null ||
                                        !currentPlanConfig ||
                                        !currentPlanConfig.storagePackageGb ||
                                        !currentPlanConfig.storagePackageRubMonthly
                                    }
                                    onClick={async () => {
                                        if (!orgSlug) return;
                                        setSavingPlan('basic');
                                        setNotice(null);
                                        const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/storage/packages`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ quantity: 1 }),
                                        });
                                        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
                                        if (!res.ok) {
                                            setNotice(payload?.error ?? 'Не удалось купить пакет');
                                        } else {
                                            setNotice('Пакет подключен');
                                        }
                                        setSavingPlan(null);
                                    }}
                                >
                                    Купить пакет
                                </Button>
                            </Stack>
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>
        </Box>
    );
}
