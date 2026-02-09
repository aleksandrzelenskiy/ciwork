// src/app/org/[org]/projects/page.tsx
'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    Typography,
    Alert,
    TextField,
    IconButton,
    Snackbar,
    Stack,
    CircularProgress,
    Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useTheme } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import { useRouter, useParams } from 'next/navigation';
import { REGION_MAP, REGION_ISO_MAP } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';
import OrgOverviewPanel from '@/app/org/(protected)/[org]/components/OrgOverviewPanel';
import useOrgUsage from '@/app/org/(protected)/[org]/hooks/useOrgUsage';
import OrgPlansDialog from '@/app/org/(protected)/[org]/components/OrgPlansDialog';
import { getOrgPageStyles } from '@/app/org/(protected)/[org]/styles';
import ProjectDialog, {
    ProjectDialogValues,
    ProjectManagerOption,
} from '@/app/workspace/components/ProjectDialog';
import { UI_RADIUS } from '@/config/uiTokens';
import { roleLabel } from '@/utils/org';
import { useI18n } from '@/i18n/I18nProvider';

const getRegionInfo = (code: string) => REGION_MAP.get(code) ?? REGION_ISO_MAP.get(code);
const getRegionLabel = (code: string): string => getRegionInfo(code)?.label ?? code;
const normalizeRegionCode = (code: string): string => getRegionInfo(code)?.code ?? code;

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';

type Project = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    projectType?: 'installation' | 'document';
    managers?: string[];
    managerEmail?: string;
    photoReportFolders?: Array<{
        id: string;
        name: string;
        parentId?: string | null;
        order?: number;
    }>;
    regionCode: string;
    operator: string;
};

type GetProjectsSuccess = { projects: Project[] };
type ApiError = { error: string };
type MemberDTO = {
    _id: string;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: 'active' | 'invited' | 'requested';
};
type MembersResponse = { members: MemberDTO[] } | { error: string };

// Ответ /api/org/[org]
type OrgInfoOk = { org: { _id: string; name: string; orgSlug: string }; role: OrgRole };
type OrgInfoErr = { error: string };
type OrgInfoResp = OrgInfoOk | OrgInfoErr;

type Plan = 'basic' | 'pro' | 'business' | 'enterprise';
type SubscriptionStatus = 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';

type SubscriptionInfo = {
    orgSlug: string;
    plan: Plan;
    status: SubscriptionStatus;
    seats?: number;
    projectsLimit?: number;
    publicTasksLimit?: number;
    tasksMonthLimit?: number;
    periodStart?: string | null;
    periodEnd?: string | null;
    graceUntil?: string | null;
    graceUsedAt?: string | null;
    note?: string;
    updatedByEmail?: string;
    updatedAt: string;
};

type SubscriptionBillingInfo = {
    isActive: boolean;
    readOnly: boolean;
    reason?: string;
    graceAvailable: boolean;
    graceUntil?: string | null;
    priceRubMonthly: number;
};

type GetSubscriptionResponse = { subscription: SubscriptionInfo; billing: SubscriptionBillingInfo };
type PatchSubscriptionResponse = { ok: true; subscription: SubscriptionInfo; billing: SubscriptionBillingInfo };

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DURATION_DAYS = 10;

const parseISODate = (value?: string | null): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

export default function OrgProjectsPage() {
    const { t, locale } = useI18n();
    const router = useRouter();

    const params = useParams() as { org: string | string[] };
    const orgSlug = Array.isArray(params.org) ? params.org[0] : params.org;

    const [orgName, setOrgName] = useState<string>(orgSlug);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [billing, setBilling] = useState<SubscriptionBillingInfo | null>(null);
    const [subscriptionLoading, setSubscriptionLoading] = useState(true);
    const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
    const [startTrialLoading, setStartTrialLoading] = useState(false);
    const [plansDialogOpen, setPlansDialogOpen] = useState(false);

    // ---- Доступ (только owner/org_admin/manager) ----
    const allowedRoles: OrgRole[] = ['owner', 'org_admin', 'manager'];
    const [myRole, setMyRole] = useState<OrgRole | null>(null);
    const [accessChecked, setAccessChecked] = useState(false);
    const canManage = allowedRoles.includes(myRole ?? 'viewer');

    const checkAccessAndLoadOrg = useCallback(async () => {
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}`);
            const data = (await res.json()) as OrgInfoResp;
            if (!res.ok || 'error' in data) {
                // скрываем существование организации для не-членов
                setMyRole(null);
                setOrgName(orgSlug);
            } else {
                setMyRole(data.role);
                setOrgName(data.org.name);
            }
        } catch {
            setMyRole(null);
            setOrgName(orgSlug);
        } finally {
            setAccessChecked(true);
        }
    }, [orgSlug]);

    // ---- Проекты ----
    const loadProjects = useCallback(async () => {
        if (!canManage) return;
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects`);
            const data: GetProjectsSuccess | ApiError = await res.json();

            if (!res.ok || !('projects' in data)) {
                setErr('error' in data ? data.error : t('org.projects.error.load', 'Ошибка загрузки проектов'));
                return;
            }

            setProjects(data.projects ?? []);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('common.error.network', 'Ошибка сети');
            setErr(msg);
        } finally {
            setLoading(false);
        }
    }, [orgSlug, canManage, t]);

    const loadSubscription = useCallback(async () => {
        if (!orgSlug) return;
        setSubscriptionLoading(true);
        setSubscriptionError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription`, { cache: 'no-store' });
            const data: GetSubscriptionResponse | ApiError = await res.json();

            if (!res.ok || !('subscription' in data)) {
                const message = 'error' in data ? data.error : t('org.subscription.error.load', 'Не удалось загрузить подписку');
                setSubscriptionError(message);
                setSubscription(null);
                setBilling(null);
                return;
            }

            setSubscriptionError(null);
            setSubscription(data.subscription);
            setBilling(data.billing);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('org.subscription.error.load', 'Ошибка загрузки подписки');
            setSubscriptionError(msg);
            setSubscription(null);
            setBilling(null);
        } finally {
            setSubscriptionLoading(false);
        }
    }, [orgSlug, t]);

    useEffect(() => {
        void checkAccessAndLoadOrg();
    }, [checkAccessAndLoadOrg]);

    useEffect(() => {
        if (canManage) void loadProjects();
    }, [canManage, loadProjects]);

    useEffect(() => {
        if (!accessChecked || !canManage) return;
        void loadSubscription();
    }, [accessChecked, canManage, loadSubscription]);

    const trialEndsAt = parseISODate(subscription?.periodEnd);
    const nowTs = Date.now();
    const isTrialActive = subscription?.status === 'trial' && !!trialEndsAt && trialEndsAt.getTime() > nowTs;
    const isTrialExpired = subscription?.status === 'trial' && !isTrialActive;
    const isSubscriptionActive = billing?.isActive ?? (subscription?.status === 'active' || isTrialActive);
    const trialDaysLeft =
        isTrialActive && trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - nowTs) / DAY_MS)) : null;
    const dateLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
    const formattedTrialEnd = trialEndsAt?.toLocaleDateString(dateLocale);
    const isOwnerOrAdmin = myRole === 'owner' || myRole === 'org_admin';
    const hasTrialHistory = Boolean(subscription?.periodStart);
    const canStartTrial =
        isOwnerOrAdmin && (!subscription || (subscription.status === 'inactive' && !hasTrialHistory));
    const disableCreateButton = subscriptionLoading || !isSubscriptionActive;
    const createButtonTooltip = disableCreateButton
        ? subscriptionLoading
            ? t('org.overview.loading.subscription', 'Проверяем статус подписки…')
            : t('org.projects.disabled', 'Доступно после активации подписки или пробного периода')
        : '';
    const activeProjectsCount = projects.length;
    const projectsLimitLabel = subscription?.projectsLimit ? String(subscription.projectsLimit) : 'XX';
    const seatsLabel = subscription?.seats ? String(subscription.seats) : '—';
    const canEditOrgSettings = isOwnerOrAdmin;
    const settingsTooltip = canEditOrgSettings
        ? t('org.settings.title', 'Настройки организации')
        : t('org.settings.permissions', 'Недостаточно прав для изменения настроек');
    const formatLimitLabel = (value: number | null | undefined) =>
        typeof value === 'number' ? String(value) : '∞';

    const { usage, usageLoading } = useOrgUsage(orgSlug);
    const tasksUsedLabel = usageLoading || !usage ? '—' : String(usage.tasksUsed);
    const publicTasksUsedLabel = usageLoading || !usage ? '—' : String(usage.publicTasksUsed);
    const tasksMonthLimitLabel = formatLimitLabel(usage?.tasksLimit);
    const publicTasksLimitLabel = formatLimitLabel(usage?.publicTasksLimit);

    const theme = useTheme();
    const {
        isDarkMode,
        headerBorder,
        cardBg,
        cardBorder,
        cardShadow,
        textPrimary,
        textSecondary,
        iconBorderColor,
        iconBg,
        iconHoverBg,
        iconShadow,
        disabledIconColor,
        panelPadding,
        panelBaseSx,
        statCardSx,
        actionButtonBaseSx,
        getAlertSx,
        iconRadius,
    } = getOrgPageStyles(theme);
    const pillBg = isDarkMode ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.12)';
    const pillBorder = isDarkMode ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.2)';

    const pageWrapperSx = {
        minHeight: '100%',
        py: { xs: 4, md: 6 },
        px: { xs: 0.5, md: 4 },
        position: 'relative',
        overflow: 'hidden',
    };

    const pillSx = {
        borderRadius: UI_RADIUS.pill,
        px: 1.5,
        py: 0.4,
        fontSize: '0.75rem',
        fontWeight: 600,
        border: `1px solid ${pillBorder}`,
        backgroundColor: pillBg,
        color: textPrimary,
        letterSpacing: 0.3,
    };
    const getCardIconButtonSx = (variant: 'default' | 'danger' = 'default') => ({
        borderRadius: UI_RADIUS.sheet,
        border: `1px solid ${
            variant === 'danger'
                ? isDarkMode
                    ? 'rgba(248,113,113,0.35)'
                    : 'rgba(239,68,68,0.3)'
                : iconBorderColor
        }`,
        backgroundColor: iconBg,
        color: variant === 'danger' ? (isDarkMode ? '#fecdd3' : '#b91c1c') : textPrimary,
        boxShadow: iconShadow,
        padding: 0.5,
        backdropFilter: 'blur(12px)',
        transition: 'all 0.2s ease',
        '&:hover': {
            transform: 'translateY(-2px)',
            backgroundColor: iconHoverBg,
            color: variant === 'danger' ? '#ffffff' : textPrimary,
        },
        '&.Mui-disabled': {
            color: disabledIconColor,
        },
    });
    const renderBackdrop = (content: ReactNode) => (
        <Box sx={pageWrapperSx}>
            {content}
        </Box>
    );
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
    const subscriptionEndDate = useMemo(() => {
        if (!subscription?.periodEnd) return null;
        const date = new Date(subscription.periodEnd);
        return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(dateLocale);
    }, [dateLocale, subscription?.periodEnd]);
    const subscriptionEndLabel =
        subscription?.status && subscription.status !== 'inactive' && subscriptionEndDate
            ? t('org.subscription.activeUntil', 'Действует до {date}', { date: subscriptionEndDate })
            : null;
    const roleLabelValue = myRole ? roleLabel(myRole, t) : '—';


    // ---- Участники для менеджеров ----
    const [managerOptions, setManagerOptions] = useState<ProjectManagerOption[]>([]);
    const [managerOptionsError, setManagerOptionsError] = useState<string | null>(null);
    const [activeMembersCount, setActiveMembersCount] = useState(0);
    const managerNameByEmail = useMemo(() => {
        const entries = managerOptions.map((member) => [
            member.email.toLowerCase(),
            member.name ?? member.email,
        ]);
        return Object.fromEntries(entries) as Record<string, string>;
    }, [managerOptions]);

    const loadManagerOptions = useCallback(async () => {
        if (!orgSlug) return;
        setManagerOptionsError(null);
        try {
            const res = await fetch(
                `/api/org/${encodeURIComponent(orgSlug)}/members?status=active`,
                { cache: 'no-store' }
            );
            const data: MembersResponse = await res.json();

            if (!res.ok || !('members' in data)) {
                const message = 'error' in data ? data.error : t('org.members.error.load', 'Не удалось загрузить участников');
                setManagerOptionsError(message);
                setManagerOptions([]);
                setActiveMembersCount(0);
                return;
            }

            const activeMembers = data.members.filter((member) => member.status === 'active');
            const filtered = activeMembers.filter((member) =>
                ['owner', 'org_admin', 'manager'].includes(member.role)
            );

            setActiveMembersCount(activeMembers.length);
            setManagerOptions(
                filtered.map((member) => ({
                    email: member.userEmail,
                    name: member.userName,
                    role: member.role,
                }))
            );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('org.members.error.load', 'Ошибка загрузки участников');
            setManagerOptionsError(msg);
            setManagerOptions([]);
            setActiveMembersCount(0);
        }
    }, [orgSlug, t]);

    useEffect(() => {
        void loadManagerOptions();
    }, [loadManagerOptions]);

    // ---- Диалог проекта ----
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);
    const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create');
    const [projectDialogLoading, setProjectDialogLoading] = useState(false);
    const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

    const openCreateDialog = () => {
        setProjectDialogMode('create');
        setProjectToEdit(null);
        setProjectDialogOpen(true);
    };

    const openEditDialog = (project: Project) => {
        setProjectDialogMode('edit');
        setProjectToEdit(project);
        setProjectDialogOpen(true);
    };

    const handleProjectDialogClose = () => {
        if (projectDialogLoading) return;
        setProjectDialogOpen(false);
        setProjectToEdit(null);
    };

    const handleProjectDialogSubmit = async (values: ProjectDialogValues) => {
        if (!orgSlug) return;
        if (projectDialogMode === 'create' && (subscriptionLoading || !isSubscriptionActive)) {
            const msg = subscriptionLoading
                ? t('org.subscription.waitCheck', 'Подождите завершения проверки подписки')
                : t('org.subscription.inactiveAction', 'Подписка не активна. Активируйте тариф или триал');
            showSnack(msg, 'error');
            return;
        }
        setProjectDialogLoading(true);
        try {
            const payload = {
                name: values.name,
                key: values.key,
                description: values.description,
                projectType: values.projectType,
                regionCode: values.regionCode,
                operator: values.operator,
                managers: values.managers,
                photoReportFolders: values.photoReportFolders ?? [],
            };

            const projectRef = projectToEdit?.key || projectToEdit?._id;
            const url =
                projectDialogMode === 'edit' && projectRef
                    ? `/api/org/${encodeURIComponent(orgSlug)}/projects/${projectRef}`
                    : `/api/org/${encodeURIComponent(orgSlug)}/projects`;
            const method = projectDialogMode === 'edit' ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data: { ok: true; project: Project } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : t('org.projects.error.save', 'Не удалось сохранить проект');
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            showSnack(
                projectDialogMode === 'create'
                    ? t('org.projects.success.created', 'Проект создан')
                    : t('org.projects.success.updated', 'Проект обновлён'),
                'success'
            );
            setProjectDialogOpen(false);
            setProjectToEdit(null);
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('common.error.network', 'Ошибка сети');
            setErr(msg);
            showSnack(msg, 'error');
        } finally {
            setProjectDialogLoading(false);
        }
    };

    // ---- Удаление ----
    const [openDelete, setOpenDelete] = useState(false);
    const [deleteProject, setDeleteProject] = useState<Project | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);

    const askDelete = (p: Project) => {
        setDeleteProject(p);
        setDeleteConfirmation('');
        setOpenDelete(true);
    };

    const handleDeleteConfirm = async (): Promise<void> => {
        if (!deleteProject) return;
        if (deleteSubmitting) return;
        try {
            setDeleteSubmitting(true);
            const projectRef = deleteProject?.key || deleteProject?._id;
            if (!projectRef) {
                showSnack(t('org.projects.error.notFound', 'Проект не найден'), 'error');
                return;
            }
            const expectedKey = String(deleteProject.key || '').trim().toUpperCase();
            const typedKey = deleteConfirmation.trim().toUpperCase();
            if (!expectedKey || typedKey !== expectedKey) {
                showSnack(t('org.projects.delete.confirmCode', 'Введите код проекта для подтверждения удаления'), 'error');
                return;
            }
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects/${projectRef}`, {
                method: 'DELETE',
            });
            const data: { ok: true } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : t('org.projects.error.delete', 'Ошибка удаления проекта');
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            setOpenDelete(false);
            setDeleteProject(null);
            showSnack(t('org.projects.success.deleted', 'Проект удалён'), 'success');
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('common.error.network', 'Ошибка сети');
            setErr(msg);
            showSnack(msg, 'error');
        } finally {
            setDeleteSubmitting(false);
        }
    };

    // ---- Навигация по KEY ----
    const handleCardClick = (projectKey: string) => {
        router.push(
            `/org/${encodeURIComponent(orgSlug)}/projects/${encodeURIComponent(projectKey)}/tasks`
        );
    };

    // ---- Снекбар ----
    const [snackOpen, setSnackOpen] = useState(false);
    const [snackMsg, setSnackMsg] = useState('');
    const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');

    const showSnack = (message: string, severity: 'success' | 'error') => {
        setSnackMsg(message);
        setSnackSeverity(severity);
        setSnackOpen(true);
    };

    const handleStartTrial = async (): Promise<void> => {
        if (!orgSlug || !canStartTrial) return;
        setStartTrialLoading(true);
        setSubscriptionError(null);
        try {
            const now = new Date();
            const trialEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * DAY_MS);
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'trial',
                    periodStart: now.toISOString(),
                    periodEnd: trialEnd.toISOString(),
                }),
            });
            const data: PatchSubscriptionResponse | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : t('org.subscription.error.startTrial', 'Не удалось активировать триал');
                setSubscriptionError(msg);
                showSnack(msg, 'error');
                return;
            }

            setSubscription(data.subscription);
            setBilling(data.billing);
            setSubscriptionError(null);
            showSnack(t('org.subscription.trial.started', 'Триал активирован на 10 дней'), 'success');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('org.subscription.error.startTrial', 'Ошибка запуска триала');
            setSubscriptionError(msg);
            showSnack(msg, 'error');
        } finally {
            setStartTrialLoading(false);
        }
    };

    const handleActivateGrace = async (): Promise<void> => {
        if (!orgSlug || !(myRole === 'owner' || myRole === 'org_admin')) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription/grace`, {
                method: 'POST',
            });
            const data = (await res.json().catch(() => ({}))) as { billing?: SubscriptionBillingInfo; error?: string };
            if (!res.ok || !data.billing) {
                const msg = data?.error || t('org.subscription.error.activateGrace', 'Не удалось активировать grace');
                showSnack(msg, 'error');
                return;
            }
            setBilling(data.billing);
            showSnack(t('org.subscription.grace.activated', 'Льготный период активирован на 3 дня'), 'success');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('org.subscription.error.activateGrace', 'Ошибка активации grace');
            showSnack(msg, 'error');
        }
    };

    // ---- Рендер с учётом доступа ----
    const renderStatusPanel = (content: ReactNode) =>
        renderBackdrop(
            <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%' }}>
                <Box sx={panelBaseSx}>
                    <Box sx={{ px: panelPadding }}>{content}</Box>
                </Box>
            </Box>
        );

    const secondaryAlerts: ReactNode[] = [];
    if (managerOptionsError) {
        secondaryAlerts.push(
            <Alert key="managers" severity="warning" sx={getAlertSx('warning')}>
                {t('org.members.error.loadManagers', 'Не удалось загрузить список менеджеров: {error}', {
                    error: managerOptionsError,
                })}
            </Alert>
        );
    }
    if (err) {
        secondaryAlerts.push(
            <Alert key="projects" severity="error" sx={getAlertSx('error')}>
                {err}
            </Alert>
        );
    }

    if (!accessChecked) {
        return renderStatusPanel(
            <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={20} />
                <Typography color={textPrimary}>
                    {t('org.access.checking', 'Проверяем доступ…')}
                </Typography>
            </Stack>
        );
    }

    if (!canManage) {
        return renderStatusPanel(
            <Alert severity="error" sx={getAlertSx('error')}>
                {t('org.projects.accessDenied', 'Недостаточно прав для просмотра страницы проектов.')}
            </Alert>
        );
    }

    return renderBackdrop(
        <>
            <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <OrgOverviewPanel
                    orgName={orgName}
                    orgSlug={orgSlug}
                    settingsTooltip={settingsTooltip}
                    settingsButtonDisabled={!canEditOrgSettings}
                    canEditOrgSettings={canEditOrgSettings}
                    onOpenOrgSettings={() => {
                        if (!orgSlug) return;
                        router.push(`/org/${encodeURIComponent(orgSlug)}`);
                    }}
                    onGoToProjects={() => {
                        if (!orgSlug) return;
                        router.push(`/org/${encodeURIComponent(orgSlug)}`);
                    }}
                    onInvite={openCreateDialog}
                    disableCreationActions={disableCreateButton}
                    inviteTooltip={createButtonTooltip}
                    primaryActionLabel={t('org.projects.actions.orgSettings', 'Организация')}
                    primaryActionIcon={<BusinessIcon />}
                    secondaryActionLabel={t('org.projects.actions.newProject', 'Новый проект')}
                    secondaryActionIcon={<AddIcon />}
                    actionButtonBaseSx={actionButtonBaseSx}
                    panelBaseSx={panelBaseSx}
                    panelPadding={panelPadding}
                    statCardSx={statCardSx}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    headerBorder={headerBorder}
                    iconBorderColor={iconBorderColor}
                    iconBg={iconBg}
                    iconHoverBg={iconHoverBg}
                    iconShadow={iconShadow}
                    disabledIconColor={disabledIconColor}
                    iconRadius={iconRadius}
                    isDarkMode={isDarkMode}
                    activeProjectsCount={activeProjectsCount}
                    projectsLimitLabel={projectsLimitLabel}
                    activeMembersCount={activeMembersCount}
                    seatsLabel={seatsLabel}
                    tasksUsedLabel={tasksUsedLabel}
                    publicTasksUsedLabel={publicTasksUsedLabel}
                    tasksMonthLimitLabel={tasksMonthLimitLabel}
                    publicTasksLimitLabel={publicTasksLimitLabel}
                    subscriptionStatusLabel={subscriptionStatusLabel}
                    subscriptionStatusColor={subscriptionStatusColor}
                    subscriptionStatusDescription={subscriptionStatusDescription}
                    subscriptionEndLabel={subscriptionEndLabel}
                    roleLabel={roleLabelValue}
                    onOpenPlansDialog={() => setPlansDialogOpen(true)}
                    subscriptionError={subscriptionError}
                    subscriptionLoading={subscriptionLoading}
                    billingReadOnly={Boolean(billing?.readOnly)}
                    billingReason={billing?.reason}
                    billingGraceAvailable={Boolean(billing?.graceAvailable)}
                    isOwnerOrAdmin={isOwnerOrAdmin}
                    onActivateGrace={handleActivateGrace}
                    isSubscriptionActive={isSubscriptionActive}
                    isTrialExpired={isTrialExpired}
                    formattedTrialEnd={formattedTrialEnd}
                    canStartTrial={canStartTrial}
                    startTrialLoading={startTrialLoading}
                    onStartTrial={handleStartTrial}
                    trialDaysLeft={trialDaysLeft}
                    isTrialActive={isTrialActive}
                    getAlertSx={getAlertSx}
                />

                {secondaryAlerts.length > 0 && (
                    <Stack spacing={2}>{secondaryAlerts}</Stack>
                )}

                {loading ? (
                    <Box
                        sx={{
                            ...panelBaseSx,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 260,
                        }}
                    >
                        <CircularProgress />
                    </Box>
                ) : (
                    <Grid container spacing={{ xs: 2, md: 3 }}>
                        {projects.map((p) => {
                            const managerEmail =
                                p.managerEmail ??
                                (Array.isArray(p.managers) && p.managers.length > 0 ? p.managers[0] : '');
                            const manager = managerEmail
                                ? managerNameByEmail[managerEmail.toLowerCase()] ?? managerEmail
                                : '—';
                            const regionLabel = getRegionLabel(p.regionCode);
                            const operatorLabel = OPERATORS.find((item) => item.value === p.operator)?.label ?? p.operator;

                            return (
                                <Grid key={p._id} item xs={12} md={6} lg={4}>
                                    <Paper
                                        elevation={0}
                                        onClick={() => handleCardClick(p.key)}
                                        role="button"
                                        aria-label={t('org.projects.actions.openTasks', 'Открыть задачи проекта {name}', {
                                            name: p.name,
                                        })}
                                        sx={{
                                            p: { xs: 2, md: 2.5 },
                                            borderRadius: UI_RADIUS.surface,
                                            border: `1px solid ${cardBorder}`,
                                            backgroundColor: cardBg,
                                            boxShadow: cardShadow,
                                            backdropFilter: 'blur(26px)',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            color: textPrimary,
                                            minHeight: 240,
                                            transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                                            '&:hover': {
                                                transform: 'translateY(-6px)',
                                                boxShadow: isDarkMode
                                                    ? '0 35px 90px rgba(0,0,0,0.6)'
                                                    : '0 35px 90px rgba(15,23,42,0.18)',
                                            },
                                        }}
                                    >
                                        <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 12, right: 12 }}>
                                            <Tooltip title={t('common.edit', 'Редактировать')}>
                                                <IconButton
                                                    size="small"
                                                    aria-label={t('common.edit', 'Редактировать')}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEditDialog(p);
                                                    }}
                                                    sx={getCardIconButtonSx()}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={t('common.delete', 'Удалить')}>
                                                <IconButton
                                                    size="small"
                                                    aria-label={t('common.delete', 'Удалить')}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        askDelete(p);
                                                    }}
                                                    sx={getCardIconButtonSx('danger')}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>

                                        <Typography
                                            variant="overline"
                                            sx={{ color: textSecondary, letterSpacing: 1, display: 'block' }}
                                        >
                                            {p.key}
                                        </Typography>
                                        <Typography variant="h6" fontWeight={700} color={textPrimary}>
                                            {p.name}
                                        </Typography>

                                        {p.description && (
                                            <Typography variant="body2" color={textSecondary} sx={{ mt: 1 }}>
                                                {p.description}
                                            </Typography>
                                        )}

                                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 2 }}>
                                            <Box sx={pillSx}>{regionLabel}</Box>
                                            <Box sx={pillSx}>{operatorLabel}</Box>
                                        </Stack>

                                        <Stack spacing={1.5} sx={{ mt: 2.5 }}>
                                            <Box>
                                                <Typography
                                                    variant="caption"
                                                    sx={{ color: textSecondary, letterSpacing: 0.6 }}
                                                >
                                                    {t('org.projects.fields.manager', 'Менеджер')}
                                                </Typography>
                                                <Typography variant="body1" fontWeight={600} color={textPrimary}>
                                                    {manager}
                                                </Typography>
                                            </Box>
                                            <Stack
                                                direction={{ xs: 'column', sm: 'row' }}
                                                spacing={{ xs: 1, sm: 2 }}
                                                sx={{ width: '100%' }}
                                            >
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{ color: textSecondary, letterSpacing: 0.6 }}
                                                    >
                                                        {t('org.projects.fields.region', 'Регион')}
                                                    </Typography>
                                                    <Typography variant="body2" color={textPrimary}>
                                                        {regionLabel}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{ color: textSecondary, letterSpacing: 0.6 }}
                                                    >
                                                        {t('org.projects.fields.operator', 'Оператор')}
                                                    </Typography>
                                                    <Typography variant="body2" color={textPrimary}>
                                                        {operatorLabel}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </Box>

            <OrgPlansDialog
                open={plansDialogOpen}
                orgSlug={orgSlug}
                onClose={() => setPlansDialogOpen(false)}
            />

            <ProjectDialog
                open={projectDialogOpen}
                mode={projectDialogMode}
                loading={projectDialogLoading}
                members={managerOptions}
                onClose={handleProjectDialogClose}
                onSubmit={handleProjectDialogSubmit}
                initialData={
                    projectDialogMode === 'edit' && projectToEdit
                        ? {
                            projectId: projectToEdit._id,
                            name: projectToEdit.name,
                            key: projectToEdit.key,
                            description: projectToEdit.description ?? '',
                            projectType: projectToEdit.projectType,
                            regionCode: normalizeRegionCode(projectToEdit.regionCode),
                            operator: projectToEdit.operator,
                            managers: projectToEdit.managers ?? [],
                            photoReportFolders: projectToEdit.photoReportFolders ?? [],
                        }
                        : undefined
                }
            />

            <Dialog
                open={openDelete}
                onClose={() => {
                    if (deleteSubmitting) return;
                    setOpenDelete(false);
                }}
            >
                <DialogTitle>{t('org.projects.delete.title', 'Удалить проект без возможности восстановления?')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Alert severity="error" variant="filled">
                            {t('org.projects.delete.warning', 'ВНИМАНИЕ: удаление проекта необратимо.')}
                        </Alert>
                        <Typography>
                            {t('org.projects.delete.body', 'Проект {name} будет удален навсегда. Вместе с ним будут удалены все задачи проекта и все связанные файлы из хранилища.', {
                                name: deleteProject?.name ?? '',
                            })}
                        </Typography>
                        <TextField
                            label={t('org.projects.delete.codeLabel', 'Введите код проекта для подтверждения')}
                            placeholder="PROJECT-KEY"
                            fullWidth
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            disabled={deleteSubmitting}
                            helperText={
                                deleteProject?.key
                                    ? t('org.projects.delete.codeHint', 'Нужно ввести: {key}', { key: deleteProject.key })
                                    : t('org.projects.delete.codePlaceholder', 'Введите точный код проекта')
                            }
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDelete(false)} disabled={deleteSubmitting}>
                        {t('common.cancel', 'Отмена')}
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleDeleteConfirm}
                        disabled={
                            deleteSubmitting ||
                            !deleteProject?.key ||
                            deleteConfirmation.trim().toUpperCase() !==
                                String(deleteProject?.key || '').trim().toUpperCase()
                        }
                    >
                        {t('common.delete', 'Удалить')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackOpen}
                autoHideDuration={4000}
                onClose={() => setSnackOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Alert onClose={() => setSnackOpen(false)} severity={snackSeverity} variant="filled" sx={{ width: '100%' }}>
                    {snackMsg}
                </Alert>
            </Snackbar>
        </>
    );
}
