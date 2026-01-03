// src/app/org/[org]/page.tsx
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box, Card, CardHeader, CardContent, Stack,
    Snackbar, Alert, Table, TableHead, TableRow, TableCell,
    TableBody, Chip, IconButton, Tooltip, Typography,
    CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button,
    MenuItem,
} from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BusinessIcon from '@mui/icons-material/Business';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LinkIcon from '@mui/icons-material/Link';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import CancelIcon from '@mui/icons-material/Cancel';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SettingsIcon from '@mui/icons-material/Settings';
import PreviewIcon from '@mui/icons-material/Preview';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

import InviteMemberForm from '@/app/workspace/components/InviteMemberForm';
import ProjectDialog, {
    ProjectDialogValues,
    ProjectManagerOption,
} from '@/app/workspace/components/ProjectDialog';
import OrgSetDialog, {
    OrgSettingsFormValues,
    defaultOrgSettings,
} from '@/app/workspace/components/OrgSetDialog';
import { REGION_MAP, REGION_ISO_MAP } from '@/app/utils/regions';
import OrgWalletTransactionsDialog from '@/features/org/OrgWalletTransactionsDialog';
import OrgStorageUsageCard from '@/features/org/OrgStorageUsageCard';
import OrgPlansPanel from '@/features/org/OrgPlansPanel';

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';
type MemberStatus = 'active' | 'invited';

type MemberDTO = {
    _id: string;
    orgSlug: string;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: MemberStatus;
    inviteToken?: string;
    inviteExpiresAt?: string;
};

type ProjectDTO = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    managers?: string[];
    managerEmail?: string;
    regionCode: string;
    operator: string;
};

type Plan = 'basic' | 'pro' | 'business' | 'enterprise';
type SubscriptionStatus = 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';

type PlanConfig = {
    plan: Plan;
    projectsLimit: number | null;
    seatsLimit: number | null;
    tasksWeeklyLimit: number | null;
    publicTasksMonthlyLimit: number | null;
};

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
type OrgWalletInfo = { balance: number; currency: string };
type OrgWalletTx = {
    id: string;
    amount: number;
    type: string;
    source: string;
    balanceAfter: number;
    createdAt: string;
    meta?: Record<string, unknown>;
};

type ApplicationRow = {
    _id: string;
    taskId: string;
    taskName: string;
    bsNumber?: string;
    projectKey?: string;
    publicStatus?: string;
    visibility?: string;
    proposedBudget: number;
    contractorName?: string;
    contractorEmail?: string;
    status: string;
    createdAt?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DURATION_DAYS = 10;

type SnackState = { open: boolean; msg: string; sev: 'success' | 'error' | 'info' };

function roleLabel(r: OrgRole) {
    switch (r) {
        case 'owner': return 'Owner';
        case 'org_admin': return 'Admin';
        case 'manager': return 'Manager';
        case 'executor': return 'Executor';
        case 'viewer': return 'Viewer';
        default: return r;
    }
}

function statusChip(s: MemberStatus) {
    return s === 'active'
        ? <Chip label="active" size="small" color="success" />
        : <Chip label="invited" size="small" color="warning" variant="outlined" />;
}

function normalizeBaseUrl(url: string | undefined | null) {
    if (!url) return '';
    return url.replace(/\/+$/, '');
}

// универсальная склейка на всякий случай
function makeAbsoluteUrl(base: string, path: string) {
    try {
        // URL сам уберёт двойные слэши
        return new URL(path, base).toString();
    } catch {
        // запасной вариант — чуть более грубый
        const cleanBase = normalizeBaseUrl(base);
        const cleanPath = path.replace(/^\/+/, '');
        return `${cleanBase}/${cleanPath}`;
    }
}

export default function OrgSettingsPage() {
    const params = useParams<{ org: string }>();
    const router = useRouter();
    const org = params?.org;

    const allowedRoles: OrgRole[] = ['owner', 'org_admin', 'manager'];
    const [myRole, setMyRole] = React.useState<OrgRole | null>(null);
    const [orgName, setOrgName] = React.useState<string>('');
    const [accessChecked, setAccessChecked] = React.useState(false);
    const canManage = allowedRoles.includes(myRole ?? 'viewer');

    // участники
    const [members, setMembers] = React.useState<MemberDTO[]>([]);
    const [loading, setLoading] = React.useState(false);

    // поиск по участникам
    const [memberSearch, setMemberSearch] = React.useState('');
    const [showMemberSearch, setShowMemberSearch] = React.useState(false);

    // изменение роли участника
    const [roleDialogOpen, setRoleDialogOpen] = React.useState(false);
    const [memberToEditRole, setMemberToEditRole] = React.useState<MemberDTO | null>(null);
    const [newRole, setNewRole] = React.useState<OrgRole>('executor');

    // проекты
    const [projects, setProjects] = React.useState<ProjectDTO[]>([]);
    const [projectsLoading, setProjectsLoading] = React.useState(false);

    // snackbar
    const [snack, setSnack] = React.useState<SnackState>({ open: false, msg: '', sev: 'success' });

    // настройки организации
    const [orgSettingsOpen, setOrgSettingsOpen] = React.useState(false);
    const [orgSettingsData, setOrgSettingsData] = React.useState<OrgSettingsFormValues | null>(null);
    const [orgSettingsLoading, setOrgSettingsLoading] = React.useState(false);
    const [orgSettingsError, setOrgSettingsError] = React.useState<string | null>(null);
    const [orgSettingsSaving, setOrgSettingsSaving] = React.useState(false);
    const [subscription, setSubscription] = React.useState<SubscriptionInfo | null>(null);
    const [billing, setBilling] = React.useState<SubscriptionBillingInfo | null>(null);
    const [subscriptionLoading, setSubscriptionLoading] = React.useState(true);
    const [subscriptionError, setSubscriptionError] = React.useState<string | null>(null);
    const [planConfigs, setPlanConfigs] = React.useState<PlanConfig[]>([]);
    const [startTrialLoading, setStartTrialLoading] = React.useState(false);
    const [walletInfo, setWalletInfo] = React.useState<OrgWalletInfo | null>(null);
    const [walletLoading, setWalletLoading] = React.useState(false);
    const [walletError, setWalletError] = React.useState<string | null>(null);
    const [walletDialogOpen, setWalletDialogOpen] = React.useState(false);
    const [walletTx, setWalletTx] = React.useState<OrgWalletTx[]>([]);
    const [walletTxLoading, setWalletTxLoading] = React.useState(false);
    const [walletTxError, setWalletTxError] = React.useState<string | null>(null);
    const [projectsDialogOpen, setProjectsDialogOpen] = React.useState(false);
    const [membersDialogOpen, setMembersDialogOpen] = React.useState(false);
    const [applicationsDialogOpen, setApplicationsDialogOpen] = React.useState(false);
    const [plansDialogOpen, setPlansDialogOpen] = React.useState(false);

    // диалог приглашения
    const [inviteOpen, setInviteOpen] = React.useState(false);
    // снимок e-mail'ов на момент открытия
    const [inviteExistingEmails, setInviteExistingEmails] = React.useState<string[]>([]);
    const inviteCloseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const managerOptions: ProjectManagerOption[] = React.useMemo(
        () =>
            members
                .filter((member) => member.status === 'active')
                .filter((member) => ['owner', 'org_admin', 'manager'].includes(member.role))
                .map((member) => ({
                    email: member.userEmail,
                    name: member.userName,
                    role: member.role,
                })),
        [members]
    );

    const [projectDialogOpen, setProjectDialogOpen] = React.useState(false);
    const [projectDialogMode, setProjectDialogMode] = React.useState<'create' | 'edit'>('create');
    const [projectDialogLoading, setProjectDialogLoading] = React.useState(false);
    const [projectToEdit, setProjectToEdit] = React.useState<ProjectDTO | null>(null);
    const [applications, setApplications] = React.useState<ApplicationRow[]>([]);
    const [applicationsLoading, setApplicationsLoading] = React.useState(false);
    const [applicationsError, setApplicationsError] = React.useState<string | null>(null);
    const [applicationToRemove, setApplicationToRemove] = React.useState<ApplicationRow | null>(null);
    const [removeApplicationOpen, setRemoveApplicationOpen] = React.useState(false);
    const [removingApplication, setRemovingApplication] = React.useState(false);
    const resolveRegionCode = React.useCallback((code?: string | null) => {
        if (!code) return '';
        if (REGION_MAP.has(code)) return code;
        const match = REGION_ISO_MAP.get(code);
        return match?.code ?? code;
    }, []);

    const openProjectDialog = (project?: ProjectDTO) => {
        if (!project && (subscriptionLoading || !isSubscriptionActive)) {
            const msg = subscriptionLoading
                ? 'Подождите завершения проверки подписки'
                : 'Подписка не активна. Активируйте тариф или пробный период';
            setSnack({ open: true, msg, sev: 'error' });
            return;
        }
        if (project) {
            setProjectDialogMode('edit');
            setProjectToEdit(project);
        } else {
            setProjectDialogMode('create');
            setProjectToEdit(null);
        }
        setProjectDialogOpen(true);
    };

    const handleProjectDialogClose = () => {
        if (projectDialogLoading) return;
        setProjectDialogOpen(false);
        setProjectToEdit(null);
    };

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
                setWalletError(data?.error || 'Не удалось загрузить баланс');
                return;
            }
            setWalletInfo(data.wallet);
        } catch (err) {
            setWalletError(err instanceof Error ? err.message : 'Не удалось загрузить баланс');
        } finally {
            setWalletLoading(false);
        }
    }, [org]);

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
                setWalletTxError(data?.error || 'Не удалось загрузить операции');
                return;
            }
            setWalletTx(data.transactions);
        } catch (err) {
            setWalletTxError(err instanceof Error ? err.message : 'Не удалось загрузить операции');
        } finally {
            setWalletTxLoading(false);
        }
    }, [org]);

    const handleProjectDialogSubmit = async (values: ProjectDialogValues) => {
        if (!org) return;
        if (projectDialogMode === 'create' && (subscriptionLoading || !isSubscriptionActive)) {
            const msg = subscriptionLoading
                ? 'Подождите завершения проверки подписки'
                : 'Подписка не активна. Активируйте тариф или пробный период';
            setSnack({ open: true, msg, sev: 'error' });
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
                    ? `/api/org/${encodeURIComponent(org)}/projects/${projectToEdit._id}`
                    : `/api/org/${encodeURIComponent(org)}/projects`;
            const method = projectDialogMode === 'edit' ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data || data.error) {
                const msg = data?.error || 'Не удалось сохранить проект';
                setSnack({ open: true, msg, sev: 'error' });
                return;
            }
            setSnack({
                open: true,
                msg: projectDialogMode === 'create' ? 'Проект создан' : 'Проект обновлён',
                sev: 'success',
            });
            setProjectDialogOpen(false);
            setProjectToEdit(null);
            await fetchProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setSnack({ open: true, msg, sev: 'error' });
        } finally {
            setProjectDialogLoading(false);
        }
    };

    // диалог удаления участника
    const [removeOpen, setRemoveOpen] = React.useState(false);
    const [removing, setRemoving] = React.useState(false);
    const [memberToRemove, setMemberToRemove] = React.useState<MemberDTO | null>(null);

    // диалог удаления проекта
    const [removeProjectOpen, setRemoveProjectOpen] = React.useState(false);
    const [removingProject, setRemovingProject] = React.useState(false);
    const [projectToRemove, setProjectToRemove] = React.useState<ProjectDTO | null>(null);

    // база фронтенда для ссылок
    const [frontendBase, setFrontendBase] = React.useState('');

    React.useEffect(() => {
        const envPublic = process.env.NEXT_PUBLIC_FRONTEND_URL;
        const envPrivate = process.env.FRONTEND_URL;
        if (envPublic) {
            setFrontendBase(normalizeBaseUrl(envPublic));
        } else if (envPrivate) {
            setFrontendBase(normalizeBaseUrl(envPrivate));
        } else if (typeof window !== 'undefined') {
            setFrontendBase(normalizeBaseUrl(window.location.origin));
        }
    }, []);

    const fetchOrgSettings = React.useCallback(async () => {
        if (!org) return;
        setOrgSettingsLoading(true);
        setOrgSettingsError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/settings`, { cache: 'no-store' });
            const data = (await res.json()) as { settings?: OrgSettingsFormValues | null; error?: string };
            if (!res.ok || data.error) {
                setOrgSettingsError(data.error || 'Не удалось загрузить реквизиты');
                setOrgSettingsData(null);
                return;
            }
            if (data.settings) {
                setOrgSettingsData({ ...defaultOrgSettings, ...data.settings });
            } else {
                setOrgSettingsData(null);
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Ошибка загрузки реквизитов';
            setOrgSettingsError(msg);
            setOrgSettingsData(null);
        } finally {
            setOrgSettingsLoading(false);
        }
    }, [org]);

    // загрузка инфы об организации и своей роли
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!org) return;
            try {
                const res = await fetch(`/api/org/${encodeURIComponent(org)}`);
                type OrgInfoOk = { org: { _id: string; name: string; orgSlug: string }; role: OrgRole };
                const data = (await res.json().catch(() => ({}))) as OrgInfoOk | { error: string };
                if (!cancelled) {
                    if (!res.ok || 'error' in data) {
                        setMyRole(null);
                    } else {
                        setMyRole(data.role);
                        setOrgName(data.org.name);
                    }
                    setAccessChecked(true);
                }
            } catch {
                if (!cancelled) {
                    setMyRole(null);
                    setAccessChecked(true);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [org]);

    const fetchMembers = React.useCallback(async () => {
        if (!org || !canManage) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members`, { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as { members?: MemberDTO[]; error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                return;
            }
            setMembers(Array.isArray(data?.members) ? data.members : []);
        } finally {
            setLoading(false);
        }
    }, [org, canManage]);

    const fetchProjects = React.useCallback(async () => {
        if (!org || !canManage) return;
        setProjectsLoading(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/projects`, { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as { projects?: ProjectDTO[]; error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                return;
            }
            setProjects(Array.isArray(data?.projects) ? data.projects : []);
        } finally {
            setProjectsLoading(false);
        }
    }, [org, canManage]);

    const fetchApplications = React.useCallback(async () => {
        if (!org || !canManage) return;
        setApplicationsLoading(true);
        setApplicationsError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/applications`, { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as { applications?: ApplicationRow[]; error?: string };
            if (!res.ok || data.error) {
                setApplications([]);
                setApplicationsError(data.error || res.statusText);
                return;
            }
            setApplications(Array.isArray(data.applications) ? data.applications : []);
        } catch (e: unknown) {
            setApplicationsError(e instanceof Error ? e.message : 'Ошибка загрузки откликов');
            setApplications([]);
        } finally {
            setApplicationsLoading(false);
        }
    }, [org, canManage]);

    const openRemoveApplicationDialog = (app: ApplicationRow) => {
        setApplicationToRemove(app);
        setRemoveApplicationOpen(true);
    };

    const closeRemoveApplicationDialog = () => {
        if (removingApplication) return;
        setRemoveApplicationOpen(false);
        setApplicationToRemove(null);
    };

    const confirmRemoveApplication = async () => {
        if (!org || !applicationToRemove?._id || !canManage) return;
        setRemovingApplication(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/applications`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationId: applicationToRemove._id }),
            });
            const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
            if (!res.ok || data.error) {
                setSnack({ open: true, msg: data.error || res.statusText, sev: 'error' });
                return;
            }
            setSnack({ open: true, msg: 'Отклик удалён', sev: 'success' });
            await fetchApplications();
            closeRemoveApplicationDialog();
        } finally {
            setRemovingApplication(false);
        }
    };

    const loadSubscription = React.useCallback(async () => {
        if (!org || !canManage) return;
        setSubscriptionLoading(true);
        setSubscriptionError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/subscription`, { cache: 'no-store' });
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
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка загрузки подписки';
            setSubscription(null);
            setBilling(null);
            setSubscriptionError(msg);
        } finally {
            setSubscriptionLoading(false);
        }
    }, [org, canManage]);

    const loadPlanConfigs = React.useCallback(async () => {
        try {
            const res = await fetch('/api/plans', { cache: 'no-store' });
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

    // слушаем событие успешного приглашения
    React.useEffect(() => {
        const handler = async () => {
            await fetchMembers();
            if (inviteCloseTimeoutRef.current) {
                clearTimeout(inviteCloseTimeoutRef.current);
            }
            inviteCloseTimeoutRef.current = setTimeout(() => {
                setInviteOpen(false);
                inviteCloseTimeoutRef.current = null;
            }, 3000);
        };
        window.addEventListener('org-members:invited', handler as EventListener);
        return () => {
            window.removeEventListener('org-members:invited', handler as EventListener);
            if (inviteCloseTimeoutRef.current) {
                clearTimeout(inviteCloseTimeoutRef.current);
                inviteCloseTimeoutRef.current = null;
            }
        };
    }, [fetchMembers]);

    // первичная загрузка
    React.useEffect(() => {
        if (canManage) {
            void fetchMembers();
            void fetchProjects();
            void fetchOrgSettings();
            void loadSubscription();
            void fetchApplications();
            void fetchWalletInfo();
            void loadPlanConfigs();
        }
    }, [canManage, fetchMembers, fetchProjects, fetchOrgSettings, loadSubscription, fetchApplications, fetchWalletInfo, loadPlanConfigs]);

    const handleRefreshClick = () => {
        void fetchMembers();
        void fetchProjects();
        void loadSubscription();
        void fetchApplications();
        void fetchWalletInfo();
    };

    // удаление участника
    const openRemoveDialog = (m: MemberDTO) => {
        setMemberToRemove(m);
        setRemoveOpen(true);
    };
    const closeRemoveDialog = () => {
        if (removing) return;
        setRemoveOpen(false);
        setMemberToRemove(null);
    };
    const confirmRemove = async () => {
        if (!org || !memberToRemove?._id || !canManage) return;
        setRemoving(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members/${memberToRemove._id}`, { method: 'DELETE' });
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                return;
            }
            setSnack({ open: true, msg: 'Участник удалён', sev: 'success' });
            await fetchMembers();
            closeRemoveDialog();
        } finally {
            setRemoving(false);
        }
    };

    // удаление проекта
    const openRemoveProjectDialog = (p: ProjectDTO) => {
        setProjectToRemove(p);
        setRemoveProjectOpen(true);
    };
    const closeRemoveProjectDialog = () => {
        if (removingProject) return;
        setRemoveProjectOpen(false);
        setProjectToRemove(null);
    };
    const confirmRemoveProject = async () => {
        if (!org || !projectToRemove?._id || !canManage) return;
        setRemovingProject(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/projects/${projectToRemove._id}`, {
                method: 'DELETE',
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                return;
            }
            setSnack({ open: true, msg: 'Проект удалён', sev: 'success' });
            await fetchProjects();
            closeRemoveProjectDialog();
        } finally {
            setRemovingProject(false);
        }
    };

    const handleStartTrial = async () => {
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
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка запуска пробного периода';
            setSubscriptionError(msg);
            setSnack({ open: true, msg, sev: 'error' });
        } finally {
            setStartTrialLoading(false);
        }
    };

    const handleActivateGrace = async () => {
        if (!org || !isOwnerOrAdmin) return;
        setSubscriptionError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/subscription/grace`, {
                method: 'POST',
            });
            const data = (await res.json().catch(() => ({}))) as { billing?: SubscriptionBillingInfo; error?: string };
            if (!res.ok || !data.billing) {
                const msg = data?.error || 'Не удалось активировать grace';
                setSnack({ open: true, msg, sev: 'error' });
                return;
            }
            setBilling(data.billing);
            setSnack({ open: true, msg: 'Grace-период активирован на 3 дня', sev: 'success' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка активации grace';
            setSnack({ open: true, msg, sev: 'error' });
        }
    };

    const formatExpire = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const goToProjectsPage = () => {
        if (!org) return;
        router.push(`/org/${encodeURIComponent(org)}/projects`);
    };

    const goToTaskDetails = (app: ApplicationRow) => {
        if (!org || !app.taskId) return;
        if (!app.projectKey) {
            setSnack({ open: true, msg: 'Не удалось определить проект задачи', sev: 'error' });
            return;
        }
        router.push(
            `/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(app.projectKey)}/tasks/${app.taskId}`
        );
    };

    const handleOrgSettingsSubmit = async (values: OrgSettingsFormValues) => {
        if (!org) return;
        setOrgSettingsSaving(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!res.ok || data?.error) {
                setSnack({ open: true, msg: data?.error || 'Не удалось сохранить реквизиты', sev: 'error' });
                return;
            }
            if (data?.settings) {
                setOrgSettingsData({ ...defaultOrgSettings, ...data.settings });
            }
            setOrgSettingsOpen(false);
            setSnack({ open: true, msg: 'Настройки организации обновлены', sev: 'success' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сохранения реквизитов';
            setSnack({ open: true, msg, sev: 'error' });
        } finally {
            setOrgSettingsSaving(false);
        }
    };

    const formatTrialEnd = React.useCallback((iso?: string | null) => {
        if (!iso) return null;
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? null : d;
    }, []);

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
    const pageWrapperSx = {
        minHeight: '100%',
        py: { xs: 4, md: 6 },
        position: 'relative' as const,
        overflow: 'hidden',
    };
    const panelPadding = { xs: 2, md: 3 };
    const panelBaseSx = {
        borderRadius: theme.shape.borderRadius,
        p: panelPadding,
        backgroundColor: headerBg,
        border: `1px solid ${headerBorder}`,
        boxShadow: headerShadow,
        color: textPrimary,
        backdropFilter: 'blur(26px)',
        position: 'relative' as const,
        overflow: 'hidden',
    };
    const statCardSx = {
        borderRadius: theme.shape.borderRadius,
        px: { xs: 2, md: 2.5 },
        py: { xs: 1.25, md: 1.5 },
        border: `1px solid ${cardBorder}`,
        backgroundColor: cardBg,
        boxShadow: cardShadow,
        backdropFilter: 'blur(20px)',
    };
    const buttonRadius = theme.shape.borderRadius;
    const actionButtonBaseSx = {
        borderRadius: buttonRadius,
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
            borderRadius: buttonRadius,
            border: `1px solid ${paletteEntry.border}`,
            backgroundColor: paletteEntry.bg,
            backdropFilter: 'blur(18px)',
            color: textPrimary,
            '& .MuiAlert-icon': {
                color: paletteEntry.border,
            },
        };
    };
    const cardBaseSx = {
        backdropFilter: 'blur(24px)',
        backgroundColor: cardBg,
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow,
        borderRadius: theme.shape.borderRadius,
        color: textPrimary,
    };
    const masonryCardSx = {
        ...cardBaseSx,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: isDarkMode ? '0 40px 90px rgba(0,0,0,0.6)' : '0 40px 90px rgba(15,23,42,0.22)',
        },
    };
    const cardHeaderSx = {
        borderBottom: `1px solid ${cardBorder}`,
        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.72)' : 'rgba(255,255,255,0.9)',
        borderTopLeftRadius: theme.shape.borderRadius,
        borderTopRightRadius: theme.shape.borderRadius,
    };
    const cardContentSx = {
        backgroundColor: isDarkMode ? 'rgba(12,16,26,0.75)' : 'rgba(247,249,255,0.8)',
        borderBottomLeftRadius: theme.shape.borderRadius,
        borderBottomRightRadius: theme.shape.borderRadius,
    };
    const masonrySpacing = { xs: 1.5, sm: 2, md: 2.5 };
    // Shared container keeps header and Masonry aligned; px uses half-spacing to neutralize Masonry gutters.
    const contentContainerSx = (muiTheme: typeof theme) => ({
        maxWidth: 1200,
        mx: 'auto',
        width: '100%',
        px: {
            xs: `calc(${muiTheme.spacing(masonrySpacing.xs)} / 2)`,
            sm: `calc(${muiTheme.spacing(masonrySpacing.sm)} / 2)`,
            md: `calc(${muiTheme.spacing(masonrySpacing.md)} / 2)`,
            lg: `calc(${muiTheme.spacing(masonrySpacing.md)} / 2)`,
        },
        boxSizing: 'border-box',
    });
    const renderStatusPanel = (content: React.ReactNode) => (
        <Box sx={pageWrapperSx}>
            <Box sx={(theme) => ({ ...contentContainerSx(theme), maxWidth: 720 })}>
                <Box sx={panelBaseSx}>{content}</Box>
            </Box>
        </Box>
    );

    const trialEndsAt = formatTrialEnd(subscription?.periodEnd);
    const nowTs = Date.now();
    const isTrialActive = subscription?.status === 'trial' && !!trialEndsAt && trialEndsAt.getTime() > nowTs;
    const isTrialExpired = subscription?.status === 'trial' && !isTrialActive;
    const isOwnerOrAdmin = myRole === 'owner' || myRole === 'org_admin';
    const hasTrialHistory = Boolean(subscription?.periodStart);
    const canStartTrial = isOwnerOrAdmin && (!subscription || (subscription.status === 'inactive' && !hasTrialHistory));
    const isSubscriptionActive = billing?.isActive ?? (subscription?.status === 'active' || isTrialActive);
    const formattedTrialEnd = trialEndsAt?.toLocaleDateString('ru-RU');
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
    const showNotificationsCard = Boolean(walletError || orgSettingsError);
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
    const formatLimitLabel = (value: number | null) => (typeof value === 'number' ? String(value) : '∞');
    const projectsLimitLabel = formatLimitLabel(resolvedProjectsLimit);
    const activeProjectsCount = projects.length;
    const seatsLabel = formatLimitLabel(resolvedSeatsLimit);
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
    const roleLabelRu = myRole
        ? {
            owner: 'Владелец',
            org_admin: 'Администратор',
            manager: 'Менеджер',
            executor: 'Исполнитель',
            viewer: 'Наблюдатель',
        }[myRole] ?? myRole
        : '—';

    const canEditOrgSettings = myRole === 'owner' || myRole === 'org_admin';
    const settingsButtonDisabled = orgSettingsLoading || !canEditOrgSettings;
    const settingsTooltip = !canEditOrgSettings
        ? 'Только владелец или администратор может менять настройки'
        : orgSettingsLoading
            ? 'Загружаем реквизиты…'
            : 'Настройки организации';

    const filteredMembers = (() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return members;
        return members.filter((m) => {
            const name = (m.userName || '').toLowerCase();
            const email = (m.userEmail || '').toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    })();

    const memberByEmail = (() => {
        const map = new Map<string, MemberDTO>();
        for (const m of members) {
            if (m.userEmail) {
                map.set(m.userEmail.toLowerCase(), m);
            }
        }
        return map;
    })();
    const invitedMembersCount = React.useMemo(
        () => members.filter((m) => m.status === 'invited').length,
        [members]
    );
    const activeMembersCount = members.length - invitedMembersCount;
    const projectPreview = projects.slice(0, 3);
    const membersPreview = members.slice(0, 3);
    const applicationsPreview = applications.slice(0, 3);
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
                Недостаточно прав для просмотра страницы настроек организации.
            </Alert>
        );
    }

    return (
        <Box sx={pageWrapperSx}>
            <Box
                sx={(theme) => ({
                    ...contentContainerSx(theme),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                })}
            >
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
                                    <BusinessIcon />
                                </Box>
                                <Typography
                                    variant="h5"
                                    fontWeight={700}
                                    color={textPrimary}
                                    sx={{ fontSize: { xs: '1.55rem', md: '1.95rem' } }}
                                >
                                    {orgName || org} — Организация
                                </Typography>
                                <Tooltip title={settingsTooltip}>
                                    <span>
                                        <IconButton
                                            onClick={canEditOrgSettings ? () => setOrgSettingsOpen(true) : undefined}
                                            disabled={settingsButtonDisabled}
                                            sx={{
                                                borderRadius: '12px',
                                                border: `1px solid ${iconBorderColor}`,
                                                backgroundColor: iconBg,
                                                boxShadow: iconShadow,
                                                '&:hover': { backgroundColor: iconHoverBg },
                                                '&.Mui-disabled': { color: disabledIconColor },
                                            }}
                                        >
                                            <SettingsIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Stack>
                            <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                Управляйте подпиской, участниками и проектами организации.
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
                                onClick={goToProjectsPage}
                                startIcon={<DriveFileMoveIcon />}
                                sx={{
                                    ...actionButtonBaseSx,
                                    borderColor: headerBorder,
                                    color: textPrimary,
                                    backgroundColor: isDarkMode
                                        ? 'rgba(15,18,28,0.65)'
                                        : 'rgba(255,255,255,0.85)',
                                }}
                            >
                                К проектам
                            </Button>
                            <Tooltip title={inviteTooltip} disableHoverListener={!disableCreationActions}>
                                <span style={{ display: 'inline-flex' }}>
                                    <Button
                                        variant="contained"
                                        disableElevation
                                        startIcon={<PersonAddIcon />}
                                        onClick={() => {
                                            if (disableCreationActions) return;
                                            setInviteExistingEmails(members.map((m) => m.userEmail.toLowerCase()));
                                            setInviteOpen(true);
                                        }}
                                        disabled={disableCreationActions}
                                        sx={{
                                            ...actionButtonBaseSx,
                                            border: 'none',
                                            color: '#ffffff',
                                            backgroundImage: disableCreationActions
                                                ? isDarkMode
                                                    ? 'linear-gradient(120deg, rgba(148,163,184,0.4), rgba(100,116,139,0.35))'
                                                    : 'linear-gradient(120deg, rgba(148,163,184,0.3), rgba(100,116,139,0.25))'
                                                : 'linear-gradient(120deg, #3b82f6, #6366f1)',
                                        }}
                                    >
                                        Пригласить
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
                                из {projectsLimitLabel} доступных
                            </Typography>
                        </Box>
                        <Box sx={statCardSx}>
                            <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                                Рабочих мест
                            </Typography>
                            <Typography variant="h4" fontWeight={700} color={textPrimary}>
                                {activeMembersCount}
                            </Typography>
                            <Typography variant="body2" color={textSecondary}>
                                Всего {seatsLabel}
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
                            <Button
                                variant="text"
                                size="small"
                                onClick={() => setPlansDialogOpen(true)}
                                sx={{ mt: 1, px: 0, textTransform: 'none' }}
                            >
                                Изменить
                            </Button>
                        </Box>
                        <Box sx={statCardSx}>
                            <Typography variant="overline" sx={{ color: textSecondary, letterSpacing: 1 }}>
                                Ваша роль
                            </Typography>
                            <Typography variant="h6" fontWeight={600} color={textPrimary}>
                                {roleLabelRu}
                            </Typography>
                            <Typography variant="body2" color={textSecondary}>
                                Организация {orgName || org}
                            </Typography>
                        </Box>
                    </Stack>

                    <Stack spacing={1.5} sx={{ mt: { xs: 2, md: 2.5 } }}>
                        {subscriptionError && (
                            <Alert severity="error" sx={getAlertSx('error')}>
                                Не удалось получить статус подписки: {subscriptionError}
                            </Alert>
                        )}
                        {!subscriptionError && subscriptionLoading && (
                            <Alert severity="info" sx={getAlertSx('info')}>
                                Проверяем статус подписки…
                            </Alert>
                        )}
                        {!subscriptionError && !subscriptionLoading && billing?.readOnly && (
                            <Alert
                                severity="warning"
                                sx={getAlertSx('warning')}
                                action={
                                    billing.graceAvailable && isOwnerOrAdmin ? (
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
                        )}
                        {!subscriptionError && !subscriptionLoading && !isSubscriptionActive && (
                            <Alert severity="warning" sx={getAlertSx('warning')}>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={2}
                                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                                    justifyContent="space-between"
                                >
                                    <Box>
                                        <Typography fontWeight={600} color={textPrimary}>
                                            Подписка не активна.
                                        </Typography>
                                        {isTrialExpired && formattedTrialEnd && (
                                            <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                                Пробный период завершился {formattedTrialEnd}.
                                            </Typography>
                                        )}
                                        <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                            Получите бесплатный пробный период на 10 дней с тарифом PRO.
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
                        )}
                        {!subscriptionError && !subscriptionLoading && isTrialActive && (
                            <Alert severity="info" sx={getAlertSx('info')}>
                                Пробный период активен до {formattedTrialEnd ?? '—'}
                                {typeof trialDaysLeft === 'number' && (
                                    <Typography component="span" sx={{ ml: 0.5 }}>
                                        (осталось {trialDaysLeft} дн.)
                                    </Typography>
                                )}
                            </Alert>
                        )}
                    </Stack>
                </Box>

                <Masonry
                    columns={{ xs: 1, sm: 1, md: 2, lg: 3 }}
                    spacing={masonrySpacing}
                    sx={{
                        width: '100%',
                        boxSizing: 'border-box',
                        '& > *': { boxSizing: 'border-box' },
                    }}
                >
                    {showNotificationsCard && (
                        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
                            <Stack spacing={1.5}>
                                <Typography variant="subtitle1" fontWeight={600}>
                                    Уведомления
                                </Typography>
                                {walletError && (
                                    <Alert severity="warning" sx={getAlertSx('warning')}>
                                        Не удалось загрузить баланс: {walletError}
                                    </Alert>
                                )}
                                {orgSettingsError && (
                                    <Alert
                                        severity="warning"
                                        variant="outlined"
                                        sx={getAlertSx('warning')}
                                        action={
                                            <Button
                                                color="inherit"
                                                size="small"
                                                onClick={() => void fetchOrgSettings()}
                                                disabled={orgSettingsLoading}
                                                sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                                            >
                                                Повторить
                                            </Button>
                                        }
                                    >
                                        Не удалось загрузить реквизиты: {orgSettingsError}
                                    </Alert>
                                )}
                            </Stack>
                        </Box>
                    )}

                    {org && (
                        <Box>
                            <OrgStorageUsageCard
                                orgSlug={org}
                                cardSx={masonryCardSx}
                                cardHeaderSx={cardHeaderSx}
                                cardContentSx={cardContentSx}
                            />
                        </Box>
                    )}

                    <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
                        <Stack spacing={1.5}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <AccountBalanceWalletIcon fontSize="small" />
                                <Typography variant="subtitle1" fontWeight={600}>
                                    Баланс организации
                                </Typography>
                            </Stack>
                            <Typography variant="h4" fontWeight={700}>
                                {walletLoading
                                    ? '—'
                                    : `${(walletInfo?.balance ?? 0).toFixed(2)} ${walletInfo?.currency ?? 'RUB'}`}
                            </Typography>
                            <Typography variant="body2" color={textSecondary}>
                                Списания за хранение рассчитываются почасово.
                            </Typography>
                            <Button
                                variant="outlined"
                                onClick={() => {
                                    setWalletDialogOpen(true);
                                    void fetchWalletTransactions();
                                }}
                                sx={{ borderRadius: buttonRadius, textTransform: 'none', alignSelf: 'flex-start' }}
                            >
                                История операций
                            </Button>
                        </Stack>
                    </Box>

                    <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
                        <Stack spacing={2}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="subtitle1" fontWeight={600}>
                                    Проекты
                                </Typography>
                                <Stack direction="row" spacing={1}>
                                    <Tooltip title="Открыть список">
                                        <span>
                                            <IconButton onClick={() => setProjectsDialogOpen(true)}>
                                                <PreviewIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="К проектам">
                                        <span>
                                            <IconButton onClick={goToProjectsPage}>
                                                <DriveFileMoveIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Stack>
                            <Typography variant="body2" color={textSecondary}>
                                Активных проектов: {activeProjectsCount} из {projectsLimitLabel}.
                            </Typography>
                            {projectsLoading ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <CircularProgress size={18} />
                                    <Typography variant="body2">Загружаем проекты…</Typography>
                                </Stack>
                            ) : projectPreview.length > 0 ? (
                                <Stack spacing={1}>
                                    {projectPreview.map((project) => (
                                        <Box
                                            key={project._id}
                                            sx={{
                                                borderRadius: 1,
                                                p: 1.25,
                                                border: `1px solid ${cardBorder}`,
                                                backgroundColor: isDarkMode
                                                    ? 'rgba(12,16,26,0.7)'
                                                    : 'rgba(255,255,255,0.7)',
                                            }}
                                        >
                                            <Typography variant="body2" fontWeight={600}>
                                                {project.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {project.key} · {project.regionCode || '—'}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            ) : (
                                <Typography variant="body2" color={textSecondary}>
                                    Проектов пока нет.
                                </Typography>
                            )}
                            <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                                <Button
                                    variant="contained"
                                    onClick={() => setProjectsDialogOpen(true)}
                                    sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                                >
                                    Открыть список
                                </Button>
                                <Tooltip title={creationTooltip} disableHoverListener={!disableCreationActions}>
                                    <span>
                                        <Button
                                            variant="outlined"
                                            onClick={() => openProjectDialog()}
                                            disabled={disableCreationActions}
                                            sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                                        >
                                            Создать проект
                                        </Button>
                                    </span>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    </Box>

                        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
                            <Stack spacing={2}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Участники
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                        <Tooltip title="Открыть список">
                                            <span>
                                                <IconButton onClick={() => setMembersDialogOpen(true)}>
                                                    <PreviewIcon />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        <Tooltip title={inviteTooltip}>
                                            <span>
                                                <IconButton
                                                    onClick={() => {
                                                        if (disableCreationActions) return;
                                                        setInviteExistingEmails(members.map((m) => m.userEmail.toLowerCase()));
                                                        setInviteOpen(true);
                                                    }}
                                                    disabled={disableCreationActions}
                                                >
                                                    <PersonAddIcon />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Stack>
                                </Stack>
                                <Typography variant="body2" color={textSecondary}>
                                    Активных: {activeMembersCount}, приглашённых: {invitedMembersCount}.
                                </Typography>
                                {loading ? (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <CircularProgress size={18} />
                                        <Typography variant="body2">Загружаем участников…</Typography>
                                    </Stack>
                                ) : membersPreview.length > 0 ? (
                                    <Stack spacing={1}>
                                        {membersPreview.map((member) => (
                                            <Box
                                                key={member._id}
                                                sx={{
                                                    borderRadius: 1,
                                                    p: 1.25,
                                                    border: `1px solid ${cardBorder}`,
                                                    backgroundColor: isDarkMode
                                                        ? 'rgba(12,16,26,0.7)'
                                                        : 'rgba(255,255,255,0.7)',
                                                }}
                                            >
                                                <Typography variant="body2" fontWeight={600}>
                                                    {member.userName || 'Без имени'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {member.userEmail} · {roleLabel(member.role)}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Typography variant="body2" color={textSecondary}>
                                        Участников пока нет.
                                    </Typography>
                                )}
                                <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
                                    <Button
                                        variant="contained"
                                        onClick={() => setMembersDialogOpen(true)}
                                        sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                                    >
                                        Открыть список
                                    </Button>
                                    <Tooltip title={inviteTooltip} disableHoverListener={!disableCreationActions}>
                                        <span>
                                            <Button
                                                variant="outlined"
                                                onClick={() => {
                                                    if (disableCreationActions) return;
                                                    setInviteExistingEmails(members.map((m) => m.userEmail.toLowerCase()));
                                                    setInviteOpen(true);
                                                }}
                                                disabled={disableCreationActions}
                                                sx={{ borderRadius: buttonRadius, textTransform: 'none' }}
                                            >
                                                Пригласить
                                            </Button>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            </Stack>
                        </Box>

                        <Box sx={{ ...masonryCardSx, p: { xs: 2, md: 2.5 } }}>
                            <Stack spacing={2}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Отклики на задачи
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                        <Tooltip title="Открыть список">
                                            <span>
                                                <IconButton onClick={() => setApplicationsDialogOpen(true)}>
                                                    <PreviewIcon />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                        <Tooltip title="Обновить">
                                            <span>
                                                <IconButton onClick={() => void fetchApplications()} disabled={applicationsLoading}>
                                                    <RefreshIcon />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Stack>
                                </Stack>
                                <Typography variant="body2" color={textSecondary}>
                                    Всего заявок: {applications.length}.
                                </Typography>
                                {applicationsLoading ? (
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <CircularProgress size={18} />
                                        <Typography variant="body2">Загружаем отклики…</Typography>
                                    </Stack>
                                ) : applicationsPreview.length > 0 ? (
                                    <Stack spacing={1}>
                                        {applicationsPreview.map((app) => (
                                            <Box
                                                key={app._id}
                                                sx={{
                                                    borderRadius: 1,
                                                    p: 1.25,
                                                    border: `1px solid ${cardBorder}`,
                                                    backgroundColor: isDarkMode
                                                        ? 'rgba(12,16,26,0.7)'
                                                        : 'rgba(255,255,255,0.7)',
                                                }}
                                            >
                                                <Typography variant="body2" fontWeight={600}>
                                                    {app.taskName}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {app.contractorName || app.contractorEmail || 'Без кандидата'} · {app.status}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Stack>
                                ) : (
                                    <Typography variant="body2" color={textSecondary}>
                                        Откликов пока нет.
                                    </Typography>
                                )}
                                <Button
                                    variant="contained"
                                    onClick={() => setApplicationsDialogOpen(true)}
                                    sx={{ borderRadius: buttonRadius, textTransform: 'none', alignSelf: 'flex-start' }}
                                >
                                    Открыть список
                                </Button>
                            </Stack>
                        </Box>
                </Masonry>
            </Box>

            <Dialog
                open={plansDialogOpen}
                onClose={() => setPlansDialogOpen(false)}
                fullScreen
                PaperProps={{
                    sx: {
                        backgroundColor: 'transparent',
                        boxShadow: 'none',
                    },
                }}
            >
                <DialogContent sx={{ p: 0 }}>
                    {org && (
                        <OrgPlansPanel
                            orgSlug={org}
                            showClose
                            onClose={() => setPlansDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Диалоги таблиц */}
            <Dialog
                open={projectsDialogOpen}
                onClose={() => setProjectsDialogOpen(false)}
                maxWidth="lg"
                fullWidth
                slotProps={{
                    paper: {
                        sx: {
                            backdropFilter: 'blur(24px)',
                            backgroundColor: cardBg,
                            border: `1px solid ${cardBorder}`,
                            boxShadow: cardShadow,
                            borderRadius: theme.shape.borderRadius,
                        },
                    },
                }}
            >
                <DialogTitle sx={cardHeaderSx}>
                    Проекты организации
                </DialogTitle>
                <DialogContent dividers sx={{ backgroundColor: cardContentSx.backgroundColor }}>
                    <Card variant="outlined" sx={cardBaseSx}>
                        <CardHeader
                            sx={cardHeaderSx}
                            title={`Проекты организации (${projects.length})`}
                            action={
                                <Stack direction="row" spacing={1}>
                                    <Tooltip title={creationTooltip}>
                                        <span>
                                            <IconButton onClick={() => openProjectDialog()} disabled={disableCreationActions}>
                                                <CreateNewFolderIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="Перейти к проектам">
                                        <span>
                                            <IconButton onClick={goToProjectsPage}>
                                                <DriveFileMoveIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="Обновить">
                                        <span>
                                            <IconButton onClick={handleRefreshClick} disabled={projectsLoading || loading}>
                                                <RefreshIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            }
                        />
                        <CardContent sx={cardContentSx}>
                            {projectsLoading ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <CircularProgress size={20} />
                                    <Typography>Загрузка проектов…</Typography>
                                </Stack>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Код</TableCell>
                                            <TableCell>Проект</TableCell>
                                            <TableCell>Менеджер</TableCell>
                                            <TableCell>Описание</TableCell>
                                            <TableCell align="right">Действия</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {projects.map((p) => {
                                            return (
                                                <TableRow key={p._id} hover>
                                                    <TableCell
                                                        sx={{ cursor: 'pointer' }}
                                                        onClick={() =>
                                                            router.push(
                                                                `/org/${encodeURIComponent(String(org))}/projects/${encodeURIComponent(p.key)}/tasks`
                                                            )
                                                        }
                                                    >
                                                        {p.key}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ cursor: 'pointer' }}
                                                        onClick={() =>
                                                            router.push(
                                                                `/org/${encodeURIComponent(String(org))}/projects/${encodeURIComponent(p.key)}/tasks`
                                                            )
                                                        }
                                                    >
                                                        {p.name}
                                                    </TableCell>
                                                    <TableCell>
                                                        {(() => {
                                                            const rawEmail =
                                                                p.managerEmail ||
                                                                (Array.isArray(p.managers) && p.managers.length > 0
                                                                    ? p.managers[0]
                                                                    : '');
                                                            const normalized = rawEmail ? rawEmail.trim().toLowerCase() : '';
                                                            const member = normalized ? memberByEmail.get(normalized) : undefined;

                                                            const name = member?.userName || '';
                                                            const email = member?.userEmail || rawEmail || '';

                                                            if (name && email) {
                                                                return (
                                                                    <Box>
                                                                        <Typography variant="body2">{name}</Typography>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {email}
                                                                        </Typography>
                                                                    </Box>
                                                                );
                                                            }

                                                            if (email) {
                                                                return <Typography variant="body2">{email}</Typography>;
                                                            }

                                                            return (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    —
                                                                </Typography>
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell sx={{ maxWidth: 360 }}>
                                                        <Typography variant="body2" color="text.secondary" noWrap>
                                                            {p.description || '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Tooltip title="Редактировать проект">
                                                            <IconButton onClick={() => openProjectDialog(p)}>
                                                                <EditOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Удалить проект">
                                                            <IconButton onClick={() => openRemoveProjectDialog(p)}>
                                                                <DeleteOutlineOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}

                                        {projects.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5}>
                                                    <Typography color="text.secondary">
                                                        Проектов пока нет. Чтобы создать нажмите
                                                        <IconButton onClick={() => openProjectDialog()} disabled={disableCreationActions}>
                                                            <CreateNewFolderIcon />
                                                        </IconButton>
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </DialogContent>
                <DialogActions
                    sx={{
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.8)' : 'rgba(255,255,255,0.85)',
                        borderTop: `1px solid ${cardBorder}`,
                        '& .MuiButton-root': { borderRadius: buttonRadius, textTransform: 'none' },
                    }}
                >
                    <Button onClick={() => setProjectsDialogOpen(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={membersDialogOpen}
                onClose={() => setMembersDialogOpen(false)}
                maxWidth="lg"
                fullWidth
                slotProps={{
                    paper: {
                        sx: {
                            backdropFilter: 'blur(24px)',
                            backgroundColor: cardBg,
                            border: `1px solid ${cardBorder}`,
                            boxShadow: cardShadow,
                            borderRadius: theme.shape.borderRadius,
                        },
                    },
                }}
            >
                <DialogTitle sx={cardHeaderSx}>
                    Участники организации
                </DialogTitle>
                <DialogContent dividers sx={{ backgroundColor: cardContentSx.backgroundColor }}>
                    <Card variant="outlined" sx={cardBaseSx}>
                        <CardHeader
                            sx={cardHeaderSx}
                            title={`Участники организации (${members.length})`}
                            subheader={`Действующие и приглашённые участники ${orgName || org}`}
                            action={
                                <Stack direction="row" spacing={1}>
                                    <Tooltip title={showMemberSearch ? 'Скрыть поиск' : 'Поиск по участникам'}>
                                        <span>
                                            <IconButton
                                                onClick={() => setShowMemberSearch((prev) => !prev)}
                                                color={showMemberSearch ? 'primary' : 'default'}
                                            >
                                                <PersonSearchIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title={inviteTooltip}>
                                        <span>
                                            <IconButton
                                                onClick={() => {
                                                    if (disableCreationActions) return;
                                                    setInviteExistingEmails(members.map((m) => m.userEmail.toLowerCase()));
                                                    setInviteOpen(true);
                                                }}
                                                disabled={disableCreationActions}
                                            >
                                                <PersonAddIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="Обновить">
                                        <span>
                                            <IconButton onClick={handleRefreshClick} disabled={loading || projectsLoading}>
                                                <RefreshIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            }
                        />
                        <CardContent sx={cardContentSx}>
                            {showMemberSearch && (
                                <Box sx={{ mb: 2, maxWidth: 360 }}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label="Поиск по имени или e-mail"
                                            value={memberSearch}
                                            onChange={(e) => setMemberSearch(e.target.value)}
                                        />
                                        <Tooltip title="Сбросить поиск">
                                            <IconButton
                                                onClick={() => {
                                                    setMemberSearch('');
                                                    setShowMemberSearch(false);
                                                }}
                                            >
                                                <CancelIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Box>
                            )}

                            {loading ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <CircularProgress size={20} />
                                    <Typography>Загрузка участников…</Typography>
                                </Stack>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Имя</TableCell>
                                            <TableCell>E-mail</TableCell>
                                            <TableCell>Роль</TableCell>
                                            <TableCell>Статус</TableCell>
                                            <TableCell align="right">Действия</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredMembers.map((m) => {
                                            const isInvited = m.status === 'invited';
                                            const invitePath = `/org/${encodeURIComponent(String(org))}/join?token=${encodeURIComponent(
                                                m.inviteToken || ''
                                            )}`;
                                            const inviteLink =
                                                isInvited && m.inviteToken
                                                    ? (frontendBase ? makeAbsoluteUrl(frontendBase, invitePath) : invitePath)
                                                    : undefined;

                                            return (
                                                <TableRow
                                                    key={m._id}
                                                    sx={isInvited ? { opacity: 0.85 } : undefined}
                                                    title={isInvited ? 'Приглашение отправлено, ожидаем подтверждения' : undefined}
                                                >
                                                    <TableCell>{m.userName || '—'}</TableCell>
                                                    <TableCell>{m.userEmail}</TableCell>
                                                    <TableCell>{roleLabel(m.role)}</TableCell>
                                                    <TableCell>
                                                        <Stack direction="row" spacing={1} alignItems="center">
                                                            {statusChip(m.status)}
                                                            {isInvited && m.inviteExpiresAt && (
                                                                <Chip
                                                                    size="small"
                                                                    variant="outlined"
                                                                    label={`до ${formatExpire(m.inviteExpiresAt)}`}
                                                                />
                                                            )}
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {inviteLink && (
                                                            <Tooltip title="Скопировать ссылку приглашения">
                                                                <IconButton
                                                                    onClick={() => {
                                                                        void navigator.clipboard.writeText(inviteLink).then(() =>
                                                                            setSnack({ open: true, msg: 'Ссылка скопирована', sev: 'info' })
                                                                        );
                                                                    }}
                                                                >
                                                                    <LinkIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}

                                                        {m.role !== 'owner' && (
                                                            <Tooltip title="Изменить роль">
                                                                <IconButton
                                                                    onClick={() => {
                                                                        setMemberToEditRole(m);
                                                                        setNewRole(m.role);
                                                                        setRoleDialogOpen(true);
                                                                    }}
                                                                >
                                                                    <ManageAccountsIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}

                                                        {m.role !== 'owner' && (
                                                            <Tooltip title="Удалить участника">
                                                                <IconButton onClick={() => openRemoveDialog(m)}>
                                                                    <DeleteOutlineOutlinedIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}

                                        {filteredMembers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5}>
                                                    <Typography color="text.secondary">
                                                        Не найдено участников по запросу.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </DialogContent>
                <DialogActions
                    sx={{
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.8)' : 'rgba(255,255,255,0.85)',
                        borderTop: `1px solid ${cardBorder}`,
                        '& .MuiButton-root': { borderRadius: buttonRadius, textTransform: 'none' },
                    }}
                >
                    <Button onClick={() => setMembersDialogOpen(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={applicationsDialogOpen}
                onClose={() => setApplicationsDialogOpen(false)}
                maxWidth="lg"
                fullWidth
                slotProps={{
                    paper: {
                        sx: {
                            backdropFilter: 'blur(24px)',
                            backgroundColor: cardBg,
                            border: `1px solid ${cardBorder}`,
                            boxShadow: cardShadow,
                            borderRadius: theme.shape.borderRadius,
                        },
                    },
                }}
            >
                <DialogTitle sx={cardHeaderSx}>
                    Отклики на публичные задачи
                </DialogTitle>
                <DialogContent dividers sx={{ backgroundColor: cardContentSx.backgroundColor }}>
                    <Card variant="outlined" sx={cardBaseSx}>
                        <CardHeader
                            sx={cardHeaderSx}
                            title="Отклики на публичные задачи"
                            subheader="Последние 50 заявок подрядчиков"
                            action={
                                <Tooltip title="Обновить">
                                    <span>
                                        <IconButton onClick={() => void fetchApplications()} disabled={applicationsLoading}>
                                            <RefreshIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            }
                        />
                        <CardContent sx={cardContentSx}>
                            {applicationsError ? (
                                <Alert severity="warning" sx={{ ...getAlertSx('warning'), mb: 2 }}>
                                    {applicationsError}
                                </Alert>
                            ) : null}
                            {applicationsLoading ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <CircularProgress size={20} />
                                    <Typography>Загружаем отклики…</Typography>
                                </Stack>
                            ) : applications.length === 0 ? (
                                <Typography color="text.secondary">
                                    Откликов пока нет.
                                </Typography>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Задача</TableCell>
                                            <TableCell>Кандидат</TableCell>
                                            <TableCell>Ставка</TableCell>
                                            <TableCell>Статус</TableCell>
                                            <TableCell>Создано</TableCell>
                                            <TableCell align="right">Действия</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {applications.map((app) => (
                                            <TableRow key={app._id} hover>
                                                <TableCell sx={{ maxWidth: 220 }}>
                                                    <Typography variant="body2" fontWeight={600} noWrap>
                                                        {app.taskName}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" noWrap>
                                                        {app.bsNumber ? `БС ${app.bsNumber}` : '—'}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {app.publicStatus === 'assigned'
                                                            ? 'Назначена'
                                                            : app.publicStatus === 'open'
                                                                ? 'Открыта'
                                                                : app.publicStatus || '—'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{app.contractorName || '—'}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {app.contractorEmail || '—'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    {Number.isFinite(app.proposedBudget)
                                                        ? `${new Intl.NumberFormat('ru-RU').format(app.proposedBudget)} ₽`
                                                        : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        label={app.status}
                                                        color={
                                                            app.status === 'accepted'
                                                                ? 'success'
                                                                : app.status === 'rejected'
                                                                    ? 'error'
                                                                    : app.status === 'submitted'
                                                                        ? 'info'
                                                                        : 'default'
                                                        }
                                                        variant="outlined"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {app.createdAt
                                                            ? new Date(app.createdAt).toLocaleDateString('ru-RU')
                                                            : '—'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                        <Tooltip title="Перейти в задачу">
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => goToTaskDetails(app)}
                                                                    disabled={!app.projectKey}
                                                                >
                                                                    <PreviewIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                        <Tooltip title="Удалить отклик">
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={() => openRemoveApplicationDialog(app)}
                                                                    disabled={removingApplication}
                                                                >
                                                                    <DeleteOutlineOutlinedIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </DialogContent>
                <DialogActions
                    sx={{
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.8)' : 'rgba(255,255,255,0.85)',
                        borderTop: `1px solid ${cardBorder}`,
                        '& .MuiButton-root': { borderRadius: buttonRadius, textTransform: 'none' },
                    }}
                >
                    <Button onClick={() => setApplicationsDialogOpen(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            {/* Диалог добавления участника */}
            <Dialog
                open={inviteOpen}
                onClose={() => setInviteOpen(false)}
                maxWidth="sm"
                fullWidth
                slotProps={{
                    paper: {
                        sx: {
                            backdropFilter: 'blur(24px)',
                            backgroundColor: cardBg,
                            border: `1px solid ${cardBorder}`,
                            boxShadow: cardShadow,
                            borderRadius: theme.shape.borderRadius,
                        },
                    },
                }}
            >
                <DialogTitle sx={cardHeaderSx}>
                    Пригласить участника
                </DialogTitle>
                <DialogContent
                    dividers
                    sx={{ backgroundColor: cardContentSx.backgroundColor }}
                >
                    {org && (
                        <InviteMemberForm
                            org={org}
                            defaultRole="executor"
                            // передаём снимок, чтобы не было "уже в организации" сразу после генерации
                            existingEmails={inviteExistingEmails}
                        />
                    )}
                </DialogContent>
                <DialogActions
                    sx={{
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.8)' : 'rgba(255,255,255,0.85)',
                        borderTop: `1px solid ${cardBorder}`,
                        '& .MuiButton-root': { borderRadius: buttonRadius, textTransform: 'none' },
                    }}
                >
                    <Button variant="text" color="primary" onClick={() => setInviteOpen(false)}>
                        Закрыть
                    </Button>
                </DialogActions>
            </Dialog>

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
                              regionCode: resolveRegionCode(projectToEdit.regionCode),
                              operator: projectToEdit.operator,
                              managers: projectToEdit.managers ?? [],
                          }
                        : undefined
                }
            />

            {/* Диалог изменения роли участника */}
            <Dialog
                open={roleDialogOpen}
                onClose={() => setRoleDialogOpen(false)}
                slotProps={{
                    paper: {
                        sx: {
                            backdropFilter: 'blur(24px)',
                            backgroundColor: cardBg,
                            border: `1px solid ${cardBorder}`,
                            boxShadow: cardShadow,
                            borderRadius: theme.shape.borderRadius,
                        },
                    },
                }}
            >
                <DialogTitle sx={cardHeaderSx}>
                    Изменить роль участника
                </DialogTitle>
                <DialogContent sx={{ backgroundColor: cardContentSx.backgroundColor }}>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        {memberToEditRole?.userName || memberToEditRole?.userEmail}
                    </Typography>
                    <TextField
                        select
                        label="Роль"
                        fullWidth
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as OrgRole)}
                        sx={{ mt: 1 }}
                    >
                        {(['org_admin', 'manager', 'executor', 'viewer'] as OrgRole[]).map((r) => (
                            <MenuItem key={r} value={r}>
                                {roleLabel(r)}
                            </MenuItem>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions
                    sx={{
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.8)' : 'rgba(255,255,255,0.85)',
                        borderTop: `1px solid ${cardBorder}`,
                        '& .MuiButton-root': { borderRadius: buttonRadius, textTransform: 'none' },
                    }}
                >
                    <Button onClick={() => setRoleDialogOpen(false)}>Отмена</Button>
                    <Button
                        variant="contained"
                        onClick={async () => {
                            if (!org || !memberToEditRole?._id) return;
                            try {
                                const res = await fetch(
                                    `/api/org/${encodeURIComponent(org)}/members/${memberToEditRole._id}`,
                                    {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ role: newRole }),
                                    }
                                );
                                const data = await res.json();
                                if (!res.ok) {
                                    setSnack({ open: true, msg: data?.error || 'Ошибка изменения роли', sev: 'error' });
                                    return;
                                }
                                setSnack({ open: true, msg: 'Роль обновлена', sev: 'success' });
                                setRoleDialogOpen(false);
                                setMemberToEditRole(null);
                                await fetchMembers();
                            } catch (e: unknown) {
                                const msg = e instanceof Error ? e.message : 'Ошибка сети';
                                setSnack({ open: true, msg, sev: 'error' });
                            }
                        }}
                    >
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог удаления участника */}
            <Dialog
                open={removeOpen}
                onClose={removing ? undefined : closeRemoveDialog}
                slotProps={{
                    paper: {
                        sx: {
                            backdropFilter: 'blur(24px)',
                            backgroundColor: cardBg,
                            border: `1px solid ${cardBorder}`,
                            boxShadow: cardShadow,
                            borderRadius: theme.shape.borderRadius,
                        },
                    },
                }}
            >
                <DialogTitle sx={cardHeaderSx}>
                    Удалить участника?
                </DialogTitle>
                <DialogContent sx={{ backgroundColor: cardContentSx.backgroundColor }}>
                    <Typography variant="body2">
                        Вы действительно хотите удалить участника{' '}
                        <b>{memberToRemove?.userName || memberToRemove?.userEmail}</b>{' '}
                        из организации? Доступ пользователя {memberToRemove?.userName || memberToRemove?.userEmail} к проектам будет утерян.
                    </Typography>
                </DialogContent>
                <DialogActions
                    sx={{
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.8)' : 'rgba(255,255,255,0.85)',
                        borderTop: `1px solid ${cardBorder}`,
                        '& .MuiButton-root': { borderRadius: buttonRadius, textTransform: 'none' },
                    }}
                >
                    <Button onClick={closeRemoveDialog} disabled={removing}>Отмена</Button>
                    <Button color="error" variant="contained" onClick={confirmRemove} disabled={removing}>
                        {removing ? 'Удаляем…' : 'Удалить'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог удаления проекта */}
            <Dialog
                open={removeProjectOpen}
                onClose={removingProject ? undefined : closeRemoveProjectDialog}
                slotProps={{
                    paper: {
                        sx: {
                            backdropFilter: 'blur(24px)',
                            backgroundColor: cardBg,
                            border: `1px solid ${cardBorder}`,
                            boxShadow: cardShadow,
                            borderRadius: theme.shape.borderRadius,
                        },
                    },
                }}
            >
                <DialogTitle sx={cardHeaderSx}>
                    Удалить проект?
                </DialogTitle>
                <DialogContent sx={{ backgroundColor: cardContentSx.backgroundColor }}>
                    <Typography variant="body2">
                        Вы действительно хотите удалить проект{' '}
                        <b>{projectToRemove?.name || projectToRemove?.key}</b>?
                    </Typography>
                </DialogContent>
                <DialogActions
                    sx={{
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.8)' : 'rgba(255,255,255,0.85)',
                        borderTop: `1px solid ${cardBorder}`,
                        '& .MuiButton-root': { borderRadius: buttonRadius, textTransform: 'none' },
                    }}
                >
                    <Button onClick={closeRemoveProjectDialog} disabled={removingProject}>Отмена</Button>
                    <Button color="error" variant="contained" onClick={confirmRemoveProject} disabled={removingProject}>
                        {removingProject ? 'Удаляем…' : 'Удалить'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог удаления отклика */}
            <Dialog
                open={removeApplicationOpen}
                onClose={removingApplication ? undefined : closeRemoveApplicationDialog}
                slotProps={{
                    paper: {
                        sx: {
                            backdropFilter: 'blur(24px)',
                            backgroundColor: cardBg,
                            border: `1px solid ${cardBorder}`,
                            boxShadow: cardShadow,
                            borderRadius: theme.shape.borderRadius,
                        },
                    },
                }}
            >
                <DialogTitle sx={cardHeaderSx}>
                    Удалить отклик?
                </DialogTitle>
                <DialogContent sx={{ backgroundColor: cardContentSx.backgroundColor }}>
                    <Typography variant="body2">
                        Вы уверены, что хотите удалить отклик на задачу{' '}
                        <b>{applicationToRemove?.taskName || 'Задача'}</b>{' '}
                        от кандидата {applicationToRemove?.contractorName || applicationToRemove?.contractorEmail || 'без имени'}?
                    </Typography>
                </DialogContent>
                <DialogActions
                    sx={{
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.8)' : 'rgba(255,255,255,0.85)',
                        borderTop: `1px solid ${cardBorder}`,
                        '& .MuiButton-root': { borderRadius: buttonRadius, textTransform: 'none' },
                    }}
                >
                    <Button onClick={closeRemoveApplicationDialog} disabled={removingApplication}>Отмена</Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={confirmRemoveApplication}
                        disabled={removingApplication}
                    >
                        {removingApplication ? 'Удаляем…' : 'Удалить'}
                    </Button>
                </DialogActions>
            </Dialog>

            <OrgWalletTransactionsDialog
                open={walletDialogOpen}
                onClose={() => setWalletDialogOpen(false)}
                loading={walletTxLoading}
                error={walletTxError}
                transactions={walletTx}
            />

            <OrgSetDialog
                open={orgSettingsOpen}
                loading={orgSettingsSaving}
                initialValues={orgSettingsData}
                onCloseAction={() => setOrgSettingsOpen(false)}
                onSubmit={handleOrgSettingsSubmit}
            />

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
            >
                <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.sev} variant="filled">
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
