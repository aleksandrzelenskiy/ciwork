import * as React from 'react';

import type { OrgRole, PlanConfig, SubscriptionBillingInfo, SubscriptionInfo } from '@/types/org';
import { DAY_MS, roleLabel } from '@/utils/org';
import { useI18n } from '@/i18n/I18nProvider';

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
    roleLabel: string;
    tasksMonthLimitLabel: string;
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
    const { t, locale } = useI18n();
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
    const dateLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
    const formattedTrialEnd = trialEndsAt?.toLocaleDateString(dateLocale) ?? null;
    const trialDaysLeft =
        isTrialActive && trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - nowTs) / DAY_MS)) : null;
    const disableCreationActions = subscriptionLoading || !isSubscriptionActive;
    const creationTooltip = disableCreationActions
        ? subscriptionLoading
            ? t('org.overview.loading.subscription', 'Проверяем статус подписки…')
            : t('org.projects.disabled', 'Доступно после активации подписки или пробного периода')
        : t('org.projects.actions.create', 'Создать проект');
    const inviteTooltip = disableCreationActions
        ? subscriptionLoading
            ? t('org.overview.loading.subscription', 'Проверяем статус подписки…')
            : t('org.members.invite.disabled', 'Добавление участников доступно после активации подписки')
        : t('org.members.invite.action', 'Пригласить участника');
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
    const resolvedTasksMonthLimit =
        typeof currentPlanConfig?.tasksMonthLimit === 'number'
            ? currentPlanConfig.tasksMonthLimit
            : typeof subscription?.tasksMonthLimit === 'number'
                ? subscription.tasksMonthLimit
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
    const tasksMonthLimitLabel = formatLimitLabel(resolvedTasksMonthLimit);
    const publicTasksLimitLabel = formatLimitLabel(resolvedPublicTasksLimit);
    const subscriptionStatusLabel = subscriptionLoading
        ? t('org.subscription.checking', 'Проверяем…')
        : isSubscriptionActive
            ? isTrialActive
                ? t('org.subscription.trial', 'Пробный период')
                : t('org.subscription.active', 'Подписка активна')
            : t('org.subscription.inactive', 'Подписка не активна');
    const subscriptionStatusColor = subscriptionLoading
        ? textSecondary
            : isSubscriptionActive
            ? '#34d399'
            : '#fbbf24';
    const subscriptionEndDate = React.useMemo(() => {
        const iso = subscription?.periodEnd;
        if (!iso) return null;
        const date = new Date(iso);
        return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(dateLocale);
    }, [dateLocale, subscription?.periodEnd]);
    const subscriptionEndLabel =
        subscription?.status && subscription.status !== 'inactive' && subscriptionEndDate
            ? t('org.subscription.activeUntil', 'Действует до {date}', { date: subscriptionEndDate })
            : null;
    const subscriptionStatusDescription = subscriptionLoading
        ? t('org.subscription.loading', 'Получаем данные')
        : isTrialActive && formattedTrialEnd
            ? t('org.subscription.trialLeft', 'До {date} осталось {days} дней', {
                date: formattedTrialEnd,
                days: trialDaysLeft ?? 0,
            })
            : subscription?.plan
                ? t('org.subscription.plan', 'Тариф {plan}', { plan: subscription.plan.toUpperCase() })
                : t('org.subscription.noPlan', 'Тариф не выбран');
    const roleLabelValue = myRole ? roleLabel(myRole as OrgRole, t) : '—';
    const canEditOrgSettings = myRole === 'owner' || myRole === 'org_admin';
    const canRequestIntegrations = myRole === 'owner' || myRole === 'org_admin';
    const settingsTooltip = !canEditOrgSettings
        ? t('org.settings.permissions', 'Только владелец или администратор может менять настройки')
        : subscriptionLoading
            ? t('org.settings.loading', 'Загружаем реквизиты…')
            : t('org.settings.title', 'Настройки организации');
    const integrationRequestTooltip = !canRequestIntegrations
        ? t('org.integrations.permissions', 'Только владелец или администратор может подключать интеграции')
        : t('org.integrations.actions.connect', 'Подключить интеграцию');
    const integrationKeyTooltip = (isSuperAdmin: boolean) =>
        !isSuperAdmin
            ? t('org.integrations.permissions.superAdmin', 'Доступно только супер-администратору')
            : t('org.integrations.actions.generateKey', 'Создать ключ для интеграций');
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
        roleLabel: roleLabelValue,
        tasksMonthLimitLabel,
        publicTasksLimitLabel,
        canEditOrgSettings,
        canRequestIntegrations,
        settingsTooltip,
        integrationRequestTooltip,
        integrationKeyTooltip,
        formatExpire,
    };
}
