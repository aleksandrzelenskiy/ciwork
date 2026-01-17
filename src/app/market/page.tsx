// src/app/market/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import {
    Box,
    Container,
    Paper,
    Stack,
    Typography,
    Chip,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Alert,
    Snackbar,
    Divider,
    Tooltip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    MenuItem,
    Autocomplete,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { styled } from '@mui/material/styles';
import Masonry from '@mui/lab/Masonry';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import SendIcon from '@mui/icons-material/Send';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import CloseIcon from '@mui/icons-material/Close';
import CurrencyRubleRounded from '@mui/icons-material/CurrencyRubleRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import TocOutlinedIcon from '@mui/icons-material/TocOutlined';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FilterListIcon from '@mui/icons-material/FilterList';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import type { PublicTaskStatus, TaskVisibility } from '@/app/types/taskTypes';
import type { PriorityLevel, TaskType } from '@/app/types/taskTypes';
import type { TaskApplication } from '@/app/types/application';
import MarketLocations, { type MarketPublicTask } from '@/features/market/MarketLocations';
import { REGION_MAP } from '@/app/utils/regions';
import { getPriorityLabelRu } from '@/utils/priorityIcons';
import { UI_RADIUS } from '@/config/uiTokens';
import { withBasePath } from '@/utils/basePath';

dayjs.locale('ru');

type PublicTask = {
    _id: string;
    taskName: string;
    bsNumber?: string;
    orgId?: string;
    orgSlug?: string;
    orgName?: string;
    taskDescription?: string;
    budget?: number;
    currency?: string;
    bsAddress?: string;
    bsLocation?: { name?: string; coordinates?: string; address?: string }[];
    dueDate?: string;
    priority?: PriorityLevel;
    taskType?: TaskType;
    attachments?: string[];
    workItems?: { workType?: string; quantity?: number; unit?: string; note?: string }[];
    publicDescription?: string;
    publicStatus?: PublicTaskStatus;
    visibility?: TaskVisibility;
    applicationCount?: number;
    project?: {
        name?: string;
        key?: string;
        regionCode?: string;
        operator?: string;
    };
    myApplication?: Pick<TaskApplication, '_id' | 'status' | 'proposedBudget' | 'etaDays' | 'coverMessage'> | null;
    createdAt?: string;
};

type TaskResponse = { tasks?: PublicTask[]; error?: string };

type UserContext = {
    profileType?: 'employer' | 'contractor';
    name?: string;
    email?: string;
    user?: { _id?: string };
};

type BudgetDisplay = {
    label: string;
    amount: string | null;
    currencyCode: string;
    isRuble: boolean;
};

const glassPaperStyles = (theme: { palette: { mode: string } }) => ({
    p: 3,
    borderRadius: UI_RADIUS.tooltip,
    border: '1px solid',
    borderColor:
        theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(15,23,42,0.08)',
    background:
        theme.palette.mode === 'dark'
            ? 'rgba(13,17,26,0.8)'
            : 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(18px)',
    boxShadow:
        theme.palette.mode === 'dark'
            ? '0 30px 90px rgba(0,0,0,0.55)'
            : '0 30px 90px rgba(15,23,42,0.08)',
});

const mapMarketTaskToPublicTask = (task: MarketPublicTask): PublicTask => ({
    _id: task._id,
    taskName: task.taskName || 'Задача',
    taskDescription: task.taskDescription,
    bsNumber: task.bsNumber,
    bsAddress: task.bsAddress,
    bsLocation: task.bsLocation?.map((loc) => ({
        name: loc?.name,
        coordinates: loc?.coordinates ?? undefined,
        address: loc?.address,
    })),
    orgSlug: task.orgSlug,
    orgName: task.orgName,
    budget: task.budget ?? undefined,
    currency: task.currency,
    dueDate: task.dueDate,
    priority: task.priority,
    taskType: task.taskType,
    attachments: task.attachments,
    workItems: task.workItems,
    publicDescription: task.publicDescription,
    publicStatus: task.publicStatus,
    visibility: task.visibility,
    applicationCount: task.applicationCount,
    project: task.project,
    myApplication: task.myApplication,
});

const statusChipMap: Record<PublicTaskStatus, { label: string; color: 'default' | 'success' | 'warning' }> = {
    open: { label: 'Открыта', color: 'success' },
    in_review: { label: 'На рассмотрении', color: 'warning' },
    assigned: { label: 'Назначена', color: 'default' },
    closed: { label: 'Закрыта', color: 'default' },
};

const CardItem = styled(Paper)(({ theme }) => ({
    backgroundColor: '#fff',
    padding: theme.spacing(2),
    borderRadius: UI_RADIUS.surface,
    boxShadow: theme.shadows[3],
    ...theme.applyStyles?.('dark', {
        backgroundColor: '#1A2027',
    }),
}));

function getBudgetDisplay(budget?: number, currency?: string): BudgetDisplay {
    const code = currency || 'RUB';
    const isRuble = code === 'RUB';

    if (!budget || budget <= 0) {
        return { label: 'Бюджет не указан', amount: null, currencyCode: isRuble ? '₽' : code, isRuble };
    }

    const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

    return {
        label: `${fmt.format(budget)} ${isRuble ? '₽' : code}`,
        amount: fmt.format(budget),
        currencyCode: isRuble ? '₽' : code,
        isRuble,
    };
}

function getRegionLabel(code?: string) {
    if (!code) return '';
    const region = REGION_MAP.get(code) || REGION_MAP.get(code.toUpperCase());
    return region?.label || '';
}

function formatDateRu(dateInput?: string) {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function getTaskTypeLabel(taskType?: TaskType) {
    switch (taskType) {
        case 'construction':
            return 'Строительная';
        case 'installation':
            return 'Инсталляционная';
        case 'document':
            return 'Документальная';
        default:
            return 'Не указан';
    }
}

export default function MarketplacePage() {
    const [tasks, setTasks] = useState<PublicTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selectedTask, setSelectedTask] = useState<PublicTask | null>(null);
    const [detailsTask, setDetailsTask] = useState<PublicTask | null>(null);
    const [workItemsFullScreen, setWorkItemsFullScreen] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);
    const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
    const [filters, setFilters] = useState<{
        organization: string;
        project: string;
        status: PublicTaskStatus | '';
    }>({
        organization: '',
        project: '',
        status: '',
    });
    const [applyMessage, setApplyMessage] = useState('');
    const [applyBudget, setApplyBudget] = useState('');
    const [applyEtaDate, setApplyEtaDate] = useState<Dayjs | null>(null);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
    const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    });
    const [userContext, setUserContext] = useState<UserContext | null>(null);
    const [contextError, setContextError] = useState<string | null>(null);

    const organizationOptions = useMemo(() => {
        const values = tasks
            .map((task) => task.orgName?.trim() || '')
            .filter(Boolean);
        return Array.from(new Set(values));
    }, [tasks]);

    const projectOptions = useMemo(() => {
        const values = tasks
            .map((task) => task.project?.name?.trim() || '')
            .filter(Boolean);
        return Array.from(new Set(values));
    }, [tasks]);

    const availableStatuses = useMemo(
        () =>
            Array.from(
                new Set(
                    tasks
                        .map((task) => task.publicStatus)
                        .filter((status): status is PublicTaskStatus => Boolean(status))
                )
            ),
        [tasks]
    );

    const organizationAutocompleteOptions = useMemo(
        () =>
            filters.organization && !organizationOptions.includes(filters.organization)
                ? [...organizationOptions, filters.organization]
                : organizationOptions,
        [filters.organization, organizationOptions]
    );

    const projectAutocompleteOptions = useMemo(
        () =>
            filters.project && !projectOptions.includes(filters.project)
                ? [...projectOptions, filters.project]
                : projectOptions,
        [filters.project, projectOptions]
    );

    const handleOpenMapInfo = (task: MarketPublicTask) => {
        setMapOpen(false);
        setDetailsTask(mapMarketTaskToPublicTask(task));
    };

    const handleOpenMapApply = (task: MarketPublicTask) => {
        setMapOpen(false);
        setSelectedTask(mapMarketTaskToPublicTask(task));
    };

    const fetchTasks = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('q', search.trim());
            const query = params.toString();
            const res = await fetch(query ? `/api/tasks/public?${query}` : '/api/tasks/public');
            const data: TaskResponse = await res.json();
            if (!res.ok || data.error) {
                setError(data.error || 'Не удалось загрузить задачи');
                setTasks([]);
            } else {
                setTasks(data.tasks || []);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка загрузки задач');
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    const handleWithdrawApplication = async (task: PublicTask) => {
        const applicationId = task.myApplication?._id;
        if (!applicationId) return;

        setCancelLoadingId(applicationId);

        try {
            const res = await fetch(`/api/tasks/${task._id}/applications`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationId }),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string };

            if (!res.ok || data.error) {
                setSnack({
                    open: true,
                    message: data.error || 'Не удалось отменить отклик',
                    severity: 'error',
                });
                return;
            }

            setTasks((prev) =>
                prev.map((t) =>
                    t._id === task._id
                        ? {
                              ...t,
                              myApplication: null,
                              applicationCount: Math.max((t.applicationCount ?? 1) - 1, 0),
                          }
                        : t
                )
            );

            setSnack({
                open: true,
                message: 'Отклик удалён',
                severity: 'success',
            });
        } catch (e) {
            setSnack({
                open: true,
                message: e instanceof Error ? e.message : 'Ошибка при удалении',
                severity: 'error',
            });
        } finally {
            setCancelLoadingId(null);
        }
    };

    const fetchUser = async () => {
        try {
            const res = await fetch(withBasePath('/api/current-user'), { cache: 'no-store' });
            const data: UserContext & { error?: string } = await res.json();
            if (!res.ok) {
                setContextError(data.error || 'Не удалось получить профиль');
                setUserContext(null);
                return;
            }
            setUserContext(data);
            setContextError(null);
        } catch (e) {
            setContextError(e instanceof Error ? e.message : 'Ошибка профиля');
            setUserContext(null);
        }
    };

    useEffect(() => {
        void fetchTasks();
        void fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedTask) {
            const draftBudget =
                selectedTask.budget && selectedTask.budget > 0
                    ? String(selectedTask.budget)
                    : '';
            setApplyBudget(draftBudget);
            setApplyEtaDate(selectedTask.dueDate ? dayjs(selectedTask.dueDate) : null);
            setApplyMessage('');
        } else {
            setApplyBudget('');
            setApplyEtaDate(null);
            setApplyMessage('');
        }
    }, [selectedTask]);

    useEffect(() => {
        if (filters.status && !availableStatuses.includes(filters.status)) {
            setFilters((prev) => ({ ...prev, status: '' }));
        }
    }, [availableStatuses, filters.status]);

    const includesQuery = (value: string | undefined | null, query: string) =>
        value?.toLowerCase().includes(query.toLowerCase()) ?? false;

    const resetFilters = () => {
        setFilters({
            organization: '',
            project: '',
            status: '',
        });
        setFiltersDialogOpen(false);
    };

    const handleSubmitApplication = async () => {
        if (!selectedTask?._id) return;
        if (userContext?.profileType !== 'contractor') {
            setSnack({
                open: true,
                message: 'Отклики доступны только подрядчикам',
                severity: 'error',
            });
            return;
        }
        const budgetValue = Number(applyBudget);
        if (!budgetValue || Number.isNaN(budgetValue) || budgetValue <= 0) {
            setSnack({ open: true, message: 'Укажите фиксированную ставку', severity: 'error' });
            return;
        }
        if (!applyEtaDate || !applyEtaDate.isValid()) {
            setSnack({ open: true, message: 'Выберите плановую дату завершения', severity: 'error' });
            return;
        }
        const completionDate = applyEtaDate.startOf('day');
        const today = dayjs().startOf('day');
        const etaDays = completionDate.diff(today, 'day');
        if (etaDays < 0) {
            setSnack({
                open: true,
                message: 'Дата завершения не может быть в прошлом',
                severity: 'error',
            });
            return;
        }
        if (!applyMessage.trim()) {
            setSnack({ open: true, message: 'Добавьте сопроводительное сообщение', severity: 'error' });
            return;
        }
        setSubmitLoading(true);
        try {
            const res = await fetch(`/api/tasks/${selectedTask._id}/applications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    coverMessage: applyMessage,
                    proposedBudget: budgetValue,
                    etaDays,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setSnack({ open: true, message: data.error || 'Не удалось отправить отклик', severity: 'error' });
                return;
            }
            setSnack({ open: true, message: 'Отклик отправлен', severity: 'success' });
            setSelectedTask(null);
            setApplyMessage('');
            setApplyBudget('');
            setApplyEtaDate(null);
            void fetchTasks();
        } catch (e) {
            setSnack({
                open: true,
                message: e instanceof Error ? e.message : 'Ошибка при отправке',
                severity: 'error',
            });
        } finally {
            setSubmitLoading(false);
        }
    };

    const hasDetailsWorkItems = Boolean(detailsTask?.workItems && detailsTask.workItems.length > 0);
    const detailsBudget = getBudgetDisplay(detailsTask?.budget, detailsTask?.currency);

    const isFiltersApplied =
        Boolean(filters.organization) ||
        Boolean(filters.project) ||
        Boolean(filters.status);

    const filteredTasks = tasks.filter((task) => {
        const matchesOrganization = filters.organization
            ? [task.orgName, task.orgSlug, task.orgId].some((value) =>
                  includesQuery(value, filters.organization)
              )
            : true;

        const matchesProject = filters.project
            ? includesQuery(task.project?.name, filters.project) ||
              includesQuery(task.project?.key, filters.project)
            : true;

        const matchesStatus = filters.status ? task.publicStatus === filters.status : true;

        return matchesOrganization && matchesProject && matchesStatus;
    });

    const selectedFilterChips = [
        filters.organization
            ? {
                  key: 'organization',
                  label: `Организация: ${filters.organization}`,
                  onDelete: () =>
                      setFilters((prev) => ({
                          ...prev,
                          organization: '',
                      })),
              }
            : null,
        filters.project
            ? {
                  key: 'project',
                  label: `Проект: ${filters.project}`,
                  onDelete: () =>
                      setFilters((prev) => ({
                          ...prev,
                          project: '',
                      })),
              }
            : null,
        filters.status
            ? {
                  key: 'status',
                  label: `Статус: ${statusChipMap[filters.status]?.label || filters.status}`,
                  onDelete: () =>
                      setFilters((prev) => ({
                          ...prev,
                          status: '',
                      })),
              }
            : null,
    ].filter(Boolean) as { key: string; label: string; onDelete: () => void }[];

    const renderWorkItemsTable = (maxHeight?: number | string) => {
        if (!hasDetailsWorkItems || !detailsTask?.workItems) {
            return (
                <Typography color="text.secondary" sx={{ px: 1 }}>
                    Нет данных
                </Typography>
            );
        }

        return (
            <Box
                sx={{
                    maxHeight: maxHeight ?? { xs: 320, md: 420 },
                    overflow: 'auto',
                }}
            >
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Вид работ</TableCell>
                            <TableCell>Кол-во</TableCell>
                            <TableCell>Ед.</TableCell>
                            <TableCell>Примечание</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {detailsTask.workItems.map((item, idx) => (
                            <TableRow key={`work-${idx}`}>
                                <TableCell sx={{ minWidth: 180 }}>
                                    {item.workType || '—'}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    {item.quantity ?? '—'}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    {item.unit || '—'}
                                </TableCell>
                                <TableCell>{item.note || '—'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
        );
    };

    const heroActionButtonBaseSx = {
        borderRadius: UI_RADIUS.item,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 10px 30px rgba(15,23,42,0.1)',
    };

    const hero = (
        <Box
            sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: UI_RADIUS.surface,
                px: { xs: 2, md: 5 },
                py: { xs: 3, md: 5 },
                mb: 4,
                border: '1px solid',
                borderColor: (theme) =>
                    theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(15,23,42,0.08)',
                boxShadow: (theme) =>
                    theme.palette.mode === 'dark'
                        ? '0 35px 90px rgba(0,0,0,0.5)'
                        : '0 35px 90px rgba(15,23,42,0.12)',
            }}
        >
            <Stack spacing={2} sx={{ position: 'relative' }}>
                {contextError && <Alert severity="warning">{contextError}</Alert>}
                <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    flexWrap="wrap"
                    sx={{ width: '100%', rowGap: 1.5 }}
                >
                    <TextField
                        fullWidth
                        placeholder="Поиск по названию, адресу или описанию"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                                sx: { borderRadius: UI_RADIUS.tooltip },
                            },
                        }}
                        sx={{ flexGrow: 1, minWidth: { xs: 260, sm: 320 }, maxWidth: 520 }}
                    />
                    <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                        <Tooltip title="Обновить">
                            <IconButton
                                size="large"
                                onClick={() => void fetchTasks()}
                                sx={heroActionButtonBaseSx}
                            >
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Смотреть на карте">
                            <IconButton
                                size="large"
                                onClick={() => setMapOpen(true)}
                                sx={heroActionButtonBaseSx}
                            >
                                <LocationOnIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Фильтры">
                            <IconButton
                                size="large"
                                color={filtersDialogOpen || isFiltersApplied ? 'primary' : 'default'}
                                onClick={() => setFiltersDialogOpen(true)}
                                sx={(theme) => ({
                                    ...heroActionButtonBaseSx,
                                    borderColor:
                                        filtersDialogOpen || isFiltersApplied
                                            ? theme.palette.primary.main
                                            : theme.palette.divider,
                                    color:
                                        filtersDialogOpen || isFiltersApplied
                                            ? theme.palette.primary.main
                                            : theme.palette.text.primary,
                                })}
                            >
                                <FilterListIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Stack>
            </Stack>
        </Box>
    );

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ru">
            <Box
                sx={{
                    minHeight: '100vh',
                    py: { xs: 4, md: 6 },
                }}
            >
                <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 3, md: 4 } }}>
                    {hero}
                    {loading ? (
                        <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
                            <CircularProgress />
                            <Typography color="text.secondary">Загружаем задачи…</Typography>
                        </Stack>
                    ) : error ? (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    ) : filteredTasks.length === 0 ? (
                        <Alert severity="info" sx={{ mb: 3 }}>
                            Подходящих задач не найдено
                        </Alert>
                    ) : (
                        <Grid container spacing={2.5}>
                            {filteredTasks.map((task) => {
                                const chipMeta = task.publicStatus ? statusChipMap[task.publicStatus] : undefined;
                                const taskTitle = [task.taskName, task.bsNumber].filter(Boolean).join(' ');
                                const hasActiveApplication =
                                    Boolean(task.myApplication && task.myApplication.status !== 'withdrawn');
                                const isCanceling =
                                    Boolean(cancelLoadingId && task.myApplication?._id === cancelLoadingId);
                                const budgetDisplay = getBudgetDisplay(task.budget, task.currency);

                                return (
                                    <Grid size={{ xs: 12, md: 6 }} key={task._id}>
                                        <Paper
                                            sx={(theme) => ({
                                                ...glassPaperStyles(theme),
                                                cursor: 'pointer',
                                                transition: 'transform 120ms ease, box-shadow 120ms ease',
                                                '&:hover': {
                                                    boxShadow: theme.shadows[10],
                                                    transform: 'translateY(-2px)',
                                                },
                                            })}
                                            elevation={0}
                                            onClick={() => setDetailsTask(task)}
                                        >
                                            <Stack spacing={2}>
                                                <Stack spacing={0.25}>
                                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                                        Организация: {task.orgName || task.orgSlug || task.orgId || '—'}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Регион: {task.project?.regionCode || '—'}
                                                        {getRegionLabel(task.project?.regionCode)
                                                            ? ` — ${getRegionLabel(task.project?.regionCode)}`
                                                            : ''}
                                                    </Typography>
                                                </Stack>
                                                <Stack direction="row" alignItems="center" spacing={1.5}>
                                                    <Chip
                                                        size="small"
                                                        color="default"
                                                        variant="outlined"
                                                        label={task.project?.key || 'Публичная задача'}
                                                        sx={{ borderRadius: UI_RADIUS.item }}
                                                    />
                                                    {chipMeta && (
                                                        <Chip
                                                            size="small"
                                                            color={chipMeta.color}
                                                            label={chipMeta.label}
                                                            sx={{ borderRadius: UI_RADIUS.item }}
                                                        />
                                                    )}
                                                    <Chip
                                                        size="small"
                                                        icon={<StarRoundedIcon fontSize="small" />}
                                                        label={`${task.applicationCount ?? 0} откликов`}
                                                        sx={{ borderRadius: UI_RADIUS.item }}
                                                    />
                                                </Stack>
                                                <Stack spacing={1}>
                                                    <Typography variant="h5" fontWeight={700} sx={{ pr: 1, wordBreak: 'break-word' }}>
                                                        {taskTitle || 'Без названия'}
                                                    </Typography>
                                                    <Stack spacing={0.25}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Планируемый бюджет
                                                        </Typography>
                                                        {budgetDisplay.amount ? (
                                                            <Box
                                                                sx={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 0.75,
                                                                }}
                                                            >
                                                                <Typography
                                                                    variant="h5"
                                                                    fontWeight={800}
                                                                    sx={{ fontSize: { xs: '1.35rem', sm: '1.5rem' }, lineHeight: 1.1 }}
                                                                >
                                                                    {budgetDisplay.amount}
                                                                </Typography>
                                                                {budgetDisplay.isRuble ? (
                                                                    <CurrencyRubleRounded
                                                                        sx={{
                                                                            fontSize: { xs: '1.25rem', sm: '1.4rem' },
                                                                            fontWeight: 800,
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <Typography variant="subtitle1" fontWeight={700}>
                                                                        {budgetDisplay.currencyCode}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        ) : (
                                                            <Typography variant="subtitle1" fontWeight={600}>
                                                                {budgetDisplay.label}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </Stack>
                                                <Typography color="text.secondary" sx={{ lineHeight: 1.5 }}>
                                                    {task.publicDescription || task.taskDescription || 'Описание не заполнено'}
                                                </Typography>
                                                <Divider flexItem />
                                                <Stack
                                                    direction={{ xs: 'column', sm: 'row' }}
                                                    justifyContent="space-between"
                                                    alignItems={{ xs: 'stretch', sm: 'center' }}
                                                    spacing={1.5}
                                                >
                                                    <Button
                                                        variant="outlined"
                                                        startIcon={<InfoOutlinedIcon />}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDetailsTask(task);
                                                        }}
                                                        sx={{
                                                            borderRadius: UI_RADIUS.item,
                                                            textTransform: 'none',
                                                        }}
                                                    >
                                                        Подробнее
                                                    </Button>
                                                    {hasActiveApplication ? (
                                                        <Button
                                                            variant="outlined"
                                                            color="error"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                void handleWithdrawApplication(task);
                                                            }}
                                                            disabled={isCanceling}
                                                            sx={{ borderRadius: UI_RADIUS.item }}
                                                        >
                                                            {isCanceling ? 'Отменяем…' : 'Отменить отклик'}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="contained"
                                                            size="large"
                                                            endIcon={<ArrowOutwardIcon />}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedTask(task);
                                                            }}
                                                            sx={{
                                                                borderRadius: UI_RADIUS.compact,
                                                                px: 3.5,
                                                                py: 1.25,
                                                                textTransform: 'none',
                                                            }}
                                                        >
                                                            Откликнуться
                                                        </Button>
                                                    )}
                                                </Stack>
                                            </Stack>
                                        </Paper>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    )}
                </Container>

            <Dialog
                open={filtersDialogOpen}
                onClose={() => setFiltersDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: UI_RADIUS.tooltip } }}
            >
                <DialogTitle>Фильтры</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <Stack spacing={1}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Выбранные фильтры
                            </Typography>
                            {selectedFilterChips.length > 0 ? (
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                    {selectedFilterChips.map((chip) => (
                                        <Chip
                                            key={chip.key}
                                            label={chip.label}
                                            onDelete={chip.onDelete}
                                            sx={{ borderRadius: UI_RADIUS.item }}
                                        />
                                    ))}
                                </Stack>
                            ) : (
                                <Typography variant="body2" color="text.secondary">
                                    Фильтры не выбраны
                                </Typography>
                            )}
                        </Stack>
                        <Autocomplete
                            options={organizationAutocompleteOptions}
                            value={filters.organization || null}
                            onChange={(_, newValue) =>
                                setFilters((prev) => ({ ...prev, organization: newValue || '' }))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Организация"
                                    placeholder={
                                        organizationOptions.length
                                            ? 'Выберите организацию'
                                            : 'Нет данных из опубликованных задач'
                                    }
                                />
                            )}
                            fullWidth
                            clearOnEscape
                        />
                        <Autocomplete
                            options={projectAutocompleteOptions}
                            value={filters.project || null}
                            onChange={(_, newValue) =>
                                setFilters((prev) => ({ ...prev, project: newValue || '' }))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Проект"
                                    placeholder={
                                        projectOptions.length
                                            ? 'Выберите проект'
                                            : 'Нет данных из опубликованных задач'
                                    }
                                />
                            )}
                            fullWidth
                            clearOnEscape
                        />
                        <TextField
                            select
                            label="Статус"
                            value={filters.status}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    status: e.target.value as PublicTaskStatus | '',
                                }))
                            }
                            fullWidth
                        >
                            <MenuItem value="">Все статусы</MenuItem>
                            {availableStatuses.map((status) => (
                                <MenuItem key={status} value={status}>
                                    {statusChipMap[status]?.label}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button
                        color="secondary"
                        variant="outlined"
                        startIcon={<FilterListOffIcon />}
                        onClick={resetFilters}
                    >
                        Сбросить
                    </Button>
                    <Button variant="contained" onClick={() => setFiltersDialogOpen(false)}>
                        Закрыть
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog fullScreen open={mapOpen} onClose={() => setMapOpen(false)}>
                <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                    <Box
                        sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 2,
                            py: 1.5,
                            borderBottom: 1,
                            borderColor: 'divider',
                            backdropFilter: 'blur(12px)',
                            bgcolor: (theme) =>
                                theme.palette.mode === 'dark'
                                    ? 'rgba(17,24,39,0.9)'
                                    : 'rgba(255,255,255,0.9)',
                        }}
                    >
                        <Typography variant="h6" fontWeight={700}>
                            Публичные задачи на карте
                        </Typography>
                        <IconButton onClick={() => setMapOpen(false)}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Box sx={{ width: '100%', height: 'calc(100vh - 64px)' }}>
                        <MarketLocations onOpenInfo={handleOpenMapInfo} onOpenApply={handleOpenMapApply} />
                    </Box>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(selectedTask)}
                onClose={() => setSelectedTask(null)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: UI_RADIUS.tooltip,
                        p: 1,
                    },
                }}
            >
                <DialogTitle>
                    {selectedTask
                        ? [selectedTask.taskName, selectedTask.bsNumber].filter(Boolean).join(' ')
                        : 'Отклик на задачу'}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Alert severity="info">
                            Фиксированная ставка, без комиссий платформы. Сообщение увидит работодатель.
                        </Alert>
                        {selectedTask?.publicDescription && (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ whiteSpace: 'pre-wrap' }}
                            >
                                {selectedTask.publicDescription}
                            </Typography>
                        )}
                        <TextField
                            label="Ставка за задачу"
                            type="number"
                            value={applyBudget}
                            onChange={(e) => setApplyBudget(e.target.value)}
                            slotProps={{ htmlInput: { min: 0 } }}
                            fullWidth
                        />
                        <DatePicker
                            label="Плановая дата завершения"
                            value={applyEtaDate}
                            minDate={dayjs()}
                            onChange={(value) => setApplyEtaDate(value)}
                            slotProps={{
                                textField: {
                                    fullWidth: true,
                                    helperText: applyEtaDate
                                        ? `Отправим как ${
                                              Math.max(
                                                  applyEtaDate.startOf('day').diff(dayjs().startOf('day'), 'day'),
                                                  0
                                              )
                                          } дн. от сегодня`
                                        : 'Выберите дату, когда планируете сдать работу',
                                },
                            }}
                        />
                        <TextField
                            label="Сообщение"
                            value={applyMessage}
                            onChange={(e) => setApplyMessage(e.target.value)}
                            fullWidth
                            multiline
                            minRows={4}
                        />
                        {userContext?.profileType !== 'contractor' && (
                            <Alert severity="warning">
                                Для отправки отклика выберите роль «Исполнитель» в профиле.
                            </Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setSelectedTask(null)} variant="text">
                        Отмена
                    </Button>
                    <Button
                        onClick={() => void handleSubmitApplication()}
                        variant="contained"
                        endIcon={<SendIcon />}
                        disabled={submitLoading}
                    >
                        {submitLoading ? 'Отправляем…' : 'Отправить'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(detailsTask)}
                onClose={() => {
                    setDetailsTask(null);
                    setWorkItemsFullScreen(false);
                }}
                fullScreen
                PaperProps={{
                    sx: {
                        bgcolor: 'background.default',
                    },
                }}
            >
                <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                    <Box
                        sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            backdropFilter: 'blur(16px)',
                            bgcolor: (theme) =>
                                theme.palette.mode === 'dark'
                                    ? 'rgba(26,32,39,0.8)'
                                    : 'rgba(255,255,255,0.9)',
                        }}
                    >
                        <Container maxWidth="md" sx={{ py: 2.5, px: { xs: 1.5, sm: 3 } }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="overline" color="text.secondary">
                                        Задача
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        <Typography
                                            variant="h5"
                                            fontWeight={700}
                                            sx={{ wordBreak: 'break-word' }}
                                        >
                                            {detailsTask
                                                ? [detailsTask.taskName, detailsTask.bsNumber]
                                                      .filter(Boolean)
                                                      .join(' ')
                                                : 'Детали задачи'}
                                        </Typography>
                                        {detailsTask?.project?.key && (
                                            <Chip
                                                label={detailsTask.project.key}
                                                variant="outlined"
                                                size="small"
                                                sx={{ borderRadius: UI_RADIUS.item }}
                                            />
                                        )}
                                    </Stack>
                                </Box>
                                <Stack direction="row" spacing={1}>
                                    <IconButton
                                        onClick={() => setDetailsTask(null)}
                                        sx={{
                                            borderRadius: UI_RADIUS.item,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            bgcolor: 'background.paper',
                                        }}
                                    >
                                        <CloseIcon />
                                    </IconButton>
                                </Stack>
                            </Stack>
                        </Container>
                    </Box>

                    <Container maxWidth="md" sx={{ py: 3.5, px: { xs: 1.5, sm: 3 } }}>
                        <Stack spacing={2.5}>
                            <Masonry
                                columns={{ xs: 1, sm: 1, md: 2 }}
                                spacing={{ xs: 1, sm: 1.5, md: 2 }}
                                sx={{
                                    '& > *': {
                                        boxSizing: 'border-box',
                                    },
                                }}
                            >
                                <CardItem sx={{ minWidth: 0 }}>
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={600}
                                        gutterBottom
                                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                    >
                                        <InfoOutlinedIcon fontSize="small" />
                                        Информация
                                    </Typography>
                                    <Divider sx={{ mb: 1.5 }} />
                                    <Stack spacing={1}>
                                        <Typography variant="body1">
                                            <strong>Организация:</strong>{' '}
                                            {detailsTask?.orgName ||
                                                detailsTask?.orgSlug ||
                                                detailsTask?.orgId ||
                                                '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Оператор:</strong> {detailsTask?.project?.operator || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Регион:</strong> {detailsTask?.project?.regionCode || '—'}
                                            {getRegionLabel(detailsTask?.project?.regionCode)
                                                ? ` — ${getRegionLabel(detailsTask?.project?.regionCode)}`
                                                : ''}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Название проекта:</strong> {detailsTask?.project?.name || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Базовая станция:</strong> {detailsTask?.bsNumber || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Адрес:</strong> {detailsTask?.bsAddress || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Геолокация:</strong>{' '}
                                            {detailsTask?.bsLocation?.[0]?.coordinates ||
                                                detailsTask?.bsLocation?.[0]?.name ||
                                                '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Срок выполнения:</strong> {formatDateRu(detailsTask?.dueDate)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Приоритет:</strong>{' '}
                                            {getPriorityLabelRu(detailsTask?.priority) || 'Не указан'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Плановый бюджет:</strong>{' '}
                                            {detailsBudget.amount ? (
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.5,
                                                        fontWeight: 700,
                                                        fontSize: '1.1rem',
                                                    }}
                                                >
                                                    <span>{detailsBudget.amount}</span>
                                                    {detailsBudget.isRuble ? (
                                                        <CurrencyRubleRounded sx={{ fontSize: '1.2rem', fontWeight: 700 }} />
                                                    ) : (
                                                        <span>{detailsBudget.currencyCode}</span>
                                                    )}
                                                </Box>
                                            ) : (
                                                detailsBudget.label
                                            )}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Тип задачи:</strong> {getTaskTypeLabel(detailsTask?.taskType)}
                                        </Typography>
                                    </Stack>
                                </CardItem>

                                {detailsTask?.publicDescription || detailsTask?.taskDescription ? (
                                    <CardItem sx={{ minWidth: 0 }}>
                                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                            Описание
                                        </Typography>
                                        <Divider sx={{ mb: 1.5 }} />
                                        <Typography
                                            color="text.secondary"
                                            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                                        >
                                            {detailsTask?.publicDescription || detailsTask?.taskDescription}
                                        </Typography>
                                    </CardItem>
                                ) : null}

                                {hasDetailsWorkItems ? (
                                    <CardItem sx={{ minWidth: 0 }}>
                                        <Accordion
                                            defaultExpanded
                                            disableGutters
                                            elevation={0}
                                            sx={{ '&:before': { display: 'none' } }}
                                        >
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        width: '100%',
                                                        gap: 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="subtitle1"
                                                        fontWeight={600}
                                                        gutterBottom
                                                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                                    >
                                                        <TocOutlinedIcon fontSize="small" />
                                                        Состав работ
                                                    </Typography>

                                                    <Tooltip title="Развернуть на весь экран">
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setWorkItemsFullScreen(true);
                                                            }}
                                                        >
                                                            <OpenInFullIcon fontSize="inherit" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails sx={{ pt: 0 }}>
                                                <Divider sx={{ mb: 1.5 }} />
                                                {renderWorkItemsTable()}
                                            </AccordionDetails>
                                        </Accordion>
                                    </CardItem>
                                ) : null}

                                {detailsTask?.attachments && detailsTask.attachments.length > 0 ? (
                                    <CardItem sx={{ minWidth: 0 }}>
                                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                            Аттачменты
                                        </Typography>
                                        <Divider sx={{ mb: 1.5 }} />
                                        <Stack spacing={1}>
                                            {detailsTask.attachments.map((link) => (
                                                <Button
                                                    key={link}
                                                    href={link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    variant="text"
                                                    endIcon={<ArrowOutwardIcon fontSize="small" />}
                                                    sx={{
                                                        justifyContent: 'flex-start',
                                                        textTransform: 'none',
                                                    }}
                                                >
                                                    {link}
                                                </Button>
                                            ))}
                                        </Stack>
                                    </CardItem>
                                ) : null}
                            </Masonry>

                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1.5}
                                justifyContent="flex-end"
                                alignItems={{ xs: 'stretch', sm: 'center' }}
                            >
                                {detailsTask &&
                                detailsTask.myApplication &&
                                detailsTask.myApplication.status !== 'withdrawn' ? (
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        onClick={() => void handleWithdrawApplication(detailsTask)}
                                        disabled={
                                            Boolean(cancelLoadingId) &&
                                            detailsTask.myApplication?._id === cancelLoadingId
                                        }
                                        sx={{ borderRadius: UI_RADIUS.item }}
                                    >
                                        {Boolean(cancelLoadingId) &&
                                        detailsTask.myApplication?._id === cancelLoadingId
                                            ? 'Отменяем…'
                                            : 'Отменить отклик'}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        size="large"
                                        endIcon={<ArrowOutwardIcon />}
                                        onClick={() => {
                                            if (detailsTask) setSelectedTask(detailsTask);
                                            setDetailsTask(null);
                                        }}
                                        sx={{
                                            borderRadius: UI_RADIUS.compact,
                                            px: 3.5,
                                            py: 1.25,
                                            textTransform: 'none',
                                            alignSelf: { xs: 'stretch', sm: 'center' },
                                        }}
                                    >
                                        Откликнуться
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                    </Container>
                </DialogContent>
            </Dialog>

            <Dialog
                fullScreen
                open={workItemsFullScreen}
                onClose={() => setWorkItemsFullScreen(false)}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="h6" fontWeight={600}>
                        Состав работ
                    </Typography>
                    <IconButton onClick={() => setWorkItemsFullScreen(false)}>
                        <CloseFullscreenIcon />
                    </IconButton>
                </Box>

                <Box sx={{ p: 2 }}>
                    {renderWorkItemsTable('calc(100vh - 80px)')}
                </Box>
            </Dialog>

            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={snack.severity}
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>
        </Box>
        </LocalizationProvider>
    );
}
