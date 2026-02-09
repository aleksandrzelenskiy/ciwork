// src/app/market/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/en';
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
import { UI_RADIUS } from '@/config/uiTokens';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

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
    specializations?: string[];
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

const CardItem = styled(Paper)(({ theme }) => ({
    backgroundColor: '#fff',
    padding: theme.spacing(2),
    borderRadius: UI_RADIUS.surface,
    boxShadow: theme.shadows[3],
    ...theme.applyStyles?.('dark', {
        backgroundColor: '#1A2027',
    }),
}));

function getRegionLabel(code?: string) {
    if (!code) return '';
    const region = REGION_MAP.get(code) || REGION_MAP.get(code.toUpperCase());
    return region?.label || '';
}

function getAttachmentLabel(link: string) {
    try {
        const url = new URL(link);
        const pathname = url.pathname.replace(/\/+$/, '');
        return decodeURIComponent(pathname.split('/').pop() || link);
    } catch {
        const trimmed = link.split('?')[0]?.split('#')[0] ?? link;
        return trimmed.replace(/\/+$/, '').split('/').pop() || link;
    }
}

export default function MarketplacePage() {
    const { t, locale } = useI18n();
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
        taskType: TaskType | '';
    }>({
        organization: '',
        project: '',
        status: '',
        taskType: '',
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

    useEffect(() => {
        dayjs.locale(locale === 'en' ? 'en' : 'ru');
    }, [locale]);

    const normalizeTaskTypeValue = (value?: string | null): TaskType | undefined => {
        if (!value) return undefined;
        if (value === 'construction') return 'installation';
        if (value === 'installation' || value === 'document') return value;
        return undefined;
    };

    const mapMarketTaskToPublicTask = (task: MarketPublicTask): PublicTask => ({
        _id: task._id,
        taskName: task.taskName || t('tasks.defaultName', 'Задача'),
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
        taskType: normalizeTaskTypeValue(task.taskType),
        attachments: task.attachments,
        workItems: task.workItems,
        publicDescription: task.publicDescription,
        publicStatus: task.publicStatus,
        visibility: task.visibility,
        applicationCount: task.applicationCount,
        project: task.project,
        myApplication: task.myApplication,
    });

    const statusChipMap = useMemo<Record<PublicTaskStatus, { label: string; color: 'default' | 'success' | 'warning' }>>(
        () => ({
            open: { label: t('market.status.open', 'Открыта'), color: 'success' },
            in_review: { label: t('market.status.inReview', 'На рассмотрении'), color: 'warning' },
            assigned: { label: t('market.status.assigned', 'Назначена'), color: 'default' },
            closed: { label: t('market.status.closed', 'Закрыта'), color: 'default' },
        }),
        [t]
    );

    const getBudgetDisplay = (budget?: number, currency?: string): BudgetDisplay => {
        const code = currency || 'RUB';
        const isRuble = code === 'RUB';

        if (!budget || budget <= 0) {
            return {
                label: t('market.budget.none', 'Бюджет не указан'),
                amount: null,
                currencyCode: isRuble ? '₽' : code,
                isRuble,
            };
        }

        const fmt = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', { maximumFractionDigits: 0 });

        return {
            label: `${fmt.format(budget)} ${isRuble ? '₽' : code}`,
            amount: fmt.format(budget),
            currencyCode: isRuble ? '₽' : code,
            isRuble,
        };
    };

    const formatDate = (dateInput?: string) => {
        if (!dateInput) return '—';
        const date = new Date(dateInput);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
    };

    const getTaskTypeLabel = (taskType?: string | null) => {
        const normalized = normalizeTaskTypeValue(taskType);
        switch (normalized) {
            case 'installation':
                return t('market.taskType.installation', 'Монтажная');
            case 'document':
                return t('market.taskType.document', 'Документальная');
            default:
                return t('market.taskType.unknown', 'Не указан');
        }
    };

    const getPriorityLabel = (priority?: PriorityLevel) => {
        switch (priority) {
            case 'urgent':
                return t('priority.urgent', 'Срочный');
            case 'high':
                return t('priority.high', 'Высокий');
            case 'medium':
                return t('priority.medium', 'Средний');
            case 'low':
                return t('priority.low', 'Низкий');
            default:
                return t('priority.unknown', 'Не указан');
        }
    };

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
    const availableTaskTypes = useMemo(
        () =>
            Array.from(
                new Set(
                    tasks
                        .map((task) => normalizeTaskTypeValue(task.taskType))
                        .filter((type): type is TaskType => Boolean(type))
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
                setError(data.error || t('market.error.loadTasks', 'Не удалось загрузить задачи'));
                setTasks([]);
            } else {
                const normalized = (data.tasks || []).map((task) => ({
                    ...task,
                    taskType: normalizeTaskTypeValue(task.taskType),
                }));
                setTasks(normalized);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : t('market.error.loadTasksGeneric', 'Ошибка загрузки задач'));
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
                    message: data.error || t('market.error.withdraw', 'Не удалось отменить отклик'),
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
                message: t('market.withdrawn', 'Отклик удалён'),
                severity: 'success',
            });
        } catch (e) {
            setSnack({
                open: true,
                message: e instanceof Error ? e.message : t('market.error.withdrawGeneric', 'Ошибка при удалении'),
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
                setContextError(data.error || t('market.error.profile', 'Не удалось получить профиль'));
                setUserContext(null);
                return;
            }
            setUserContext(data);
            setContextError(null);
        } catch (e) {
            setContextError(e instanceof Error ? e.message : t('market.error.profileGeneric', 'Ошибка профиля'));
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

    useEffect(() => {
        if (filters.taskType && !availableTaskTypes.includes(filters.taskType)) {
            setFilters((prev) => ({ ...prev, taskType: '' }));
        }
    }, [availableTaskTypes, filters.taskType]);

    const includesQuery = (value: string | undefined | null, query: string) =>
        value?.toLowerCase().includes(query.toLowerCase()) ?? false;

    const resetFilters = () => {
        setFilters({
            organization: '',
            project: '',
            status: '',
            taskType: '',
        });
        setFiltersDialogOpen(false);
    };

    const handleSubmitApplication = async () => {
        if (!selectedTask?._id) return;
        if (userContext?.profileType !== 'contractor') {
            setSnack({
                open: true,
                message: t('market.apply.onlyContractors', 'Отклики доступны только подрядчикам'),
                severity: 'error',
            });
            return;
        }
        if (selectedTask.taskType === 'document') {
            const specs = Array.isArray(userContext.specializations) ? userContext.specializations : [];
            if (!specs.includes('document')) {
                setSnack({
                    open: true,
                    message: t('market.apply.onlyDocument', 'Откликаться на документальные задачи могут только проектировщики'),
                    severity: 'error',
                });
                return;
            }
        } else {
            const specs = Array.isArray(userContext.specializations) ? userContext.specializations : [];
            if (!specs.includes('installation')) {
                setSnack({
                    open: true,
                    message: t('market.apply.onlyInstallation', 'Откликаться на монтажные задачи могут только монтажники'),
                    severity: 'error',
                });
                return;
            }
        }
        const budgetValue = Number(applyBudget);
        if (!budgetValue || Number.isNaN(budgetValue) || budgetValue <= 0) {
            setSnack({ open: true, message: t('market.apply.budgetRequired', 'Укажите фиксированную ставку'), severity: 'error' });
            return;
        }
        if (!applyEtaDate || !applyEtaDate.isValid()) {
            setSnack({ open: true, message: t('market.apply.etaRequired', 'Выберите плановую дату завершения'), severity: 'error' });
            return;
        }
        const completionDate = applyEtaDate.startOf('day');
        const today = dayjs().startOf('day');
        const etaDays = completionDate.diff(today, 'day');
        if (etaDays < 0) {
            setSnack({
                open: true,
                message: t('market.apply.etaPast', 'Дата завершения не может быть в прошлом'),
                severity: 'error',
            });
            return;
        }
        setSubmitLoading(true);
        try {
            const res = await fetch(`/api/tasks/${selectedTask._id}/applications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    coverMessage: applyMessage.trim() || undefined,
                    proposedBudget: budgetValue,
                    etaDays,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setSnack({ open: true, message: data.error || t('market.apply.error', 'Не удалось отправить отклик'), severity: 'error' });
                return;
            }
            setSnack({ open: true, message: t('market.apply.success', 'Отклик отправлен'), severity: 'success' });
            setSelectedTask(null);
            setApplyMessage('');
            setApplyBudget('');
            setApplyEtaDate(null);
            void fetchTasks();
        } catch (e) {
            setSnack({
                open: true,
                message: e instanceof Error ? e.message : t('market.apply.errorGeneric', 'Ошибка при отправке'),
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
        Boolean(filters.status) ||
        Boolean(filters.taskType);
    const hasContractorSpecialization = Array.isArray(userContext?.specializations)
        && userContext.specializations.some((spec) => spec === 'installation' || spec === 'document' || spec === 'construction');
    const showSpecializationWarning =
        userContext?.profileType === 'contractor' && !hasContractorSpecialization;

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
        const normalizedTaskType = normalizeTaskTypeValue(task.taskType);
        const matchesType = filters.taskType ? normalizedTaskType === filters.taskType : true;

        return matchesOrganization && matchesProject && matchesStatus && matchesType;
    });

    const selectedFilterChips = [
        filters.organization
            ? {
                  key: 'organization',
                  label: t('market.filters.organizationChip', 'Организация: {value}', { value: filters.organization }),
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
                  label: t('market.filters.projectChip', 'Проект: {value}', { value: filters.project }),
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
                  label: t('market.filters.statusChip', 'Статус: {value}', { value: statusChipMap[filters.status]?.label || filters.status }),
                  onDelete: () =>
                      setFilters((prev) => ({
                          ...prev,
                          status: '',
                      })),
              }
            : null,
        filters.taskType
            ? {
                  key: 'taskType',
                  label: t('market.filters.taskTypeChip', 'Тип задачи: {value}', { value: getTaskTypeLabel(filters.taskType) }),
                  onDelete: () =>
                      setFilters((prev) => ({
                          ...prev,
                          taskType: '',
                      })),
              }
            : null,
    ].filter(Boolean) as { key: string; label: string; onDelete: () => void }[];

    const renderWorkItemsTable = (maxHeight?: number | string) => {
        if (!hasDetailsWorkItems || !detailsTask?.workItems) {
            return (
                <Typography color="text.secondary" sx={{ px: 1 }}>
                    {t('common.noData', 'Нет данных')}
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
                            <TableCell>{t('market.workItems.type', 'Вид работ')}</TableCell>
                            <TableCell>{t('market.workItems.qty', 'Кол-во')}</TableCell>
                            <TableCell>{t('market.workItems.unit', 'Ед.')}</TableCell>
                            <TableCell>{t('market.workItems.note', 'Примечание')}</TableCell>
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
                {showSpecializationWarning && (
                    <Alert severity="info">
                        {t(
                            'market.specialization.required',
                            'Чтобы видеть задачи на бирже, выберите специализацию в настройках профиля.'
                        )}
                    </Alert>
                )}
                <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="center"
                    flexWrap="wrap"
                    sx={{ width: '100%', rowGap: 1.5 }}
                >
                    <TextField
                        fullWidth
                        placeholder={t('market.search.placeholder', 'Поиск по названию, адресу или описанию')}
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
                        <Tooltip title={t('common.refresh', 'Обновить')}>
                            <IconButton
                                size="large"
                                onClick={() => void fetchTasks()}
                                sx={heroActionButtonBaseSx}
                            >
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={t('market.map.open', 'Смотреть на карте')}>
                            <IconButton
                                size="large"
                                onClick={() => setMapOpen(true)}
                                sx={heroActionButtonBaseSx}
                            >
                                <LocationOnIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={t('market.filters.title', 'Фильтры')}>
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
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale === 'en' ? 'en' : 'ru'}>
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
                            <Typography color="text.secondary">{t('market.loading', 'Загружаем задачи…')}</Typography>
                        </Stack>
                    ) : error ? (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    ) : filteredTasks.length === 0 ? (
                        <Alert severity="info" sx={{ mb: 3 }}>
                            {t('market.empty', 'Подходящих задач не найдено')}
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
                                                        {t('market.card.organization', 'Организация: {value}', {
                                                            value: task.orgName || task.orgSlug || task.orgId || '—',
                                                        })}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t('market.card.region', 'Регион: {value}', {
                                                            value: task.project?.regionCode || '—',
                                                        })}
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
                                                        label={task.project?.key || t('market.card.publicTask', 'Публичная задача')}
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
                                                        label={t('market.card.applications', '{count} откликов', {
                                                            count: task.applicationCount ?? 0,
                                                        })}
                                                        sx={{ borderRadius: UI_RADIUS.item }}
                                                    />
                                                </Stack>
                                                <Stack spacing={1}>
                                                    <Typography variant="h5" fontWeight={700} sx={{ pr: 1, wordBreak: 'break-word' }}>
                                                        {taskTitle || t('market.card.untitled', 'Без названия')}
                                                    </Typography>
                                                    <Stack spacing={0.25}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {t('market.card.budgetLabel', 'Планируемый бюджет')}
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
                                                    {task.publicDescription || task.taskDescription || t('market.card.noDescription', 'Описание не заполнено')}
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
                                                        {t('market.card.details', 'Подробнее')}
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
                                                            {isCanceling
                                                                ? t('market.card.withdrawLoading', 'Отменяем…')
                                                                : t('market.card.withdraw', 'Отменить отклик')}
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
                                                            {t('market.card.apply', 'Откликнуться')}
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
                <DialogTitle>{t('market.filters.title', 'Фильтры')}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <Stack spacing={1}>
                            <Typography variant="subtitle2" color="text.secondary">
                                {t('market.filters.selected', 'Выбранные фильтры')}
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
                                    {t('market.filters.none', 'Фильтры не выбраны')}
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
                                    label={t('market.filters.organization', 'Организация')}
                                    placeholder={
                                        organizationOptions.length
                                            ? t('market.filters.organizationPlaceholder', 'Выберите организацию')
                                            : t('market.filters.noData', 'Нет данных из опубликованных задач')
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
                                    label={t('market.filters.project', 'Проект')}
                                    placeholder={
                                        projectOptions.length
                                            ? t('market.filters.projectPlaceholder', 'Выберите проект')
                                            : t('market.filters.noData', 'Нет данных из опубликованных задач')
                                    }
                                />
                            )}
                            fullWidth
                            clearOnEscape
                        />
                        <TextField
                            select
                            label={t('market.filters.status', 'Статус')}
                            value={filters.status}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    status: e.target.value as PublicTaskStatus | '',
                                }))
                            }
                            fullWidth
                        >
                            <MenuItem value="">{t('market.filters.all', 'Все статусы')}</MenuItem>
                            {availableStatuses.map((status) => (
                                <MenuItem key={status} value={status}>
                                    {statusChipMap[status]?.label}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            select
                            label={t('market.filters.taskType', 'Тип задачи')}
                            value={filters.taskType}
                            onChange={(e) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    taskType: e.target.value as TaskType | '',
                                }))
                            }
                            fullWidth
                        >
                            <MenuItem value="">{t('market.filters.allTypes', 'Все типы')}</MenuItem>
                            {availableTaskTypes.map((type) => (
                                <MenuItem key={type} value={type}>
                                    {getTaskTypeLabel(type)}
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
                        {t('common.reset', 'Сбросить')}
                    </Button>
                    <Button variant="contained" onClick={() => setFiltersDialogOpen(false)}>
                        {t('common.close', 'Закрыть')}
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
                            {t('market.map.title', 'Публичные задачи на карте')}
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
                        : t('market.apply.title', 'Отклик на задачу')}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Alert severity="info">
                            {t('market.apply.info', 'Фиксированная ставка, без комиссий платформы. Сообщение увидит работодатель.')}
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
                            label={t('market.apply.budget', 'Ставка за задачу')}
                            type="number"
                            value={applyBudget}
                            onChange={(e) => setApplyBudget(e.target.value)}
                            slotProps={{ htmlInput: { min: 0 } }}
                            fullWidth
                        />
                        <DatePicker
                            label={t('market.apply.eta', 'Плановая дата завершения')}
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
                                          } ${t('market.apply.daysShort', 'дн.')} ${t('market.apply.fromToday', 'от сегодня')}`
                                        : t('market.apply.etaHelper', 'Выберите дату, когда планируете сдать работу'),
                                },
                            }}
                        />
                        <TextField
                            label={t('market.apply.message', 'Сообщение (необязательно)')}
                            value={applyMessage}
                            onChange={(e) => setApplyMessage(e.target.value)}
                            fullWidth
                            multiline
                            minRows={4}
                        />
                        {userContext?.profileType !== 'contractor' && (
                            <Alert severity="warning">
                                {t('market.apply.roleWarning', 'Для отправки отклика выберите роль «Исполнитель» в профиле.')}
                            </Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setSelectedTask(null)} variant="text">
                        {t('common.cancel', 'Отмена')}
                    </Button>
                    <Button
                        onClick={() => void handleSubmitApplication()}
                        variant="contained"
                        endIcon={<SendIcon />}
                        disabled={submitLoading}
                    >
                        {submitLoading
                            ? t('market.apply.sending', 'Отправляем…')
                            : t('market.apply.send', 'Отправить')}
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
                                        {t('reports.header.task', 'Задача')}
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
                                                : t('market.details.title', 'Детали задачи')}
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
                                        {t('market.details.info', 'Информация')}
                                    </Typography>
                                    <Divider sx={{ mb: 1.5 }} />
                                    <Stack spacing={1}>
                                        <Typography variant="body1">
                                            <strong>{t('market.details.organization', 'Организация:')}</strong>{' '}
                                            {detailsTask?.orgName ||
                                                detailsTask?.orgSlug ||
                                                detailsTask?.orgId ||
                                                '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>{t('market.details.operator', 'Оператор:')}</strong> {detailsTask?.project?.operator || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>{t('market.details.region', 'Регион:')}</strong> {detailsTask?.project?.regionCode || '—'}
                                            {getRegionLabel(detailsTask?.project?.regionCode)
                                                ? ` — ${getRegionLabel(detailsTask?.project?.regionCode)}`
                                                : ''}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>{t('market.details.projectName', 'Название проекта:')}</strong> {detailsTask?.project?.name || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>{t('market.details.base', 'Базовая станция:')}</strong> {detailsTask?.bsNumber || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>{t('market.details.address', 'Адрес:')}</strong> {detailsTask?.bsAddress || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>{t('market.details.geo', 'Геолокация:')}</strong>{' '}
                                            {detailsTask?.bsLocation?.[0]?.coordinates ||
                                                detailsTask?.bsLocation?.[0]?.name ||
                                                '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>{t('market.details.dueDate', 'Срок выполнения:')}</strong> {formatDate(detailsTask?.dueDate)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>{t('market.details.priority', 'Приоритет:')}</strong>{' '}
                                            {getPriorityLabel(detailsTask?.priority)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>{t('market.details.budget', 'Плановый бюджет:')}</strong>{' '}
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
                                            <strong>{t('market.details.taskType', 'Тип задачи:')}</strong> {getTaskTypeLabel(detailsTask?.taskType)}
                                        </Typography>
                                    </Stack>
                                </CardItem>

                                {detailsTask?.publicDescription || detailsTask?.taskDescription ? (
                                    <CardItem sx={{ minWidth: 0 }}>
                                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                            {t('market.details.description', 'Описание')}
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
                                                        {t('market.workItems.title', 'Состав работ')}
                                                    </Typography>

                                                    <Tooltip title={t('market.workItems.fullscreen', 'Развернуть на весь экран')}>
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
                                            {t('market.details.attachments', 'Вложения')}
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
                                                    {getAttachmentLabel(link)}
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
                                            ? t('market.card.withdrawLoading', 'Отменяем…')
                                            : t('market.card.withdraw', 'Отменить отклик')}
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
                                        {t('market.card.apply', 'Откликнуться')}
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
                        {t('market.workItems.title', 'Состав работ')}
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
