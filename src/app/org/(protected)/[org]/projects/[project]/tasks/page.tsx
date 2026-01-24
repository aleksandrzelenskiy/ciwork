// src/app/org/[org]/projects/[project]/tasks/page.tsx

'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { withBasePath } from '@/utils/basePath';
import {
    Box,
    Stack,
    Typography,
    Button,
    Tabs,
    Tab,
    Paper,
    TextField,
    IconButton,
    InputAdornment,
    Tooltip,
    Popover,
    Autocomplete,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddTaskIcon from '@mui/icons-material/AddTask';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { SelectChangeEvent } from '@mui/material/Select';
import { UI_RADIUS } from '@/config/uiTokens';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import WorkspaceTaskDialog from '@/app/workspace/components/WorkspaceTaskDialog';
import ProjectTaskList, { ProjectTaskListHandle } from '@/app/workspace/components/ProjectTaskList';
import ProjectTaskBoard from '@/app/workspace/components/ProjectTaskBoard';
import ProjectTaskCalendar from '@/app/workspace/components/ProjectTaskCalendar';
import { defaultTaskFilters, type TaskFilters } from '@/app/types/taskFilters';
import { getPriorityLabelRu } from '@/utils/priorityIcons';
import { startOfDay, endOfDay, format } from 'date-fns';
import { getStatusLabel, normalizeStatusTitle, STATUS_ORDER } from '@/utils/statusLabels';
import ProfileDialog from '@/features/profile/ProfileDialog';

type Priority = 'urgent' | 'high' | 'medium' | 'low';

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: string;
    assignees?: Array<{ name?: string; email?: string; avatarUrl?: string }>;
    dueDate?: string;
    createdAt?: string;
    bsNumber?: string;
    totalCost?: number;
    priority?: Priority;
    executorName?: string;
    executorEmail?: string;
};

type OrgInfo = { _id: string; name: string; orgSlug: string; description?: string };

type ApiListResponse =
    | { ok: true; page: number; limit: number; total: number; items: Task[] }
    | { error: string };
type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';
type MemberDTO = {
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: 'active' | 'invited' | 'requested';
    profilePic?: string;
    clerkId?: string;
};
type MembersResponse = { members: MemberDTO[] } | { error: string };
type ProjectMetaResponse =
    | {
    ok: true;
    project: {
        description?: string | null;
        key?: string | null;
        managers?: string[] | null;
    };
}
    | { error: string };

const getExecutorLabel = (task: Task) => {
    const candidate =
        task.assignees?.find((assignee) => assignee?.name || assignee?.email) ||
        null;
    if (candidate) {
        return (candidate.name?.trim() || candidate.email?.trim() || '').trim();
    }
    const fallback = task.executorName?.trim() || task.executorEmail?.trim() || '';
    return fallback.trim();
};

export default function ProjectTasksPage() {
    const params = useParams<{ org: string; project: string }>() as {
        org: string;
        project: string;
    };
    const router = useRouter();
    const org = params.org;
    const project = params.project;

    const orgSlug = React.useMemo(() => org?.trim(), [org]);
    const projectRef = React.useMemo(() => project?.trim(), [project]);
    const [projectKey, setProjectKey] = React.useState<string | null>(null);
    const projectKeyRef = projectKey || projectRef;

    React.useEffect(() => {
        setProjectKey(null);
    }, [projectRef]);

    const [tab, setTab] = React.useState<'list' | 'board' | 'calendar'>('list');
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState('');
    const [projectDescription, setProjectDescription] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [items, setItems] = React.useState<Task[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const taskListRef = React.useRef<ProjectTaskListHandle>(null);
    const [searchAnchor, setSearchAnchor] = React.useState<HTMLElement | null>(null);
    const [filterDialogOpen, setFilterDialogOpen] = React.useState(false);
    const [filters, setFilters] = React.useState<TaskFilters>(defaultTaskFilters);
    const [hasCustomColumns, setHasCustomColumns] = React.useState(false);

    const [orgInfo, setOrgInfo] = React.useState<OrgInfo | null>(null);
    const [orgInfoError, setOrgInfoError] = React.useState<string | null>(null);
    const [projectManagers, setProjectManagers] = React.useState<string[]>([]);
    const [membersByEmail, setMembersByEmail] = React.useState<Record<string, MemberDTO>>({});
    const [profileUserId, setProfileUserId] = React.useState<string | null>(null);
    const [profileOpen, setProfileOpen] = React.useState(false);
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const headerBg = isDarkMode ? 'rgba(17,22,33,0.85)' : 'rgba(255,255,255,0.55)';
    const headerBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
    const headerShadow = isDarkMode ? '0 25px 70px rgba(0,0,0,0.55)' : '0 25px 80px rgba(15,23,42,0.1)';
    const sectionBg = isDarkMode ? 'rgba(18,24,36,0.85)' : 'rgba(255,255,255,0.65)';
    const sectionBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)';
    const sectionShadow = isDarkMode ? '0 35px 90px rgba(0,0,0,0.5)' : '0 35px 90px rgba(15,23,42,0.15)';
    const textPrimary = isDarkMode ? '#f8fafc' : '#0f172a';
    const textSecondary = isDarkMode ? 'rgba(226,232,240,0.8)' : 'rgba(15,23,42,0.7)';
    const iconBorderColor = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.12)';
    const iconBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
    const iconHoverBg = isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)';
    const iconShadow = isDarkMode ? '0 6px 18px rgba(0,0,0,0.4)' : '0 6px 18px rgba(15,23,42,0.08)';
    const iconText = textPrimary;
    const iconActiveBg = isDarkMode ? 'rgba(59,130,246,0.4)' : 'rgba(15,23,42,0.9)';
    const iconActiveText = '#ffffff';
    const disabledIconColor = isDarkMode ? 'rgba(148,163,184,0.7)' : 'rgba(15,23,42,0.35)';
    const tabActiveBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
    const tabInactiveColor = isDarkMode ? 'rgba(226,232,240,0.65)' : 'rgba(15,23,42,0.55)';
    const tabBorderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';
    const buttonShadow = isDarkMode ? '0 25px 45px rgba(0,0,0,0.55)' : '0 20px 45px rgba(15,23,42,0.18)';

    React.useEffect(() => {
        if (!orgSlug) return;
        const ctrl = new AbortController();

        async function fetchOrg(): Promise<void> {
            try {
                setOrgInfoError(null);
                const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}`, {
                    signal: ctrl.signal,
                    cache: 'no-store',
                });

                const data = (await res.json().catch(() => null)) as
                    | { org: OrgInfo; role: string }
                    | { error: string }
                    | null;

                if (!res.ok || !data || 'error' in data) {
                    setOrgInfoError(
                        !data || !('error' in data)
                            ? `Failed to load org: ${res.status}`
                            : data.error
                    );
                    setOrgInfo(null);
                    return;
                }
                setOrgInfo(data.org);
            } catch (e) {
                if ((e as DOMException)?.name !== 'AbortError') {
                    setOrgInfoError(e instanceof Error ? e.message : 'Org load error');
                }
            }
        }

        void fetchOrg();
        return () => ctrl.abort();
    }, [orgSlug]);

    const filterOptions = React.useMemo(() => {
        const executorSet = new Set<string>();
        for (const task of items) {
            const label = getExecutorLabel(task);
            if (label) {
                executorSet.add(label);
            }
        }
        const statuses = Array.from(
            new Set(
                items
                    .map((task) => normalizeStatusTitle(task.status))
            )
        );
        const priorities = Array.from(
            new Set(
                items
                    .map((task) => task.priority)
                    .filter((priority): priority is Priority => Boolean(priority))
            )
        );
        const orderedStatuses = STATUS_ORDER.filter((status) => statuses.includes(status));
        const remainingStatuses = statuses.filter((status) => !STATUS_ORDER.includes(status));
        return {
            executors: Array.from(executorSet),
            statuses: [...orderedStatuses, ...remainingStatuses],
            priorities,
        };
    }, [items]);

    const filteredItems = React.useMemo(() => {
        return items.filter((task) => {
            if (filters.status && task.status !== filters.status) return false;
            if (filters.priority && task.priority !== filters.priority) return false;
            if (filters.executor) {
                const label = getExecutorLabel(task);
                if (!label || label !== filters.executor) {
                    return false;
                }
            }

            if (filters.dueFrom || filters.dueTo) {
                if (!task.dueDate) {
                    return false;
                }
                const dueDate = new Date(task.dueDate);
                if (Number.isNaN(dueDate.getTime())) {
                    return false;
                }
                if (filters.dueFrom && dueDate < startOfDay(filters.dueFrom)) {
                    return false;
                }
                if (filters.dueTo && dueDate > endOfDay(filters.dueTo)) {
                    return false;
                }
            }

            return true;
        });
    }, [items, filters]);

    const load = React.useCallback(async () => {
        if (!orgSlug || !projectRef) return;
        try {
            setLoading(true);
            setError(null);
            const url = new URL(
                withBasePath(
                    `/api/org/${encodeURIComponent(orgSlug)}/projects/${encodeURIComponent(
                        projectRef
                    )}/tasks`
                ),
                window.location.origin
            );
            if (q) url.searchParams.set('q', q);
            url.searchParams.set('limit', '200');

            const res = await fetch(url.toString(), { cache: 'no-store' });
            const data: ApiListResponse = await res.json();

            if (!('ok' in data)) {
                setError(data.error || 'Failed to load');
                setItems([]);
            } else {
                setItems(data.items || []);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Network error');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [orgSlug, projectRef, q]);

    React.useEffect(() => {
        void load();
    }, [load]);

    React.useEffect(() => {
        if (!orgSlug || !projectRef) return;
        let cancelled = false;

        void (async () => {
            try {
                const res = await fetch(
                    withBasePath(
                        `/api/org/${encodeURIComponent(orgSlug)}/projects/${encodeURIComponent(
                            projectRef
                        )}`
                    ),
                    { cache: 'no-store' }
                );
                if (!res.ok) return;
                const data = (await res.json().catch(() => null)) as ProjectMetaResponse | null;
                if (!data || 'error' in data) return;
                if (!cancelled) {
                    setProjectDescription(data.project.description ?? null);
                    setProjectKey(data.project.key ?? null);
                    setProjectManagers(
                        Array.isArray(data.project.managers) ? data.project.managers : []
                    );
                }
            } catch {
                // описание опционально, ошибки игнорируем
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [orgSlug, projectRef]);

    React.useEffect(() => {
        if (!orgSlug || !projectRef || !projectKey) return;
        if (projectKey === projectRef) return;
        router.replace(
            `/org/${encodeURIComponent(orgSlug)}/projects/${encodeURIComponent(projectKey)}/tasks`
        );
    }, [orgSlug, projectKey, projectRef, router]);

    React.useEffect(() => {
        if (!orgSlug) return;
        const ctrl = new AbortController();
        let cancelled = false;

        void (async () => {
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(orgSlug)}/members?status=active`,
                    { cache: 'no-store', signal: ctrl.signal }
                );
                const data: MembersResponse = await res.json();
                if (!res.ok || !('members' in data) || cancelled) {
                    if (!cancelled) {
                        console.error(
                            'Failed to load members',
                            'error' in data ? data.error : `status: ${res.status}`
                        );
                        setMembersByEmail({});
                    }
                    return;
                }

                const record: Record<string, MemberDTO> = {};
                for (const member of data.members) {
                    if (member.userEmail) {
                        record[member.userEmail.toLowerCase()] = member;
                    }
                }
                if (!cancelled) {
                    setMembersByEmail(record);
                }
            } catch (e) {
                if ((e as DOMException)?.name === 'AbortError' || cancelled) return;
                console.error('Failed to load members', e);
                setMembersByEmail({});
            }
        })();

        return () => {
            cancelled = true;
            ctrl.abort();
        };
    }, [orgSlug]);

    const handleSearchIconClick = (event: React.MouseEvent<HTMLElement>) => {
        if (searchAnchor && event.currentTarget === searchAnchor) {
            setSearchAnchor(null);
            return;
        }
        setSearchAnchor(event.currentTarget);
    };

    const handleSearchClose = () => {
        setSearchAnchor(null);
    };

    const handleSearchReset = () => {
        setQ('');
        handleSearchClose();
        void load();
    };

    const searchOpen = Boolean(searchAnchor);
    const hasActiveFilters = Boolean(
        filters.executor || filters.status || filters.priority || filters.dueFrom || filters.dueTo
    );
    const activeFilterCount =
        Number(Boolean(filters.executor)) +
        Number(Boolean(filters.status)) +
        Number(Boolean(filters.priority)) +
        Number(Boolean(filters.dueFrom)) +
        Number(Boolean(filters.dueTo));
    const getIconButtonSx = (
        options?: { active?: boolean; disabled?: boolean; activeColor?: string }
    ) => {
        const active = options?.active ?? false;
        const disabled = options?.disabled ?? false;
        return {
            borderRadius: UI_RADIUS.overlay,
            border: `1px solid ${disabled ? 'transparent' : iconBorderColor}`,
            backgroundColor: disabled
                ? 'transparent'
                : iconBg,
            color: disabled
                ? disabledIconColor
                : active
                    ? options?.activeColor ?? iconActiveText
                    : iconText,
            boxShadow: disabled ? 'none' : iconShadow,
            backdropFilter: 'blur(14px)',
            transition: 'all 0.2s ease',
            '&:hover': {
                transform: disabled ? 'none' : 'translateY(-2px)',
                backgroundColor: disabled
                    ? 'transparent'
                    : active
                        ? iconActiveBg
                        : iconHoverBg,
            },
        };
    };

    const handleFilterButtonClick = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        setFilterDialogOpen(true);
    };

    const handleFilterClose = () => {
        setFilterDialogOpen(false);
    };

    const handleFilterReset = () => {
        setFilters(defaultTaskFilters);
    };

    const handleExecutorFilterChange = (_event: React.SyntheticEvent, value: string | null) => {
        setFilters((prev) => ({ ...prev, executor: value }));
    };

    const handleSelectFilterChange =
        (key: 'status' | 'priority') => (event: SelectChangeEvent) => {
            const value = event.target.value;
            setFilters((prev) => ({ ...prev, [key]: value }));
        };

    const handleDueDateChange =
        (key: 'dueFrom' | 'dueTo') => (value: Date | null) => {
            setFilters((prev) => ({ ...prev, [key]: value }));
        };

    const handleRemoveFilter = (key: keyof TaskFilters) => {
        setFilters((prev) => ({ ...prev, [key]: defaultTaskFilters[key] }));
    };

    const filterChips = React.useMemo(() => {
        const chips: Array<{ key: keyof TaskFilters; label: string }> = [];
        if (filters.executor) chips.push({ key: 'executor', label: `Исполнитель: ${filters.executor}` });
        if (filters.status) chips.push({ key: 'status', label: `Статус: ${getStatusLabel(filters.status)}` });
        if (filters.priority) chips.push({ key: 'priority', label: `Приоритет: ${getPriorityLabelRu(filters.priority)}` });
        if (filters.dueFrom) chips.push({ key: 'dueFrom', label: `Срок от: ${format(filters.dueFrom, 'dd.MM.yyyy')}` });
        if (filters.dueTo) chips.push({ key: 'dueTo', label: `Срок до: ${format(filters.dueTo, 'dd.MM.yyyy')}` });
        return chips;
    }, [filters]);

    const primaryManagerRaw = React.useMemo(() => {
        const first = projectManagers.find((manager) => manager.trim().length > 0);
        return first?.trim() ?? null;
    }, [projectManagers]);

    const managerDisplayName = React.useMemo(() => {
        if (!primaryManagerRaw) return null;
        const normalized = primaryManagerRaw.toLowerCase();
        const member = membersByEmail[normalized];
        if (member?.userName) return member.userName;
        if (member?.userEmail) return member.userEmail;
        return primaryManagerRaw;
    }, [primaryManagerRaw, membersByEmail]);

    const managerClerkId = React.useMemo(() => {
        if (!primaryManagerRaw) return null;
        const normalized = primaryManagerRaw.toLowerCase();
        return membersByEmail[normalized]?.clerkId ?? null;
    }, [primaryManagerRaw, membersByEmail]);

    const openProfileDialog = (clerkUserId?: string | null) => {
        if (!clerkUserId) return;
        setProfileUserId(clerkUserId);
        setProfileOpen(true);
    };

    const closeProfileDialog = () => {
        setProfileOpen(false);
        setProfileUserId(null);
    };

    const userProfilesForList = React.useMemo(() => {
        const record: Record<string, { name?: string; profilePic?: string; clerkUserId?: string }> = {};
        for (const [email, member] of Object.entries(membersByEmail)) {
            record[email] = {
                name: member.userName ?? member.userEmail,
                profilePic: member.profilePic,
                clerkUserId: member.clerkId,
            };
        }
        return record;
    }, [membersByEmail]);

    return (
        <Box
            sx={{
                minHeight: '100%',
                py: { xs: 4, md: 6 },
                px: { xs: 0.25, md: 6 },
            }}
        >
            <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
                <Box
                    sx={{
                        mb: 3,
                        borderRadius: UI_RADIUS.surface,
                        p: { xs: 2, md: 3 },
                        backgroundColor: headerBg,
                        border: `1px solid ${headerBorder}`,
                        boxShadow: headerShadow,
                        backdropFilter: 'blur(22px)',
                    }}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Box>
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                                <Tooltip title="К списку проектов">
                                    <span>
                                        <IconButton
                                            component="a"
                                            href={
                                                orgSlug
                                                    ? `/org/${encodeURIComponent(orgSlug)}/projects`
                                                    : '#'
                                            }
                                            disabled={!orgSlug}
                                            aria-label="Перейти к проектам"
                                            sx={getIconButtonSx({ disabled: !orgSlug })}
                                        >
                                            <ArrowBackIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Typography
                                    variant="h5"
                                    fontWeight={700}
                                    color={textPrimary}
                                    sx={{ fontSize: { xs: '1.6rem', md: '1.95rem' } }}
                                >
                                    Задачи {projectKeyRef}
                                </Typography>
                            </Stack>
                            <Typography
                                variant="body1"
                                color={textSecondary}
                                sx={{ fontSize: { xs: '1rem', md: '1.05rem' } }}
                            >
                                Организация:{' '}
                                {orgSlug ? (
                                    <Box
                                        component={Link}
                                        href={`/org/${encodeURIComponent(orgSlug)}`}
                                        sx={{
                                            color: textPrimary,
                                            fontWeight: 600,
                                            textDecoration: 'none',
                                            '&:hover': { textDecoration: 'underline' },
                                        }}
                                    >
                                        {orgInfo?.name ?? '—'}
                                    </Box>
                                ) : (
                                    orgInfo?.name ?? '—'
                                )}
                            </Typography>
                            {managerDisplayName && (
                                <Typography
                                    variant="body1"
                                    color={textSecondary}
                                    sx={{ fontSize: { xs: '1rem', md: '1.05rem' }, mt: 0.5 }}
                                >
                                    Менеджер проекта:{' '}
                                    {managerClerkId ? (
                                        <Button
                                            variant="text"
                                            size="small"
                                            onClick={() => openProfileDialog(managerClerkId)}
                                            sx={{
                                                textTransform: 'none',
                                                px: 0,
                                                minWidth: 0,
                                                fontWeight: 600,
                                                fontSize: { xs: '1.05rem', md: '1.15rem' },
                                            }}
                                        >
                                            {managerDisplayName}
                                        </Button>
                                    ) : (
                                        <Box
                                            component="span"
                                            sx={{
                                                color: textPrimary,
                                                fontWeight: 600,
                                                fontSize: { xs: '1.05rem', md: '1.15rem' },
                                            }}
                                        >
                                            {managerDisplayName}
                                        </Box>
                                    )}
                                </Typography>
                            )}
                            {projectDescription && (
                                <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                    {projectDescription}
                                </Typography>
                            )}
                            {orgInfoError && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                                    Не удалось загрузить организацию: {orgInfoError}
                                </Typography>
                            )}
                        </Box>
                        <Stack
                            direction="row"
                            spacing={1.25}
                            alignItems="center"
                            sx={{ flexWrap: 'wrap', rowGap: 1 }}
                        >
                            <Tooltip title="Поиск">
                                <IconButton
                                    onClick={handleSearchIconClick}
                                    sx={getIconButtonSx({ active: searchOpen || Boolean(q) })}
                                >
                                    <SearchIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Фильтры задач">
                                <IconButton
                                    onClick={handleFilterButtonClick}
                                    sx={getIconButtonSx({
                                        active: filterDialogOpen || hasActiveFilters,
                                        activeColor: theme.palette.primary.main,
                                    })}
                                >
                                    <FilterListIcon />
                                </IconButton>
                            </Tooltip>
                            {tab === 'list' && (
                                <Tooltip title="Настроить колонки">
                                    <IconButton
                                        onClick={() => taskListRef.current?.openColumns()}
                                        sx={getIconButtonSx({
                                            active: hasCustomColumns,
                                            activeColor: theme.palette.primary.main,
                                        })}
                                    >
                                        <ViewColumnOutlinedIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Tooltip title="Обновить">
                                <span>
                                    <IconButton
                                        onClick={() => void load()}
                                        disabled={loading}
                                        sx={getIconButtonSx({ disabled: loading })}
                                    >
                                        <RefreshIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Button
                                onClick={() => setOpen(true)}
                                variant="contained"
                                startIcon={<AddTaskIcon />}
                                sx={{
                                    borderRadius: UI_RADIUS.pill,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    px: { xs: 2.5, md: 3 },
                                    py: 1,
                                    boxShadow: buttonShadow,
                                }}
                            >
                                Создать задачу
                            </Button>
                        </Stack>
                    </Stack>
                </Box>

                <Popover
                    open={searchOpen}
                    anchorEl={searchAnchor}
                    onClose={handleSearchClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    PaperProps={{
                        sx: {
                            borderRadius: UI_RADIUS.tooltip,
                            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)'}`,
                            backgroundColor: isDarkMode
                                ? 'rgba(15,18,28,0.95)'
                                : 'rgba(255,255,255,0.9)',
                            boxShadow: isDarkMode
                                ? '0 25px 70px rgba(0,0,0,0.6)'
                                : '0 25px 70px rgba(15,23,42,0.15)',
                            backdropFilter: 'blur(18px)',
                        },
                    }}
                >
                    <Box sx={{ p: 2, width: 320 }}>
                        <TextField
                            label="Поиск (ID, название, БС)"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    handleSearchClose();
                                }
                            }}
                            autoFocus
                            fullWidth
                            InputProps={{
                                endAdornment: q ? (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={handleSearchReset}
                                            edge="end"
                                        >
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            }}
                        />
                    </Box>
                </Popover>

                <Dialog open={filterDialogOpen} onClose={handleFilterClose} fullWidth maxWidth="xs">
                    <DialogTitle
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            pr: 1,
                        }}
                    >
                        <Typography variant="h6" fontWeight={600}>
                            Фильтры задач
                        </Typography>
                        <IconButton onClick={handleFilterClose}>
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent
                        dividers
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                        }}
                    >
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <Stack spacing={2}>
                                <Autocomplete
                                    options={filterOptions.executors}
                                    value={filters.executor ?? null}
                                    onChange={handleExecutorFilterChange}
                                    disablePortal
                                    clearOnEscape
                                    handleHomeEndKeys
                                    renderInput={(params) => (
                                        <TextField {...params} label="Исполнитель" size="small" />
                                    )}
                                />
                                <FormControl fullWidth size="small">
                                    <InputLabel>Статус</InputLabel>
                                    <Select
                                        label="Статус"
                                        value={filters.status}
                                        onChange={handleSelectFilterChange('status')}
                                    >
                                        <MenuItem value="">
                                            <em>Все</em>
                                        </MenuItem>
                                        {filterOptions.statuses.map((status) => (
                                            <MenuItem key={status} value={status}>
                                                {getStatusLabel(status)}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Приоритет</InputLabel>
                                    <Select
                                        label="Приоритет"
                                        value={filters.priority}
                                        onChange={handleSelectFilterChange('priority')}
                                    >
                                        <MenuItem value="">
                                            <em>Все</em>
                                        </MenuItem>
                                        {filterOptions.priorities.map((priority) => (
                                            <MenuItem key={priority} value={priority}>
                                                {getPriorityLabelRu(priority)}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Stack direction="row" spacing={1}>
                                    <DatePicker
                                        label="Срок от"
                                        value={filters.dueFrom}
                                        onChange={handleDueDateChange('dueFrom')}
                                        slotProps={{ textField: { size: 'small' } }}
                                    />
                                    <DatePicker
                                        label="Срок до"
                                        value={filters.dueTo}
                                        onChange={handleDueDateChange('dueTo')}
                                        slotProps={{ textField: { size: 'small' } }}
                                    />
                                </Stack>
                                {filterChips.length > 0 && (
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        {filterChips.map((chip) => (
                                            <Chip
                                                key={chip.key}
                                                label={chip.label}
                                                onDelete={() => handleRemoveFilter(chip.key)}
                                                color="primary"
                                                variant="outlined"
                                            />
                                        ))}
                                    </Stack>
                                )}
                                {hasActiveFilters && (
                                    <Typography variant="caption" color="text.secondary">
                                        Активные фильтры: {activeFilterCount}
                                    </Typography>
                                )}
                            </Stack>
                        </LocalizationProvider>
                    </DialogContent>
                    <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
                        <Button onClick={handleFilterReset} color="secondary">
                            Сбросить
                        </Button>
                        <Button variant="contained" onClick={handleFilterClose}>
                            Готово
                        </Button>
                    </DialogActions>
                </Dialog>

                <Paper
                    variant="outlined"
                    sx={{
                        p: { xs: 2, md: 3 },
                        borderRadius: UI_RADIUS.surface,
                        border: `1px solid ${sectionBorder}`,
                        backgroundColor: sectionBg,
                        boxShadow: sectionShadow,
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v as 'list' | 'board' | 'calendar')}
                        sx={{
                            minHeight: 0,
                            mb: 2.5,
                            borderRadius: UI_RADIUS.tooltip,
                            border: `1px solid ${tabBorderColor}`,
                            backgroundColor: isDarkMode ? 'rgba(15,18,28,0.65)' : 'rgba(255,255,255,0.7)',
                            '& .MuiTabs-indicator': {
                                display: 'none',
                            },
                        }}
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        <Tab
                            value="list"
                            label="Список"
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: { xs: '0.9rem', md: '1rem' },
                                borderRadius: UI_RADIUS.tooltip,
                                px: { xs: 1.5, md: 2.5 },
                                py: 1,
                                minHeight: 0,
                                minWidth: 0,
                                color: tabInactiveColor,
                                '&.Mui-selected': {
                                    backgroundColor: tabActiveBg,
                                    color: textPrimary,
                                    boxShadow: iconShadow,
                                },
                            }}
                        />
                        <Tab
                            value="board"
                            label="Доска"
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: { xs: '0.9rem', md: '1rem' },
                                borderRadius: UI_RADIUS.tooltip,
                                px: { xs: 1.5, md: 2.5 },
                                py: 1,
                                minHeight: 0,
                                minWidth: 0,
                                color: tabInactiveColor,
                                '&.Mui-selected': {
                                    backgroundColor: tabActiveBg,
                                    color: textPrimary,
                                    boxShadow: iconShadow,
                                },
                            }}
                        />
                        <Tab
                            value="calendar"
                            label="Календарь"
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: { xs: '0.9rem', md: '1rem' },
                                borderRadius: UI_RADIUS.tooltip,
                                px: { xs: 1.5, md: 2.5 },
                                py: 1,
                                minHeight: 0,
                                minWidth: 0,
                                color: tabInactiveColor,
                                '&.Mui-selected': {
                                    backgroundColor: tabActiveBg,
                                    color: textPrimary,
                                    boxShadow: iconShadow,
                                },
                            }}
                        />
                    </Tabs>

                    {tab === 'list' && (
                        <ProjectTaskList
                            ref={taskListRef}
                            items={filteredItems}
                            loading={loading}
                            error={error}
                            org={orgSlug || ''}
                            project={projectKeyRef || ''}
                            onReloadAction={() => {
                                void load();
                            }}
                            userProfiles={userProfilesForList}
                            onColumnsCustomizationChange={setHasCustomColumns}
                        />
                    )}

                    {tab === 'board' && (
                        <ProjectTaskBoard
                            items={filteredItems}
                            loading={loading}
                            error={error}
                            org={orgSlug || ''}
                            project={projectKeyRef || ''}
                            onReloadAction={() => {
                                void load();
                            }}
                        />
                    )}

                    {tab === 'calendar' && (
                        <ProjectTaskCalendar
                            items={filteredItems}
                            loading={loading}
                            error={error}
                            org={orgSlug || ''}
                            project={projectKeyRef || ''}
                            onReloadAction={() => {
                                void load();
                            }}
                        />
                    )}

                    <WorkspaceTaskDialog
                        open={open}
                        org={orgSlug || ''}
                        project={projectKeyRef || ''}
                        onCloseAction={() => setOpen(false)}
                        onCreatedAction={() => {
                            setOpen(false);
                            void load();
                        }}
                    />

                    <ProfileDialog
                        open={profileOpen}
                        onClose={closeProfileDialog}
                        clerkUserId={profileUserId}
                    />
                </Paper>
            </Box>
        </Box>
    );
}
