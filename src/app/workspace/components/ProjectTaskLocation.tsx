'use client';

import * as React from 'react';
import {
    Box,
    CircularProgress,
    Alert,
    Typography,
    Paper,
    Stack,
    IconButton,
    TextField,
    InputAdornment,
    Chip,
    Divider,
    Tooltip,
    Button,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useParams } from 'next/navigation';
import {
    YMaps,
    Map,
    Placemark,
    Clusterer,
    FullscreenControl,
    TypeSelector,
} from '@pbe/react-yandex-maps';
import type { IOptionManager } from 'yandex-maps';
import type { CurrentStatus, PriorityLevel } from '@/app/types/taskTypes';
import { getStatusColor } from '@/utils/statusColors';
import { getPriorityIcon, getPriorityLabelRu } from '@/utils/priorityIcons';
import { getStatusLabel } from '@/utils/statusLabels';
import { UI_RADIUS } from '@/config/uiTokens';
import { withBasePath } from '@/utils/basePath';
import {
    OPERATOR_CLUSTER_PRESETS,
    OPERATOR_COLORS,
    normalizeOperator,
    type OperatorSlug,
} from '@/utils/operatorColors';
import { CORE_OPERATORS } from '@/app/constants/operators';
import { useI18n } from '@/i18n/I18nProvider';

type TaskLocation = {
    _id?: string;
    taskId?: string;
    taskName?: string;
    bsNumber?: string;
    bsLocation?: Array<{ name?: string; coordinates?: string | null }>;
    status?: CurrentStatus;
    priority?: PriorityLevel;
    projectName?: string | null;
    projectKey?: string | null;
    projectOperator?: string | null;
    orgName?: string | null;
    orgSlug?: string | null;
    authorName?: string | null;
    authorEmail?: string | null;
    executorName?: string | null;
    executorEmail?: string | null;
};

type MapPoint = {
    id: string;
    coords: [number, number];
    bsNumber: string;
    taskId: string;
    taskName: string;
    relatedNumbers: string | null;
    taskIdentifier: string | null;
    status?: CurrentStatus;
    priority?: PriorityLevel;
    projectName?: string | null;
    projectKey?: string | null;
    operator: OperatorSlug;
    operatorLabel?: string | null;
    orgName?: string | null;
    managerName?: string | null;
    managerEmail?: string | null;
    executorName?: string | null;
    executorEmail?: string | null;
};

const DEFAULT_CENTER: [number, number] = [56.0, 104.0];
const ALL_STATUSES: CurrentStatus[] = [
    'To do',
    'Assigned',
    'At work',
    'Done',
    'Pending',
    'Issues',
    'Fixed',
    'Agreed',
];
const ALL_PRIORITIES: PriorityLevel[] = ['urgent', 'high', 'medium', 'low'];
const OPERATOR_LABELS: Record<OperatorSlug, string> = {
    t2: 'Т2',
    beeline: 'Билайн',
    megafon: 'Мегафон',
    mts: 'МТС',
};
const OPERATOR_LABEL_BY_SLUG = CORE_OPERATORS.reduce<Record<OperatorSlug, string>>((acc, operator) => {
    const slug = normalizeOperator(operator.value);
    acc[slug] = `${operator.name} (${operator.value})`;
    return acc;
}, {
    t2: 'Т2 (250020)',
    beeline: 'Билайн (250099)',
    megafon: 'Мегафон (250002)',
    mts: 'МТС (250001)',
});
const OPERATOR_LABEL_ALIASES = CORE_OPERATORS.reduce<Record<string, string>>((acc, operator) => {
    const label = `${operator.name} (${operator.value})`;
    acc[operator.value.toLowerCase()] = label;
    acc[operator.visibleCode.toLowerCase()] = label;
    acc[operator.name.toLowerCase()] = label;
    acc[normalizeOperator(operator.value)] = label;
    return acc;
}, {});

const parseCoords = (raw?: string | null): [number, number] | null => {
    if (!raw) return null;
    const parts = raw
        .trim()
        .split(/[ ,;]+/)
        .map((part) => Number(part))
        .filter((value) => Number.isFinite(value));
    if (parts.length < 2) return null;
    return [parts[0], parts[1]];
};

const collectBsNumbers = (task: TaskLocation): string[] => {
    const names = Array.isArray(task.bsLocation)
        ? task.bsLocation
              .map((loc) => (loc?.name ? loc.name.trim() : ''))
              .filter(Boolean)
        : [];
    if (names.length > 0) return names;
    if (typeof task.bsNumber !== 'string') return [];
    return task.bsNumber
        .split(/[-;,]+/)
        .map((value) => value.trim())
        .filter(Boolean);
};

const buildRelatedNumbers = (task: TaskLocation, pool: string[], currentIndex: number): string | null => {
    if (!Array.isArray(task.bsLocation) || task.bsLocation.length < 2) return null;
    const values: string[] = [];
    task.bsLocation.forEach((loc, idx) => {
        if (idx === currentIndex) return;
        const number = (loc?.name && loc.name.trim()) || pool[idx] || pool[0];
        if (number) {
            values.push(number);
        }
    });
    if (values.length === 0) return null;
    return values.join(', ');
};

const resolveOperatorLabel = (raw?: string | null, fallback?: OperatorSlug): string | null => {
    const trimmed = raw?.toString().trim();
    if (trimmed) {
        const normalized = trimmed.toLowerCase();
        if (OPERATOR_LABEL_ALIASES[normalized]) {
            return OPERATOR_LABEL_ALIASES[normalized];
        }
        return trimmed;
    }
    if (fallback) return OPERATOR_LABEL_BY_SLUG[fallback] ?? OPERATOR_LABELS[fallback] ?? fallback;
    return null;
};

type ProjectTaskLocationProps = {
    contactRole?: 'executor' | 'manager';
};

export default function ProjectTaskLocation({
    contactRole = 'executor',
}: ProjectTaskLocationProps): React.ReactElement {
    const { t } = useI18n();
    const [tasks, setTasks] = React.useState<TaskLocation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<Record<CurrentStatus, boolean>>(() => {
        const base: Record<CurrentStatus, boolean> = {
            'To do': true,
            Draft: true,
            Assigned: true,
            'At work': true,
            Done: true,
            Pending: true,
            Issues: true,
            Fixed: true,
            Agreed: false,
        };
        return base;
    });
    const [priorityFilter, setPriorityFilter] = React.useState<Record<PriorityLevel, boolean>>(() => ({
        urgent: true,
        high: true,
        medium: true,
        low: true,
    }));
    const [operatorFilter, setOperatorFilter] = React.useState<Record<OperatorSlug, boolean>>(() => ({
        t2: true,
        beeline: true,
        megafon: true,
        mts: true,
    }));
    const [filtersOpen, setFiltersOpen] = React.useState(false);
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const accentBase = isDark ? '#e2e8f0' : '#0f172a';
    const filterButtonBg = isDark ? 'rgba(248,250,252,0.92)' : '#ffffff';
    const filterButtonBorder = alpha(accentBase, isDark ? 0.18 : 0.12);
    const filterButtonColor = isDark ? '#0b1220' : '#0f172a';
    const controlsTopOffset = 28;
    // TypeSelector typings expect IOptionManager; cast to allow position options.
    const typeSelectorOptions = React.useMemo(
        () =>
            ({
                position: { right: 16, top: controlsTopOffset + 64 },
            } as unknown as IOptionManager),
        [controlsTopOffset]
    );
    const params = useParams<{ org?: string; project?: string }>();
    const orgSlug = params?.org;
    const projectSlug = params?.project;

    React.useEffect(() => {
        let active = true;
        const extractTasks = (payload: unknown): TaskLocation[] => {
            if (!payload || typeof payload !== 'object') return [];
            const value = payload as { tasks?: unknown; items?: unknown };
            if (Array.isArray(value.tasks)) return value.tasks as TaskLocation[];
            if (Array.isArray(value.items)) return value.items as TaskLocation[];
            return [];
        };

        const fetchProjectTasks = async (orgRef: string, projectRef: string) => {
            const pageSize = 100;
            let page = 1;
            let collected: TaskLocation[] = [];
            while (true) {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(orgRef)}/projects/${encodeURIComponent(
                        projectRef
                    )}/tasks?page=${page}&limit=${pageSize}`,
                    { cache: 'no-store' }
                );
                const payload = (await res.json().catch(() => null)) as
                    | { items?: TaskLocation[]; total?: number; error?: string }
                    | null;
                if (!res.ok) {
                    return { error: payload?.error ?? 'Не удалось загрузить задачи' };
                }
                const items = extractTasks(payload);
                collected = collected.concat(items);
                const total = typeof payload?.total === 'number' ? payload.total : null;
                if (items.length < pageSize || (total !== null && collected.length >= total)) {
                    break;
                }
                page += 1;
            }
            return { tasks: collected };
        };

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const response = orgSlug && projectSlug
                    ? await fetchProjectTasks(orgSlug, projectSlug)
                    : null;
                if (!active) return;
                if (response?.error) {
                    setError(response.error);
                    setTasks([]);
                    return;
                }
                if (response?.tasks) {
                    setTasks(response.tasks);
                    return;
                }

                const tasksResponse = await fetch(withBasePath('/api/tasks'), { cache: 'no-store' });
                const payload = (await tasksResponse.json().catch(() => null)) as
                    | { tasks?: TaskLocation[]; error?: string }
                    | null;
                if (!active) return;

                if (!tasksResponse.ok) {
                    setError(payload?.error ?? 'Не удалось загрузить задачи');
                    setTasks([]);
                    return;
                }
                setTasks(extractTasks(payload));
            } catch (err) {
                if (!active) return;
                setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
                setTasks([]);
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [orgSlug, projectSlug]);

    const placemarks = React.useMemo(() => {
        const result: MapPoint[] = [];
        for (const task of tasks) {
            if (!Array.isArray(task.bsLocation) || task.bsLocation.length === 0) continue;
            const bsNumbers = collectBsNumbers(task);
            task.bsLocation.forEach((loc, idx) => {
                const coords = parseCoords(loc?.coordinates);
                if (!coords) return;

                const bsNumber =
                    (loc?.name && loc.name.trim()) || bsNumbers[idx] || bsNumbers[0] || task.bsNumber || `БС ${idx + 1}`;
                const relatedNumbers = buildRelatedNumbers(task, bsNumbers, idx);

                const operator = normalizeOperator(task.projectOperator);
                result.push({
                    id: `${task._id ?? task.taskId ?? 'task'}-${idx}`,
                    coords,
                    bsNumber,
                    taskId: task.taskId ?? '',
                    taskName: task.taskName?.trim() || 'Задача',
                    relatedNumbers,
                    taskIdentifier:
                        typeof task.taskId === 'string' && task.taskId.trim()
                            ? task.taskId.trim()
                            : null,
                    status: task.status,
                    priority: task.priority,
                    projectKey: task.projectKey ?? null,
                    projectName: task.projectName ?? null,
                    operator,
                    operatorLabel: resolveOperatorLabel(task.projectOperator, operator),
                    orgName: task.orgName ?? task.orgSlug ?? null,
                    managerName: task.authorName ?? null,
                    managerEmail: task.authorEmail ?? null,
                    executorName: task.executorName ?? null,
                    executorEmail: task.executorEmail ?? null,
                });
            });
        }
        return result;
    }, [tasks]);

    const availableStatuses = React.useMemo(() => {
        const present = new Set<CurrentStatus>();
        placemarks.forEach((point) => {
            if (point.status) present.add(point.status);
        });
        return ALL_STATUSES.filter((status) => present.has(status));
    }, [placemarks]);

    const availablePriorities = React.useMemo(() => {
        const present = new Set<PriorityLevel>();
        placemarks.forEach((point) => {
            if (point.priority) present.add(point.priority);
        });
        return ALL_PRIORITIES.filter((priority) => present.has(priority));
    }, [placemarks]);

    const availableOperators = React.useMemo(() => {
        const present = new Set<OperatorSlug>();
        placemarks.forEach((point) => {
            present.add(point.operator);
        });
        return (['t2', 'beeline', 'megafon', 'mts'] as OperatorSlug[]).filter((operator) =>
            present.has(operator)
        );
    }, [placemarks]);

    const filteredPlacemarks = React.useMemo(() => {
        const query = search.trim().toLowerCase();
        return placemarks.filter((point) => {
            const matchesSearch =
                !query ||
                point.bsNumber.toLowerCase().includes(query) ||
                point.taskName.toLowerCase().includes(query) ||
                (point.relatedNumbers ? point.relatedNumbers.toLowerCase().includes(query) : false) ||
                (point.projectName ? point.projectName.toLowerCase().includes(query) : false) ||
                (point.projectKey ? point.projectKey.toLowerCase().includes(query) : false) ||
                (point.orgName ? point.orgName.toLowerCase().includes(query) : false) ||
                (point.operatorLabel ? point.operatorLabel.toLowerCase().includes(query) : false) ||
                (point.managerName ? point.managerName.toLowerCase().includes(query) : false) ||
                (point.managerEmail ? point.managerEmail.toLowerCase().includes(query) : false);
            const statusOk = point.status ? Boolean(statusFilter[point.status]) : true;
            const priorityOk = point.priority ? Boolean(priorityFilter[point.priority]) : true;
            const operatorOk = Boolean(operatorFilter[point.operator]);
            return matchesSearch && statusOk && priorityOk && operatorOk;
        });
    }, [operatorFilter, placemarks, priorityFilter, search, statusFilter]);

    const mapCenter = React.useMemo<[number, number]>(() => {
        if (!filteredPlacemarks.length) return DEFAULT_CENTER;
        const sums = filteredPlacemarks.reduce(
            (acc, point) => {
                acc.lat += point.coords[0];
                acc.lon += point.coords[1];
                return acc;
            },
            { lat: 0, lon: 0 }
        );
        return [sums.lat / filteredPlacemarks.length, sums.lon / filteredPlacemarks.length];
    }, [filteredPlacemarks]);

    const zoom = React.useMemo(() => {
        if (!filteredPlacemarks.length) return 4;
        return filteredPlacemarks.length > 1 ? 5 : 12;
    }, [filteredPlacemarks.length]);

    const ymapsQuery = React.useMemo(() => {
        const apiKey =
            process.env.NEXT_PUBLIC_YANDEX_MAPS_APIKEY ?? process.env.NEXT_PUBLIC_YMAPS_API_KEY;
        const base = { lang: 'ru_RU' as const };
        return apiKey ? { ...base, apikey: apiKey } : base;
    }, []);

    const mapKey = `${mapCenter[0].toFixed(4)}-${mapCenter[1].toFixed(4)}-${filteredPlacemarks.length}`;
    const clusterPreset = React.useMemo(() => {
        const unique = new Set(filteredPlacemarks.map((point) => point.operator));
        if (unique.size === 1) {
            const [only] = Array.from(unique.values());
            return OPERATOR_CLUSTER_PRESETS[only];
        }
        return 'islands#grayClusterIcons';
    }, [filteredPlacemarks]);
    const showEmptyState = !loading && !error && filteredPlacemarks.length === 0;
    const filtersPristine = React.useMemo(() => {
        if (search.trim()) return false;
        for (const status of availableStatuses) {
            const expected = status !== 'Agreed';
            if (statusFilter[status] !== expected) return false;
        }
        for (const pr of availablePriorities) {
            if (!priorityFilter[pr]) return false;
        }
        for (const operator of availableOperators) {
            if (!operatorFilter[operator]) return false;
        }
        return true;
    }, [
        availableOperators,
        availablePriorities,
        availableStatuses,
        operatorFilter,
        priorityFilter,
        search,
        statusFilter,
    ]);

    const buildBalloonContent = React.useCallback(
        (point: MapPoint) => {
            const projectRef = point.projectKey || projectSlug;
            const linkHref =
                point.taskIdentifier && orgSlug && projectRef
                    ? `/org/${encodeURIComponent(orgSlug)}/projects/${encodeURIComponent(
                          projectRef
                      )}/tasks/${encodeURIComponent(point.taskIdentifier)}`
                    : point.taskIdentifier
                      ? `/tasks/${encodeURIComponent(point.taskIdentifier)}`
                      : null;
            const relatedBlock = point.relatedNumbers
                ? `<div style="margin-bottom:4px;">Связанные БС: ${point.relatedNumbers}</div>`
                : '';
            const statusLine = point.status
                ? `<div style="margin-bottom:4px;">${t('tasks.fields.status', 'Статус')}: ${getStatusLabel(point.status, t)}</div>`
                : '';
            const priorityLine = point.priority
                ? `<div style="margin-bottom:4px;">Приоритет: ${getPriorityLabelRu(point.priority)}</div>`
                : '';
            const projectLine =
                point.projectName || point.projectKey
                    ? `<div style="margin-bottom:4px;">Проект: ${point.projectName ?? point.projectKey}</div>`
                    : '';
            const orgLine = point.orgName
                ? `<div style="margin-bottom:4px;">Организация: ${point.orgName}</div>`
                : '';
            const operatorLine = point.operatorLabel
                ? `<div style="margin-bottom:4px;">Оператор: ${point.operatorLabel}</div>`
                : '';
            const managerLine =
                point.managerName
                    ? `<div style="margin-bottom:4px;">Менеджер: ${point.managerName}</div>`
                    : '';
            const executorLine =
                point.executorName || point.executorEmail
                    ? `<div style="margin-bottom:4px;">Исполнитель: ${point.executorName ?? point.executorEmail}</div>`
                    : '';
            return `<div style="font-family:Inter,Arial,sans-serif;min-width:240px;">
            <div style="font-weight:600;margin-bottom:4px;">БС ${point.bsNumber}</div>
            <div style="margin-bottom:4px;">ID задачи: ${point.taskId || '—'}</div>
            <div style="margin-bottom:4px;">${point.taskName || '—'}</div>
            ${orgLine}
            ${projectLine}
            ${operatorLine}
            ${statusLine}
            ${priorityLine}
            ${contactRole === 'manager' ? managerLine : executorLine}
            ${relatedBlock}
            ${
                linkHref
                    ? `<a href="${linkHref}" style="color:#1976d2;text-decoration:none;font-weight:600;" target="_self">Перейти к задаче</a>`
                    : ''
            }
        </div>`;
        },
        [contactRole, orgSlug, projectSlug, t]
    );

    const glassPaperSx = React.useMemo(() => {
        const borderColor = alpha(accentBase, isDark ? 0.12 : 0.08);
        return {
            p: 1.5,
            boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
            borderRadius: UI_RADIUS.tooltip,
            backdropFilter: 'blur(16px)',
            background: isDark
                ? 'rgba(18,24,36,0.78)'
                : 'linear-gradient(145deg, rgba(255,255,255,0.9), rgba(243,247,252,0.82))',
            border: `1px solid ${borderColor}`,
        };
    }, [accentBase, isDark]);

    const resetFilters = React.useCallback(() => {
        setSearch('');
        setStatusFilter({
            'To do': true,
            Draft: true,
            Assigned: true,
            'At work': true,
            Done: true,
            Pending: true,
            Issues: true,
            Fixed: true,
            Agreed: false,
        });
        setPriorityFilter({
            urgent: true,
            high: true,
            medium: true,
            low: true,
        });
        setOperatorFilter({
            t2: true,
            beeline: true,
            megafon: true,
            mts: true,
        });
    }, []);

    const activeStatusCount = React.useMemo(
        () => availableStatuses.filter((status) => statusFilter[status]).length,
        [availableStatuses, statusFilter]
    );
    const activePriorityCount = React.useMemo(
        () => availablePriorities.filter((priority) => priorityFilter[priority]).length,
        [availablePriorities, priorityFilter]
    );
    const activeOperatorCount = React.useMemo(
        () => availableOperators.filter((operator) => operatorFilter[operator]).length,
        [availableOperators, operatorFilter]
    );
    const statusLabel = availableStatuses.length
        ? `${t('tasks.statuses', 'Статусы задач')} · ${activeStatusCount}/${availableStatuses.length}`
        : t('tasks.statuses', 'Статусы задач');
    const priorityLabel = availablePriorities.length
        ? `Приоритет · ${activePriorityCount}/${availablePriorities.length}`
        : 'Приоритет';
    const operatorLabel = availableOperators.length
        ? `Оператор · ${activeOperatorCount}/${availableOperators.length}`
        : 'Оператор';

    return (
        <Box
            sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: '70vh',
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    top: { xs: 24, md: 28 },
                    left: { xs: 12, md: 16 },
                    zIndex: 5,
                    width: { xs: 'auto', sm: 420, md: 460 },
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                }}
            >
                <Box sx={{ display: 'flex', gap: 1, pointerEvents: 'auto' }}>
                    <IconButton
                        aria-label="Фильтры"
                        onClick={() => setFiltersOpen((prev) => !prev)}
                        sx={{
                            width: 48,
                            height: 48,
                            borderRadius: UI_RADIUS.circle,
                            bgcolor: filterButtonBg,
                            color: filterButtonColor,
                            border: `1px solid ${filterButtonBorder}`,
                            boxShadow: isDark ? '0 16px 30px rgba(0,0,0,0.35)' : '0 10px 24px rgba(0,0,0,0.15)',
                            backdropFilter: 'blur(10px)',
                        }}
                    >
                        {filtersOpen ? <CloseRoundedIcon /> : <TuneRoundedIcon />}
                    </IconButton>
                </Box>

                {filtersOpen && (
                    <Paper
                        sx={{
                            ...glassPaperSx,
                            pointerEvents: 'auto',
                            width: { xs: '88vw', sm: '100%' },
                            maxHeight: { xs: '70vh', sm: '80vh' },
                            overflowY: 'auto',
                        }}
                    >
                        <Stack spacing={1.5}>
                            <TextField
                                fullWidth
                                placeholder="Поиск по БС, задаче или проекту"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                size="small"
                                variant="filled"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon />
                                        </InputAdornment>
                                    ),
                                    endAdornment: search ? (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={() => setSearch('')}>
                                                <CloseRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    ) : null,
                                }}
                                sx={{
                                    '& .MuiFilledInput-root': {
                                        borderRadius: UI_RADIUS.item,
                                        backgroundColor: alpha(isDark ? '#0b1220' : '#ffffff', isDark ? 0.5 : 0.9),
                                        backdropFilter: 'blur(12px)',
                                    },
                                }}
                            />

                            <Stack spacing={1}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        {statusLabel}
                                    </Typography>
                                    <Tooltip title="Сбросить фильтры">
                                        <IconButton size="small" onClick={resetFilters}>
                                            <RestartAltRoundedIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, rowGap: 1 }}>
                                    {availableStatuses.map((status) => {
                                        const active = statusFilter[status];
                                        return (
                                            <Chip
                                                key={status}
                                                label={getStatusLabel(status, t)}
                                                onClick={() =>
                                                    setStatusFilter((prev) => ({
                                                        ...prev,
                                                        [status]: !prev[status],
                                                    }))
                                                }
                                                size="small"
                                                icon={
                                                    <Box
                                                        sx={{
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: UI_RADIUS.circle,
                                                            backgroundColor: getStatusColor(status),
                                                        }}
                                                    />
                                                }
                                                onDelete={
                                                    active
                                                        ? () =>
                                                              setStatusFilter((prev) => ({
                                                                  ...prev,
                                                                  [status]: false,
                                                              }))
                                                        : undefined
                                                }
                                                deleteIcon={active ? <CloseRoundedIcon fontSize="small" /> : undefined}
                                                variant={active ? 'filled' : 'outlined'}
                                                sx={{
                                                    backgroundColor: active
                                                        ? alpha(getStatusColor(status), isDark ? 0.2 : 0.14)
                                                        : 'transparent',
                                                    borderColor: alpha(getStatusColor(status), active ? 0.32 : 0.4),
                                                    color: active ? theme.palette.text.primary : theme.palette.text.secondary,
                                                    fontWeight: active ? 700 : 500,
                                                    boxShadow: active
                                                        ? `0 10px 20px ${alpha(getStatusColor(status), isDark ? 0.35 : 0.2)}`
                                                        : 'none',
                                                    '&:hover': {
                                                        backgroundColor: alpha(getStatusColor(status), isDark ? 0.28 : 0.2),
                                                    },
                                                }}
                                            />
                                        );
                                    })}
                                </Box>

                                <Divider flexItem sx={{ my: 0.5, opacity: 0.35 }} />

                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {priorityLabel}
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                    {availablePriorities.map((priority) => {
                                        const active = priorityFilter[priority];
                                        const icon = getPriorityIcon(priority, { fontSize: 18 });
                                        return (
                                            <Chip
                                                key={priority}
                                                label={getPriorityLabelRu(priority) || priority}
                                                onClick={() =>
                                                    setPriorityFilter((prev) => ({
                                                        ...prev,
                                                        [priority]: !prev[priority],
                                                    }))
                                                }
                                                size="small"
                                                icon={icon ?? undefined}
                                                onDelete={
                                                    active
                                                        ? () =>
                                                              setPriorityFilter((prev) => ({
                                                                  ...prev,
                                                                  [priority]: false,
                                                              }))
                                                        : undefined
                                                }
                                                deleteIcon={active ? <CloseRoundedIcon fontSize="small" /> : undefined}
                                                variant={active ? 'filled' : 'outlined'}
                                                sx={{
                                                    backgroundColor: active
                                                        ? alpha(accentBase, isDark ? 0.35 : 0.12)
                                                        : 'transparent',
                                                    color: active ? theme.palette.text.primary : theme.palette.text.secondary,
                                                    borderColor: alpha(accentBase, isDark ? 0.3 : 0.2),
                                                    fontWeight: active ? 700 : 500,
                                                    boxShadow: active
                                                        ? `0 10px 20px ${alpha(accentBase, isDark ? 0.4 : 0.18)}`
                                                        : 'none',
                                                    '&:hover': {
                                                        backgroundColor: alpha(accentBase, isDark ? 0.45 : 0.18),
                                                    },
                                                }}
                                            />
                                        );
                                    })}
                                </Box>

                                <Divider flexItem sx={{ my: 0.5, opacity: 0.35 }} />

                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {operatorLabel}
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                    {availableOperators.map((operator) => {
                                        const active = operatorFilter[operator];
                                        const label = OPERATOR_LABEL_BY_SLUG[operator] ?? OPERATOR_LABELS[operator];
                                        return (
                                            <Chip
                                                key={operator}
                                                label={label}
                                                onClick={() =>
                                                    setOperatorFilter((prev) => ({
                                                        ...prev,
                                                        [operator]: !prev[operator],
                                                    }))
                                                }
                                                size="small"
                                                icon={
                                                    <Box
                                                        sx={{
                                                            width: 10,
                                                            height: 10,
                                                            borderRadius: UI_RADIUS.circle,
                                                            backgroundColor: OPERATOR_COLORS[operator],
                                                        }}
                                                    />
                                                }
                                                onDelete={
                                                    active
                                                        ? () =>
                                                              setOperatorFilter((prev) => ({
                                                                  ...prev,
                                                                  [operator]: false,
                                                              }))
                                                        : undefined
                                                }
                                                deleteIcon={active ? <CloseRoundedIcon fontSize="small" /> : undefined}
                                                variant={active ? 'filled' : 'outlined'}
                                                sx={{
                                                    backgroundColor: active
                                                        ? alpha(OPERATOR_COLORS[operator], isDark ? 0.25 : 0.14)
                                                        : 'transparent',
                                                    color: active ? theme.palette.text.primary : theme.palette.text.secondary,
                                                    borderColor: alpha(OPERATOR_COLORS[operator], active ? 0.32 : 0.4),
                                                    fontWeight: active ? 700 : 500,
                                                    boxShadow: active
                                                        ? `0 10px 20px ${alpha(OPERATOR_COLORS[operator], isDark ? 0.35 : 0.2)}`
                                                        : 'none',
                                                    '&:hover': {
                                                        backgroundColor: alpha(OPERATOR_COLORS[operator], isDark ? 0.32 : 0.2),
                                                    },
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Stack>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
                                <Typography variant="body2" fontWeight={600}>
                                    Точек на карте: {filteredPlacemarks.length}
                                </Typography>
                                {!filtersPristine && (
                                    <Button
                                        size="small"
                                        variant="text"
                                        startIcon={<RestartAltRoundedIcon fontSize="small" />}
                                        onClick={resetFilters}
                                    >
                                        Сбросить
                                    </Button>
                                )}
                            </Box>
                        </Stack>
                    </Paper>
                )}

                {showEmptyState && (
                    <Alert severity="info" sx={{ pointerEvents: 'auto', width: { xs: '92vw', sm: '100%' } }}>
                        Нет задач с координатами в ваших проектах.
                    </Alert>
                )}
                {error && (
                    <Alert severity="error" sx={{ pointerEvents: 'auto', width: { xs: '92vw', sm: '100%' } }}>
                        {error}
                    </Alert>
                )}
            </Box>

            <Box sx={{ width: '100%', height: '100%' }}>
                {loading ? (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <CircularProgress />
                    </Box>
                ) : error || placemarks.length === 0 ? null : (
                    <YMaps query={ymapsQuery}>
                        <Map
                            key={mapKey}
                            defaultState={{ center: mapCenter, zoom }}
                            width="100%"
                            height="100%"
                            modules={['control.TypeSelector']}
                            options={{
                                suppressObsoleteBrowserNotifier: true,
                                suppressMapOpenBlock: true,
                            }}
                        >
                            <FullscreenControl options={{ position: { right: 16, top: controlsTopOffset } }} />
                            <TypeSelector options={typeSelectorOptions} />
                            <Clusterer
                                options={{
                                    preset: clusterPreset,
                                    groupByCoordinates: false,
                                    gridSize: 80,

                                    // Важно: пусть кластер не зумит карту, а открывает баллон
                                    clusterDisableClickZoom: true,
                                    clusterOpenBalloonOnClick: true,

                                    // Используем карусель в баллоне кластера: по одному слайду на каждую задачу
                                    clusterBalloonContentLayout: 'cluster#balloonCarousel',

                                    // Чтобы баллон открывался даже на "крупном" масштабе
                                    clusterBalloonPanelMaxMapArea: 0,

                                    // Не скрывать иконку кластера при открытом балуне
                                    hideIconOnBalloonOpen: false,
                                }}
                                // Включаем поддержку баллонов и подсказок именно для кластера
                                modules={['clusterer.addon.balloon', 'clusterer.addon.hint']}
                            >
                                {filteredPlacemarks.map((point) => (
                                    <Placemark
                                        key={point.id}
                                        geometry={point.coords}
                                        properties={{
                                            hintContent: `БС ${point.bsNumber}`,
                                            // Это содержимое будет использоваться как слайд в карусели кластера
                                            balloonContent: buildBalloonContent(point),
                                            iconCaption: point.bsNumber,
                                        }}
                                        options={{
                                            preset: 'islands#circleIcon',
                                            iconColor: OPERATOR_COLORS[point.operator],
                                            hideIconOnBalloonOpen: false,
                                        }}
                                        modules={['geoObject.addon.balloon', 'geoObject.addon.hint']}
                                    />
                                ))}
                            </Clusterer>

                        </Map>
                    </YMaps>
                )}
            </Box>
        </Box>
    );
}
