// src/app/org/[org]/projects/page.tsx
'use client';

import { type ReactNode, useCallback, useEffect, useState } from 'react';
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
import TopicIcon from '@mui/icons-material/Topic';
import { useRouter, useParams } from 'next/navigation';
import { REGION_MAP, REGION_ISO_MAP } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';
import ProjectDialog, {
    ProjectDialogValues,
    ProjectManagerOption,
} from '@/app/workspace/components/ProjectDialog';

const getRegionInfo = (code: string) => REGION_MAP.get(code) ?? REGION_ISO_MAP.get(code);
const getRegionLabel = (code: string): string => getRegionInfo(code)?.label ?? code;
const normalizeRegionCode = (code: string): string => getRegionInfo(code)?.code ?? code;

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';

type Project = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    managers?: string[];
    managerEmail?: string;
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
    status: 'active' | 'invited';
};
type MembersResponse = { members: MemberDTO[] } | { error: string };

const ROLE_LABELS: Record<OrgRole, string> = {
    owner: 'Владелец',
    org_admin: 'Администратор',
    manager: 'Менеджер',
    executor: 'Исполнитель',
    viewer: 'Наблюдатель',
};

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
    tasksWeeklyLimit?: number;
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
                setErr('error' in data ? data.error : 'Ошибка загрузки проектов');
                return;
            }

            setProjects(data.projects ?? []);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
        } finally {
            setLoading(false);
        }
    }, [orgSlug, canManage]);

    const loadSubscription = useCallback(async () => {
        if (!orgSlug) return;
        setSubscriptionLoading(true);
        setSubscriptionError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription`, { cache: 'no-store' });
            const data: GetSubscriptionResponse | ApiError = await res.json();

            if (!res.ok || !('subscription' in data)) {
                const message = 'error' in data ? data.error : 'Не удалось загрузить подписку';
                setSubscriptionError(message);
                setSubscription(null);
                setBilling(null);
                return;
            }

            setSubscriptionError(null);
            setSubscription(data.subscription);
            setBilling(data.billing);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка загрузки подписки';
            setSubscriptionError(msg);
            setSubscription(null);
            setBilling(null);
        } finally {
            setSubscriptionLoading(false);
        }
    }, [orgSlug]);

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
    const formattedTrialEnd = trialEndsAt?.toLocaleDateString('ru-RU');
    const isOwnerOrAdmin = myRole === 'owner' || myRole === 'org_admin';
    const hasTrialHistory = Boolean(subscription?.periodStart);
    const canStartTrial =
        isOwnerOrAdmin && (!subscription || (subscription.status === 'inactive' && !hasTrialHistory));
    const disableCreateButton = subscriptionLoading || !isSubscriptionActive;
    const createButtonTooltip = disableCreateButton
        ? subscriptionLoading
            ? 'Проверяем статус подписки…'
            : 'Кнопка доступна после активации подписки или триала'
        : '';
    const activeProjectsCount = projects.length;
    const projectsLimitLabel = subscription?.projectsLimit ? String(subscription.projectsLimit) : 'XX';

    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const headerBg = isDarkMode ? 'rgba(11,16,26,0.82)' : 'rgba(255,255,255,0.88)';
    const headerBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.12)';
    const headerShadow = isDarkMode ? '0 35px 90px rgba(0,0,0,0.65)' : '0 35px 90px rgba(15,23,42,0.2)';
    const cardBg = isDarkMode ? 'rgba(13,18,30,0.85)' : 'rgba(255,255,255,0.92)';
    const cardBorder = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.08)';
    const cardShadow = isDarkMode ? '0 35px 80px rgba(0,0,0,0.55)' : '0 35px 80px rgba(15,23,42,0.15)';
    const textPrimary = isDarkMode ? '#f8fafc' : '#0f172a';
    const textSecondary = isDarkMode ? 'rgba(226,232,240,0.78)' : 'rgba(15,23,42,0.65)';
    const iconBorderColor = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.12)';
    const iconBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)';
    const iconHoverBg = isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.95)';
    const iconShadow = isDarkMode ? '0 6px 20px rgba(0,0,0,0.45)' : '0 6px 20px rgba(15,23,42,0.12)';
    const disabledIconColor = isDarkMode ? 'rgba(148,163,184,0.6)' : 'rgba(148,163,184,0.45)';
    const buttonShadow = isDarkMode ? '0 25px 45px rgba(0,0,0,0.55)' : '0 25px 45px rgba(15,23,42,0.15)';
    const pillBg = isDarkMode ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.12)';
    const pillBorder = isDarkMode ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.2)';

    const pageWrapperSx = {
        minHeight: '100%',
        py: { xs: 4, md: 6 },
        px: { xs: 0.5, md: 4 },
        position: 'relative',
        overflow: 'hidden',
    };

    const panelBaseSx = {
        borderRadius: 4,
        p: { xs: 2, md: 3 },
        backgroundColor: headerBg,
        border: `1px solid ${headerBorder}`,
        boxShadow: headerShadow,
        color: textPrimary,
        backdropFilter: 'blur(26px)',
        position: 'relative' as const,
        overflow: 'hidden',
    };
    const statCardSx = {
        borderRadius: 3,
        px: { xs: 2, md: 2.5 },
        py: { xs: 1.25, md: 1.5 },
        border: `1px solid ${cardBorder}`,
        backgroundColor: cardBg,
        boxShadow: cardShadow,
        backdropFilter: 'blur(20px)',
    };
    const pillSx = {
        borderRadius: 999,
        px: 1.5,
        py: 0.4,
        fontSize: '0.75rem',
        fontWeight: 600,
        border: `1px solid ${pillBorder}`,
        backgroundColor: pillBg,
        color: textPrimary,
        letterSpacing: 0.3,
    };
    const actionButtonBaseSx = {
        borderRadius: 999,
        textTransform: 'none',
        fontWeight: 600,
        px: { xs: 2.5, md: 3 },
        py: 1,
        boxShadow: buttonShadow,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: buttonShadow,
        },
        '&:disabled': {
            opacity: 0.55,
            boxShadow: 'none',
        },
    };
    const getAlertSx = (tone: 'error' | 'warning' | 'info') => {
        const palette = {
            error: {
                bg: isDarkMode ? 'rgba(239,68,68,0.12)' : 'rgba(254,242,242,0.95)',
                border: isDarkMode ? 'rgba(248,113,113,0.35)' : 'rgba(239,68,68,0.25)',
            },
            warning: {
                bg: isDarkMode ? 'rgba(251,191,36,0.14)' : 'rgba(255,251,235,0.95)',
                border: isDarkMode ? 'rgba(251,191,36,0.35)' : 'rgba(251,191,36,0.25)',
            },
            info: {
                bg: isDarkMode ? 'rgba(59,130,246,0.12)' : 'rgba(219,234,254,0.9)',
                border: isDarkMode ? 'rgba(59,130,246,0.35)' : 'rgba(59,130,246,0.2)',
            },
        };
        const paletteEntry = palette[tone];
        return {
            borderRadius: 3,
            border: `1px solid ${paletteEntry.border}`,
            backgroundColor: paletteEntry.bg,
            backdropFilter: 'blur(18px)',
            color: textPrimary,
            '& .MuiAlert-icon': {
                color: paletteEntry.border,
            },
        };
    };
    const getCardIconButtonSx = (variant: 'default' | 'danger' = 'default') => ({
        borderRadius: '12px',
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
    const subscriptionStatusDescription = subscriptionLoading
        ? 'Получаем данные'
        : isTrialActive && formattedTrialEnd
            ? `До ${formattedTrialEnd} осталось ${trialDaysLeft} дней`
            : subscription?.plan
                ? `Тариф ${subscription.plan.toUpperCase()}`
                : 'Тариф не выбран';
    const roleLabel = myRole ? ROLE_LABELS[myRole] ?? myRole : '—';


    // ---- Участники для менеджеров ----
    const [managerOptions, setManagerOptions] = useState<ProjectManagerOption[]>([]);
    const [managerOptionsError, setManagerOptionsError] = useState<string | null>(null);

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
                const message = 'error' in data ? data.error : 'Не удалось загрузить участников';
                setManagerOptionsError(message);
                setManagerOptions([]);
                return;
            }

            const filtered = data.members
                .filter((member) => member.status === 'active')
                .filter((member) => ['owner', 'org_admin', 'manager'].includes(member.role));

            setManagerOptions(
                filtered.map((member) => ({
                    email: member.userEmail,
                    name: member.userName,
                    role: member.role,
                }))
            );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка загрузки участников';
            setManagerOptionsError(msg);
            setManagerOptions([]);
        }
    }, [orgSlug]);

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
                ? 'Подождите завершения проверки подписки'
                : 'Подписка не активна. Активируйте тариф или триал';
            showSnack(msg, 'error');
            return;
        }
        setProjectDialogLoading(true);
        try {
            const payload = {
                name: values.name,
                key: values.key,
                description: values.description,
                regionCode: values.regionCode,
                operator: values.operator,
                managers: values.managers,
            };

            const url =
                projectDialogMode === 'edit' && projectToEdit?._id
                    ? `/api/org/${encodeURIComponent(orgSlug)}/projects/${projectToEdit._id}`
                    : `/api/org/${encodeURIComponent(orgSlug)}/projects`;
            const method = projectDialogMode === 'edit' ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data: { ok: true; project: Project } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : 'Не удалось сохранить проект';
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            showSnack(
                projectDialogMode === 'create' ? 'Проект создан' : 'Проект обновлён',
                'success'
            );
            setProjectDialogOpen(false);
            setProjectToEdit(null);
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
            showSnack(msg, 'error');
        } finally {
            setProjectDialogLoading(false);
        }
    };

    // ---- Удаление ----
    const [openDelete, setOpenDelete] = useState(false);
    const [deleteProject, setDeleteProject] = useState<Project | null>(null);

    const askDelete = (p: Project) => {
        setDeleteProject(p);
        setOpenDelete(true);
    };

    const handleDeleteConfirm = async (): Promise<void> => {
        if (!deleteProject) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects/${deleteProject._id}`, {
                method: 'DELETE',
            });
            const data: { ok: true } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : 'Ошибка удаления проекта';
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            setOpenDelete(false);
            setDeleteProject(null);
            showSnack('Проект удалён', 'success');
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
            showSnack(msg, 'error');
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
                const msg = 'error' in data ? data.error : 'Не удалось активировать триал';
                setSubscriptionError(msg);
                showSnack(msg, 'error');
                return;
            }

            setSubscription(data.subscription);
            setBilling(data.billing);
            setSubscriptionError(null);
            showSnack('Триал активирован на 10 дней', 'success');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка запуска триала';
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
                const msg = data?.error || 'Не удалось активировать grace';
                showSnack(msg, 'error');
                return;
            }
            setBilling(data.billing);
            showSnack('Grace-период активирован на 3 дня', 'success');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка активации grace';
            showSnack(msg, 'error');
        }
    };

    // ---- Рендер с учётом доступа ----
    const renderStatusPanel = (content: ReactNode) =>
        renderBackdrop(
            <Box sx={{ maxWidth: 720, mx: 'auto', width: '100%' }}>
                <Box sx={panelBaseSx}>{content}</Box>
            </Box>
        );

    const subscriptionAlerts: ReactNode[] = [];
    if (subscriptionError) {
        subscriptionAlerts.push(
            <Alert key="sub-error" severity="error" sx={getAlertSx('error')}>
                Не удалось получить статус подписки: {subscriptionError}
            </Alert>
        );
    }
    if (!subscriptionError && subscriptionLoading) {
        subscriptionAlerts.push(
            <Alert key="sub-loading" severity="info" sx={getAlertSx('info')}>
                Проверяем статус подписки…
            </Alert>
        );
    }
    if (!subscriptionError && !subscriptionLoading && billing?.readOnly) {
        subscriptionAlerts.push(
            <Alert
                key="sub-billing-readonly"
                severity="warning"
                sx={getAlertSx('warning')}
                action={
                    billing.graceAvailable && (myRole === 'owner' || myRole === 'org_admin') ? (
                        <Button
                            size="small"
                            variant="contained"
                            onClick={handleActivateGrace}
                            sx={{
                                ...actionButtonBaseSx,
                                px: 2,
                                py: 0.6,
                                backgroundImage: 'linear-gradient(120deg, #f97316, #facc15)',
                                color: '#2f1000',
                            }}
                        >
                            Grace 3 дня
                        </Button>
                    ) : undefined
                }
            >
                {billing.reason ?? 'Доступ ограничен: недостаточно средств'}
            </Alert>
        );
    }
    if (!subscriptionError && !subscriptionLoading && !isSubscriptionActive) {
        subscriptionAlerts.push(
            <Alert key="sub-inactive" severity="warning" sx={getAlertSx('warning')}>
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                >
                    <Box>
                        <Typography fontWeight={600} color={textPrimary}>
                            Подписка не активна
                        </Typography>
                        {isTrialExpired && formattedTrialEnd && (
                            <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                Пробный период завершился {formattedTrialEnd}.
                            </Typography>
                        )}
                        <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                            Получите бесплатный 10-дневный период PRO, чтобы запускать проекты без ограничений.
                        </Typography>
                        {!canStartTrial && (
                            <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                Обратитесь к владельцу организации, чтобы активировать подписку.
                            </Typography>
                        )}
                    </Box>
                    {canStartTrial && (
                        <Button
                            variant="contained"
                            onClick={handleStartTrial}
                            disabled={startTrialLoading}
                            sx={{
                                ...actionButtonBaseSx,
                                px: { xs: 2.25, md: 2.75 },
                                py: 0.9,
                                backgroundImage: 'linear-gradient(120deg, #f97316, #facc15)',
                                color: '#2f1000',
                            }}
                        >
                            {startTrialLoading ? 'Запускаем…' : 'Активировать'}
                        </Button>
                    )}
                </Stack>
            </Alert>
        );
    }
    if (!subscriptionError && !subscriptionLoading && isTrialActive) {
        subscriptionAlerts.push(
            <Alert key="sub-trial" severity="info" sx={getAlertSx('info')}>
                Пробный период активен до {formattedTrialEnd ?? '—'}
                {typeof trialDaysLeft === 'number' && (
                    <Typography component="span" sx={{ ml: 0.5 }}>
                        (осталось {trialDaysLeft} дн.)
                    </Typography>
                )}
            </Alert>
        );
    }

    const secondaryAlerts: ReactNode[] = [];
    if (managerOptionsError) {
        secondaryAlerts.push(
            <Alert key="managers" severity="warning" sx={getAlertSx('warning')}>
                Не удалось загрузить список менеджеров: {managerOptionsError}
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
                <Typography color={textPrimary}>Проверяем доступ…</Typography>
            </Stack>
        );
    }

    if (!canManage) {
        return renderStatusPanel(
            <Alert severity="error" sx={getAlertSx('error')}>
                Недостаточно прав для просмотра страницы проектов.
            </Alert>
        );
    }

    return renderBackdrop(
        <>
            <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box
                    sx={{
                        ...panelBaseSx,
                        '&::after': {
                            content: '""',
                            position: 'absolute',
                            inset: 0,
                            background: isDarkMode
                                ? 'linear-gradient(120deg, rgba(59,130,246,0.18), transparent 60%)'
                                : 'linear-gradient(120deg, rgba(59,130,246,0.15), transparent 55%)',
                            pointerEvents: 'none',
                        },
                    }}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={{ xs: 2, md: 3 }}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Box sx={{ width: '100%' }}>
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                                <Box
                                    sx={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isDarkMode
                                            ? 'rgba(59,130,246,0.18)'
                                            : 'rgba(59,130,246,0.15)',
                                        color: isDarkMode ? '#93c5fd' : '#1d4ed8',
                                        boxShadow: iconShadow,
                                    }}
                                >
                                    <TopicIcon />
                                </Box>
                                <Typography
                                    variant="h5"
                                    fontWeight={700}
                                    color={textPrimary}
                                    sx={{ fontSize: { xs: '1.55rem', md: '1.95rem' } }}
                                >
                                    {orgName} - Проекты
                                </Typography>
                            </Stack>
                            <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                Создайте проект. Выберите регион и оператора и управляйте задачами максимально эффективно!
                            </Typography>
                        </Box>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.25}
                            alignItems={{ xs: 'stretch', sm: 'center' }}
                            sx={{ width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap', rowGap: 1 }}
                        >
                            <Button
                                variant="outlined"
                                startIcon={<BusinessIcon />}
                                onClick={() => {
                                    if (!orgSlug) return;
                                    router.push(`/org/${encodeURIComponent(orgSlug)}`);
                                }}
                                sx={{
                                    ...actionButtonBaseSx,
                                    borderColor: headerBorder,
                                    color: textPrimary,
                                    backgroundColor: isDarkMode
                                        ? 'rgba(15,18,28,0.65)'
                                        : 'rgba(255,255,255,0.85)',
                                }}
                            >
                                Организация
                            </Button>
                            <Tooltip title={createButtonTooltip} disableHoverListener={!createButtonTooltip}>
                                <span style={{ display: 'inline-flex' }}>
                                    <Button
                                        variant="contained"
                                        disableElevation
                                        startIcon={<AddIcon />}
                                        onClick={openCreateDialog}
                                        disabled={disableCreateButton}
                                        sx={{
                                            ...actionButtonBaseSx,
                                            border: 'none',
                                            color: '#ffffff',
                                            backgroundImage: disableCreateButton
                                                ? isDarkMode
                                                    ? 'linear-gradient(120deg, rgba(148,163,184,0.4), rgba(100,116,139,0.35))'
                                                    : 'linear-gradient(120deg, rgba(148,163,184,0.3), rgba(100,116,139,0.25))'
                                                : 'linear-gradient(120deg, #3b82f6, #6366f1)',
                                        }}
                                    >
                                        Новый проект
                                    </Button>
                                </span>
                            </Tooltip>
                        </Stack>
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} sx={{ mt: { xs: 2.5, md: 3 } }}>
                        <Box sx={statCardSx}>
                            <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                                Активные проекты
                            </Typography>
                            <Typography variant="h4" fontWeight={700} color={textPrimary}>
                                {activeProjectsCount}
                            </Typography>
                            <Typography variant="body2" color={textSecondary}>
                                из {projectsLimitLabel}
                            </Typography>
                        </Box>
                        <Box sx={statCardSx}>
                            <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                                Статус подписки
                            </Typography>
                            <Typography variant="h6" fontWeight={600} sx={{ color: subscriptionStatusColor }}>
                                {subscriptionStatusLabel}
                            </Typography>
                            <Typography variant="body2" color={textSecondary}>
                                {subscriptionStatusDescription}
                            </Typography>
                        </Box>
                        <Box sx={statCardSx}>
                            <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                                Ваша роль
                            </Typography>
                            <Typography variant="h6" fontWeight={600} color={textPrimary}>
                                {roleLabel}
                            </Typography>
                            <Typography variant="body2" color={textSecondary}>
                                Организация {orgName}
                            </Typography>
                        </Box>
                    </Stack>
                </Box>

                {subscriptionAlerts.length > 0 && (
                    <Stack spacing={2}>{subscriptionAlerts}</Stack>
                )}

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
                            const manager =
                                p.managerEmail ??
                                (Array.isArray(p.managers) && p.managers.length > 0 ? p.managers[0] : '—');
                            const regionLabel = getRegionLabel(p.regionCode);
                            const operatorLabel = OPERATORS.find((item) => item.value === p.operator)?.label ?? p.operator;

                            return (
                                <Grid key={p._id} item xs={12} md={6} lg={4}>
                                    <Paper
                                        elevation={0}
                                        onClick={() => handleCardClick(p.key)}
                                        role="button"
                                        aria-label={`Открыть задачи проекта ${p.name}`}
                                        sx={{
                                            p: { xs: 2, md: 2.5 },
                                            borderRadius: 4,
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
                                            <Tooltip title="Редактировать">
                                                <IconButton
                                                    size="small"
                                                    aria-label="Редактировать"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEditDialog(p);
                                                    }}
                                                    sx={getCardIconButtonSx()}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Удалить">
                                                <IconButton
                                                    size="small"
                                                    aria-label="Удалить"
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
                                                    Менеджер
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
                                                        Регион
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
                                                        Оператор
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
                            regionCode: normalizeRegionCode(projectToEdit.regionCode),
                            operator: projectToEdit.operator,
                            managers: projectToEdit.managers ?? [],
                        }
                        : undefined
                }
            />

            <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
                <DialogTitle>Удалить проект?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Это действие нельзя отменить. Удалить проект <strong>{deleteProject?.name}</strong>?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDelete(false)}>Отмена</Button>
                    <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
                        Удалить
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
