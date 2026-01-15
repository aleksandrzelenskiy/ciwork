import * as React from 'react';

import type { OrgRole, PlanConfig, SubscriptionBillingInfo, SubscriptionInfo } from '@/types/org';
import { DAY_MS, roleLabelRu } from '@/utils/org';

type UseOrgDerivedStateArgs = {
    subscription: SubscriptionInfo | null;
    billing: SubscriptionBillingInfo | null;
    subscriptionLoading: boolean;
    planConfigs: PlanConfig[];
    myRole: string | null;
    textSecondary: string;
};

type UseOrgDerivedState = {
    trialEndsAt: Date | null;
    isTrialActive: boolean;
    isTrialExpired: boolean;
    isOwnerOrAdmin: boolean;
    hasTrialHistory: boolean;
    canStartTrial: boolean;
    isSubscriptionActive: boolean;
    formattedTrialEnd: string | null;
    trialDaysLeft: number | null;
    disableCreationActions: boolean;
    creationTooltip: string;
    inviteTooltip: string;
    currentPlanConfig: PlanConfig | undefined;
    resolvedProjectsLimit: number | null;
    resolvedSeatsLimit: number | null;
    projectsLimitLabel: string;
    seatsLabel: string;
    subscriptionStatusLabel: string;
    subscriptionStatusColor: string;
    subscriptionStatusDescription: string;
    subscriptionEndLabel: string | null;
    roleLabelRu: string;
    tasksWeeklyLimitLabel: string;
    publicTasksLimitLabel: string;
    canEditOrgSettings: boolean;
    canRequestIntegrations: boolean;
    settingsTooltip: string;
    integrationRequestTooltip: string;
    integrationKeyTooltip: (isSuperAdmin: boolean) => string;
    formatExpire: (iso?: string) => string;
};

export default function useOrgDerivedState({
    subscription,
    billing,
    subscriptionLoading,
    planConfigs,
    myRole,
    textSecondary,
}: UseOrgDerivedStateArgs): UseOrgDerivedState {
    const trialEndsAt = React.useMemo(() => {
        const iso = subscription?.periodEnd;
        if (!iso) return null;
        const date = new Date(iso);
        return Number.isNaN(date.getTime()) ? null : date;
    }, [subscription?.periodEnd]);

    const nowTs = Date.now();
    const isTrialActive = subscription?.status === 'trial' && !!trialEndsAt && trialEndsAt.getTime() > nowTs;
    const isTrialExpired = subscription?.status === 'trial' && !isTrialActive;
    const isOwnerOrAdmin = myRole === 'owner' || myRole === 'org_admin';
    const hasTrialHistory = Boolean(subscription?.periodStart);
    const canStartTrial = isOwnerOrAdmin && (!subscription || (subscription.status === 'inactive' && !hasTrialHistory));
    const isSubscriptionActive = billing?.isActive ?? (subscription?.status === 'active' || isTrialActive);
    const formattedTrialEnd = trialEndsAt?.toLocaleDateString('ru-RU') ?? null;
    const trialDaysLeft =
        isTrialActive && trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - nowTs) / DAY_MS)) : null;
    const disableCreationActions = subscriptionLoading || !isSubscriptionActive;
    const creationTooltip = disableCreationActions
        ? subscriptionLoading
            ? 'Проверяем статус подписки…'
            : 'Доступно после активации подписки или пробного периода'
        : 'Создать проект';
    const inviteTooltip = disableCreationActions
        ? subscriptionLoading
            ? 'Проверяем статус подписки…'
            : 'Добавление участников доступно после активации подписки'
        : 'Пригласить участника';
    const currentPlanConfig = planConfigs.find((planConfig) => planConfig.plan === (subscription?.plan ?? 'basic'));
    const resolvedProjectsLimit =
        typeof currentPlanConfig?.projectsLimit === 'number'
            ? currentPlanConfig.projectsLimit
            : typeof subscription?.projectsLimit === 'number'
                ? subscription.projectsLimit
                : null;
    const resolvedSeatsLimit =
        typeof currentPlanConfig?.seatsLimit === 'number'
            ? currentPlanConfig.seatsLimit
            : typeof subscription?.seats === 'number'
                ? subscription.seats
                : null;
    const resolvedTasksWeeklyLimit =
        typeof currentPlanConfig?.tasksWeeklyLimit === 'number'
            ? currentPlanConfig.tasksWeeklyLimit
            : typeof subscription?.tasksWeeklyLimit === 'number'
                ? subscription.tasksWeeklyLimit
                : null;
    const resolvedPublicTasksLimit =
        typeof currentPlanConfig?.publicTasksMonthlyLimit === 'number'
            ? currentPlanConfig.publicTasksMonthlyLimit
            : typeof subscription?.publicTasksLimit === 'number'
                ? subscription.publicTasksLimit
                : null;
    const formatLimitLabel = (value: number | null) => (typeof value === 'number' ? String(value) : '∞');
    const projectsLimitLabel = formatLimitLabel(resolvedProjectsLimit);
    const seatsLabel = formatLimitLabel(resolvedSeatsLimit);
    const tasksWeeklyLimitLabel = formatLimitLabel(resolvedTasksWeeklyLimit);
    const publicTasksLimitLabel = formatLimitLabel(resolvedPublicTasksLimit);
    const subscriptionStatusLabel = subscriptionLoading
        ? 'Проверяем…'
        : isSubscriptionActive
            ? isTrialActive
                ? 'Пробный период'
                : 'Подписка активна'
            : 'Подписка не активна';
    const subscriptionStatusColor = subscriptionLoading
        ? textSecondary
            : isSubscriptionActive
            ? '#34d399'
            : '#fbbf24';
    const subscriptionEndDate = React.useMemo(() => {
        const iso = subscription?.periodEnd;
        if (!iso) return null;
        const date = new Date(iso);
        return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('ru-RU');
    }, [subscription?.periodEnd]);
    const subscriptionEndLabel =
        subscription?.status && subscription.status !== 'inactive' && subscriptionEndDate
            ? `Действует до ${subscriptionEndDate}`
            : null;
    const subscriptionStatusDescription = subscriptionLoading
        ? 'Получаем данные'
        : isTrialActive && formattedTrialEnd
            ? `До ${formattedTrialEnd} осталось ${trialDaysLeft} дней`
            : subscription?.plan
                ? `Тариф ${subscription.plan.toUpperCase()}`
                : 'Тариф не выбран';
    const roleLabelRuLabel = myRole ? roleLabelRu(myRole as OrgRole) : '—';
    const canEditOrgSettings = myRole === 'owner' || myRole === 'org_admin';
    const canRequestIntegrations = myRole === 'owner' || myRole === 'org_admin';
    const settingsTooltip = !canEditOrgSettings
        ? 'Только владелец или администратор может менять настройки'
        : subscriptionLoading
            ? 'Загружаем реквизиты…'
            : 'Настройки организации';
    const integrationRequestTooltip = !canRequestIntegrations
        ? 'Только владелец или администратор может подключать интеграции'
        : 'Подключить интеграцию';
    const integrationKeyTooltip = (isSuperAdmin: boolean) =>
        !isSuperAdmin ? 'Доступно только супер-администратору' : 'Создать ключ для интеграций';
    const formatExpire = (iso?: string) => {
        if (!iso) return '';
        const date = new Date(iso);
        if (isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    return {
        trialEndsAt,
        isTrialActive,
        isTrialExpired,
        isOwnerOrAdmin,
        hasTrialHistory,
        canStartTrial,
        isSubscriptionActive,
        formattedTrialEnd,
        trialDaysLeft,
        disableCreationActions,
        creationTooltip,
        inviteTooltip,
        currentPlanConfig,
        resolvedProjectsLimit,
        resolvedSeatsLimit,
        projectsLimitLabel,
        seatsLabel,
        subscriptionStatusLabel,
        subscriptionStatusColor,
        subscriptionStatusDescription,
        subscriptionEndLabel,
        roleLabelRu: roleLabelRuLabel,
        tasksWeeklyLimitLabel,
        publicTasksLimitLabel,
        canEditOrgSettings,
        canRequestIntegrations,
        settingsTooltip,
        integrationRequestTooltip,
        integrationKeyTooltip,
        formatExpire,
    };
}
