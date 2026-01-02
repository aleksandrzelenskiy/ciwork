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
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Radio,
    RadioGroup,
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
    periodStart?: string | null;
    periodEnd?: string | null;
    pendingPlan?: PlanCode | null;
    pendingPlanEffectiveAt?: string | null;
};

type BillingInfo = {
    isActive: boolean;
    readOnly: boolean;
    reason?: string;
    graceAvailable: boolean;
    graceUntil?: string | null;
    priceRubMonthly: number;
};

type PaymentPreview = {
    charged: number;
    credited: number;
    pending: boolean;
    balance: number;
    required: number;
    available: number;
    willFail: boolean;
    effectiveAt?: string | null;
};

type OrgInfoResponse = { org?: { name?: string }; role?: string; error?: string };
type PlansResponse = { plans: PlanConfig[] } | { error: string };
type SubscriptionResponse =
    | {
          subscription: SubscriptionInfo;
          billing: BillingInfo;
          payment?: {
              charged: number;
              credited: number;
              balance?: number;
              pending: boolean;
          };
          paymentPreview?: PaymentPreview;
      }
    | {
          error: string;
          payment?: {
              required?: number;
              available?: number;
          };
      };

const formatLimit = (value: number | null, fallback = 'Без ограничений') =>
    typeof value === 'number' ? value : fallback;
const formatDate = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('ru-RU');
};
const formatAmount = (value: number) =>
    new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
const roundCurrency = (value: number) => Math.round(value * 100) / 100;

type PlanChangeTiming = 'immediate' | 'period_end';

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
    const [changeDialogOpen, setChangeDialogOpen] = React.useState(false);
    const [changeTarget, setChangeTarget] = React.useState<PlanCode | null>(null);
    const [changeTiming, setChangeTiming] = React.useState<PlanChangeTiming>('immediate');
    const [paymentPreview, setPaymentPreview] = React.useState<PaymentPreview | null>(null);
    const [previewLoading, setPreviewLoading] = React.useState(false);

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

    const handleSwitchPlan = async (plan: PlanCode, timing: PlanChangeTiming) => {
        if (!orgSlug) return;
        setSavingPlan(plan);
        setNotice(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, changeTiming: timing }),
            });
            const payload = (await res.json().catch(() => null)) as SubscriptionResponse | { error?: string } | null;
            if (!res.ok || !payload || !('subscription' in payload)) {
                if (
                    payload &&
                    'payment' in payload &&
                    payload.payment &&
                    'required' in payload.payment &&
                    typeof payload.payment.required === 'number'
                ) {
                    const required = formatAmount(payload.payment.required);
                    const available = formatAmount(
                        typeof payload.payment.available === 'number' ? payload.payment.available : 0
                    );
                    setNotice(`Недостаточно средств: нужно ${required} ₽, доступно ${available} ₽.`);
                } else {
                    setNotice(payload && 'error' in payload ? payload.error ?? 'Не удалось сменить тариф' : 'Не удалось сменить тариф');
                }
                return;
            }
            setSubscription(payload.subscription);
            setBilling(payload.billing);
            if (payload.payment && !payload.payment.pending) {
                if (payload.payment.charged > 0) {
                    setNotice(`Тариф обновлен. Списано ${formatAmount(payload.payment.charged)} ₽.`);
                } else if (payload.payment.credited > 0) {
                    setNotice(`Тариф обновлен. Возврат ${formatAmount(payload.payment.credited)} ₽.`);
                } else {
                    setNotice('Тариф обновлен');
                }
            } else {
                setNotice('Смена тарифа запланирована');
            }
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Не удалось сменить тариф');
        } finally {
            setSavingPlan(null);
        }
    };

    const openChangeDialog = (plan: PlanCode) => {
        setChangeTarget(plan);
        setChangeTiming('immediate');
        setChangeDialogOpen(true);
    };

    const confirmChange = () => {
        if (!changeTarget) return;
        setChangeDialogOpen(false);
        void handleSwitchPlan(changeTarget, changeTiming);
    };

    const handleCancelPending = async () => {
        if (!orgSlug) return;
        setNotice(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancelPending: true }),
            });
            const payload = (await res.json().catch(() => null)) as SubscriptionResponse | { error?: string } | null;
            if (!res.ok || !payload || !('subscription' in payload)) {
                setNotice(payload && 'error' in payload ? payload.error ?? 'Не удалось отменить смену тарифа' : 'Не удалось отменить смену тарифа');
                return;
            }
            setSubscription(payload.subscription);
            setBilling(payload.billing);
            setNotice('Запланированная смена тарифа отменена');
        } catch (err) {
            setNotice(err instanceof Error ? err.message : 'Не удалось отменить смену тарифа');
        }
    };

    React.useEffect(() => {
        if (!changeDialogOpen || !orgSlug || !changeTarget) return;
        setPreviewLoading(true);
        setPaymentPreview(null);
        const controller = new AbortController();
        const run = async () => {
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(orgSlug)}/subscription?previewPlan=${changeTarget}&previewTiming=${changeTiming}`,
                    { cache: 'no-store', signal: controller.signal }
                );
                const payload = (await res.json().catch(() => null)) as SubscriptionResponse | null;
                if (res.ok && payload && 'paymentPreview' in payload) {
                    setPaymentPreview(payload.paymentPreview ?? null);
                }
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') return;
            } finally {
                setPreviewLoading(false);
            }
        };
        void run();
        return () => controller.abort();
    }, [changeDialogOpen, orgSlug, changeTarget, changeTiming]);

    const previewDelta = paymentPreview
        ? roundCurrency(paymentPreview.charged - paymentPreview.credited)
        : null;

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
                {subscription?.pendingPlan && subscription?.pendingPlanEffectiveAt && (
                    <Alert
                        severity="info"
                        action={canChangePlan ? (
                            <Button color="inherit" size="small" onClick={handleCancelPending}>
                                Отменить
                            </Button>
                        ) : undefined}
                    >
                        Запланирована смена тарифа на {subscription.pendingPlan.toUpperCase()} с {formatDate(subscription.pendingPlanEffectiveAt)}.
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
                                                disabled={!canChangePlan || savingPlan !== null || isCurrent}
                                                onClick={() => openChangeDialog(plan.plan)}
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
                <Dialog open={changeDialogOpen} onClose={() => setChangeDialogOpen(false)}>
                    <DialogTitle>Смена тарифа</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Выберите, когда применить новый тариф. При мгновенной смене мы пересчитаем остаток оплаченного периода.
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                            {previewLoading ? (
                                <Typography variant="body2">Расчет обновляется…</Typography>
                            ) : paymentPreview ? (
                                changeTiming === 'immediate' ? (
                                    previewDelta !== null && previewDelta > 0 ? (
                                        <Typography variant="body2">
                                            Списание: {formatAmount(previewDelta)} ₽ (пропорционально оставшемуся периоду).
                                        </Typography>
                                    ) : previewDelta !== null && previewDelta < 0 ? (
                                        <Typography variant="body2">
                                            Возврат на баланс: {formatAmount(Math.abs(previewDelta))} ₽.
                                        </Typography>
                                    ) : (
                                        <Typography variant="body2">
                                            Перерасчет не требуется, сумма к списанию 0 ₽.
                                        </Typography>
                                    )
                                ) : (
                                    <Typography variant="body2">
                                        Списания сейчас не будет, новый тариф применится в конце оплаченного периода.
                                    </Typography>
                                )
                            ) : (
                                <Typography variant="body2">Расчет недоступен, попробуйте позже.</Typography>
                            )}
                            {paymentPreview?.effectiveAt && (
                                <Typography variant="caption" color="text.secondary">
                                    Новый тариф вступит в силу {formatDate(paymentPreview.effectiveAt)}.
                                </Typography>
                            )}
                            {paymentPreview?.willFail && changeTiming === 'immediate' && (
                                <Typography variant="caption" color="error">
                                    Недостаточно средств: нужно {formatAmount(paymentPreview.required)} ₽, доступно {formatAmount(paymentPreview.available)} ₽.
                                </Typography>
                            )}
                        </Box>
                        <RadioGroup
                            value={changeTiming}
                            onChange={(event) => setChangeTiming(event.target.value as PlanChangeTiming)}
                        >
                        <FormControlLabel
                            value="immediate"
                            control={<Radio />}
                            label="Сразу (с перерасчетом остатка периода)"
                        />
                        <FormControlLabel
                            value="period_end"
                            control={<Radio />}
                            label="После окончания оплаченного периода"
                        />
                    </RadioGroup>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setChangeDialogOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={confirmChange} disabled={!changeTarget}>
                        Подтвердить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
