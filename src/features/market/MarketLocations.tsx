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
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { YMaps, Map, Placemark, Clusterer, ZoomControl, FullscreenControl } from '@pbe/react-yandex-maps';
import type { PublicTaskStatus, PriorityLevel, TaskVisibility, TaskType } from '@/app/types/taskTypes';
import type { TaskApplication } from '@/app/types/application';
import { getPriorityIcon, getPriorityLabelRu } from '@/utils/priorityIcons';
import { withBasePath } from '@/utils/basePath';

export type MarketPublicTask = {
    _id: string;
    taskId?: string;
    taskName?: string;
    bsNumber?: string;
    bsLocation?: Array<{ name?: string; coordinates?: string | null; address?: string }>;
    bsAddress?: string;
    orgName?: string;
    orgSlug?: string;
    visibility?: TaskVisibility;
    publicStatus?: PublicTaskStatus;
    priority?: PriorityLevel;
    budget?: number | null;
    currency?: string;
    taskDescription?: string;
    publicDescription?: string;
    workItems?: { workType?: string; quantity?: number; unit?: string; note?: string }[];
    attachments?: string[];
    applicationCount?: number;
    myApplication?: Pick<TaskApplication, '_id' | 'status' | 'proposedBudget' | 'etaDays' | 'coverMessage'> | null;
    dueDate?: string;
    taskType?: TaskType;
    project?: { key?: string; regionCode?: string; name?: string; operator?: string };
};

type MapPoint = {
    id: string;
    taskId: string;
    coords: [number, number];
    bsNumber: string;
    taskName: string;
    region?: string | null;
    projectKey?: string | null;
    orgName?: string | null;
    status?: PublicTaskStatus;
    priority?: PriorityLevel;
    budget?: number | null;
    currency?: string;
    address?: string | null;
};

const DEFAULT_CENTER: [number, number] = [56.0, 104.0];
const DEFAULT_ZOOM = 4;
const PUBLIC_STATUSES: PublicTaskStatus[] = ['open', 'in_review', 'assigned', 'closed'];
const PRIORITIES: PriorityLevel[] = ['urgent', 'high', 'medium', 'low'];

const STATUS_META: Record<
    PublicTaskStatus,
    {
        label: string;
        color: string;
    }
> = {
    open: { label: 'Открыта', color: '#22c55e' },
    in_review: { label: 'На модерации', color: '#eab308' },
    assigned: { label: 'Назначена', color: '#6366f1' },
    closed: { label: 'Закрыта', color: '#94a3b8' },
};

const parseCoords = (raw?: string | null): [number, number] | null => {
    if (!raw) return null;
    const parts = raw
        .trim()
        .split(/[ ,;]+/)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    if (parts.length < 2) return null;
    return [parts[0], parts[1]];
};

const formatBudget = (budget?: number | null, currency?: string): string => {
    if (!budget || budget <= 0) return 'Бюджет не указан';
    const formatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
    return `${formatter.format(budget)} ${currency || 'RUB'}`;
};

type MarketLocationsProps = {
    onOpenInfo?: (task: MarketPublicTask) => void;
    onOpenApply?: (task: MarketPublicTask) => void;
};

export default function MarketLocations({ onOpenInfo, onOpenApply }: MarketLocationsProps): React.ReactElement {
    const [tasks, setTasks] = React.useState<MarketPublicTask[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<Record<PublicTaskStatus, boolean>>(() => ({
        open: true,
        in_review: true,
        assigned: true,
        closed: false,
    }));
    const [priorityFilter, setPriorityFilter] = React.useState<Record<PriorityLevel, boolean>>(() => ({
        urgent: true,
        high: true,
        medium: true,
        low: true,
    }));
    const [filtersOpen, setFiltersOpen] = React.useState(false);
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const loadTasks = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(withBasePath('/api/tasks/public?limit=200'), { cache: 'no-store' });
            const payload = (await res.json()) as { tasks?: MarketPublicTask[]; error?: string };
            if (!res.ok || payload.error) {
                setError(payload.error || 'Не удалось загрузить публичные задачи');
                setTasks([]);
                return;
            }
            const publicTasks = (payload.tasks || []).filter((task) => task.visibility === 'public');
            setTasks(publicTasks);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка при загрузке задач');
            setTasks([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadTasks();
    }, [loadTasks]);

    const placemarks = React.useMemo(() => {
        const result: MapPoint[] = [];
        tasks.forEach((task) => {
            if (!Array.isArray(task.bsLocation) || task.bsLocation.length === 0) {
                return;
            }
            task.bsLocation.forEach((loc, idx) => {
                const coords = parseCoords(loc?.coordinates);
                if (!coords) return;

                const bsNumber =
                    (loc?.name && loc.name.trim()) ||
                    (task.bsNumber ? task.bsNumber.trim() : '') ||
                    `БС ${idx + 1}`;

                result.push({
                    id: `${task._id}-${idx}`,
                    coords,
                    bsNumber,
                    taskId: task.taskId ?? '',
                    taskName: task.taskName?.trim() || 'Задача',
                    region: task.project?.regionCode ?? null,
                    projectKey: task.project?.key ?? null,
                    orgName: task.orgName ?? task.orgSlug ?? null,
                    status: task.publicStatus,
                    priority: task.priority,
                    budget: task.budget,
                    currency: task.currency,
                    address: loc?.address ?? task.bsAddress ?? null,
                });
            });
        });
        return result;
    }, [tasks]);

    const filteredPlacemarks = React.useMemo(() => {
        const query = search.trim().toLowerCase();
        return placemarks.filter((point) => {
            const matchesSearch =
                !query ||
                point.bsNumber.toLowerCase().includes(query) ||
                point.taskName.toLowerCase().includes(query) ||
                (point.projectKey ? point.projectKey.toLowerCase().includes(query) : false) ||
                (point.region ? point.region.toLowerCase().includes(query) : false) ||
                (point.orgName ? point.orgName.toLowerCase().includes(query) : false);
            const statusOk = point.status ? Boolean(statusFilter[point.status]) : true;
            const priorityOk = point.priority ? Boolean(priorityFilter[point.priority]) : true;
            return matchesSearch && statusOk && priorityOk;
        });
    }, [placemarks, priorityFilter, search, statusFilter]);

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
        if (!filteredPlacemarks.length) return DEFAULT_ZOOM;
        return filteredPlacemarks.length > 1 ? 5 : 12;
    }, [filteredPlacemarks.length]);

    const ymapsQuery = React.useMemo(() => {
        const apiKey =
            process.env.NEXT_PUBLIC_YANDEX_MAPS_APIKEY ?? process.env.NEXT_PUBLIC_YMAPS_API_KEY;
        const base = { lang: 'ru_RU' as const };
        return apiKey ? { ...base, apikey: apiKey } : base;
    }, []);

    const mapKey = `${mapCenter[0].toFixed(4)}-${mapCenter[1].toFixed(4)}-${filteredPlacemarks.length}`;
    const showEmptyState = !loading && !error && filteredPlacemarks.length === 0;

    const filtersPristine = React.useMemo(() => {
        if (search.trim()) return false;
        for (const status of PUBLIC_STATUSES) {
            const expected = status !== 'closed';
            if (statusFilter[status] !== expected) return false;
        }
        for (const pr of PRIORITIES) {
            if (!priorityFilter[pr]) return false;
        }
        return true;
    }, [priorityFilter, search, statusFilter]);

    const buildBalloonContent = React.useCallback((point: MapPoint) => {
        const statusLine = point.status
            ? `<div style="margin-bottom:4px;">Статус: ${STATUS_META[point.status].label}</div>`
            : '';
        const priorityLine = point.priority
            ? `<div style="margin-bottom:4px;">Приоритет: ${getPriorityLabelRu(point.priority)}</div>`
            : '';
        const budgetLine = point.budget
            ? `<div style="margin-bottom:4px;">Бюджет: ${formatBudget(point.budget, point.currency)}</div>`
            : '';
        const projectLine = point.projectKey
            ? `<div style="margin-bottom:4px;">Проект: ${point.projectKey}</div>`
            : '';
        const orgLine = point.orgName
            ? `<div style="margin-bottom:4px;">Организация: ${point.orgName}</div>`
            : '';
        const addressLine = point.address
            ? `<div style="margin-bottom:4px;">Адрес: ${point.address}</div>`
            : '';

        return `<div style="font-family:Inter,Arial,sans-serif;min-width:260px;">
            <div style="font-weight:700;margin-bottom:6px;">БС ${point.bsNumber}</div>
            <div style="margin-bottom:4px;">${point.taskName || 'Задача'}</div>
            ${statusLine}
            ${priorityLine}
            ${budgetLine}
            ${projectLine}
            ${orgLine}
            ${addressLine}
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
                <a href="#" data-balloon-action="info" data-task-id="${point.taskId}" style="color:#2563eb;text-decoration:none;font-weight:600;">Информация о задаче</a>
                <button data-balloon-action="apply" data-task-id="${point.taskId}" style="padding:10px 12px;border-radius:10px;border:none;background:#111827;color:#fff;font-weight:700;cursor:pointer;">Откликнуться</button>
            </div>
            <div style="color:#64748b;font-size:12px;">ID: ${point.taskId || '—'}</div>
        </div>`;
    }, []);

    const glassPaperSx = React.useMemo(() => {
        const borderColor = alpha(isDark ? '#ffffff' : '#0f172a', isDark ? 0.12 : 0.08);
        return {
            p: 1.5,
            boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
            borderRadius: 3,
            backdropFilter: 'blur(16px)',
            background: isDark
                ? 'rgba(18,24,36,0.78)'
                : 'linear-gradient(145deg, rgba(255,255,255,0.9), rgba(243,247,252,0.82))',
            border: `1px solid ${borderColor}`,
        };
    }, [isDark]);

    const resetFilters = React.useCallback(() => {
        setSearch('');
        setStatusFilter({
            open: true,
            in_review: true,
            assigned: true,
            closed: false,
        });
        setPriorityFilter({
            urgent: true,
            high: true,
            medium: true,
            low: true,
        });
    }, []);

    React.useEffect(() => {
        const handleBalloonClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (!target) return;
            const actionNode = target.closest<HTMLElement>('[data-balloon-action]');
            if (!actionNode) return;
            const action = actionNode.getAttribute('data-balloon-action');
            const taskId = actionNode.getAttribute('data-task-id');
            if (!action || !taskId) return;
            const task = tasks.find((t) => t.taskId === taskId);
            if (!task) return;
            event.preventDefault();
            if (action === 'info') {
                onOpenInfo?.(task);
            } else if (action === 'apply') {
                onOpenApply?.(task);
            }
        };

        document.addEventListener('click', handleBalloonClick, true);
        return () => {
            document.removeEventListener('click', handleBalloonClick, true);
        };
    }, [onOpenApply, onOpenInfo, tasks]);

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
                    top: { xs: 12, md: 16 },
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
                            borderRadius: '50%',
                            bgcolor: '#ffffff',
                            color: '#0f172a',
                            border: `1px solid ${alpha('#0f172a', 0.12)}`,
                            boxShadow: '0 10px 24px rgba(0,0,0,0.15)',
                            backdropFilter: 'blur(10px)',
                        }}
                    >
                        {filtersOpen ? <CloseRoundedIcon /> : <TuneRoundedIcon />}
                    </IconButton>
                    <Tooltip title="Обновить данные">
                        <span>
                            <IconButton
                                aria-label="Обновить"
                                onClick={() => void loadTasks()}
                                disabled={loading}
                                sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    bgcolor: '#ffffff',
                                    color: '#0f172a',
                                    border: `1px solid ${alpha('#0f172a', 0.12)}`,
                                    boxShadow: '0 10px 24px rgba(0,0,0,0.15)',
                                    backdropFilter: 'blur(10px)',
                                }}
                            >
                                <RefreshRoundedIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
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
                                placeholder="Поиск по БС, задаче, региону"
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
                                        borderRadius: 2,
                                        backgroundColor: alpha(isDark ? '#0b1220' : '#ffffff', isDark ? 0.5 : 0.9),
                                        backdropFilter: 'blur(12px)',
                                    },
                                }}
                            />

                            <Stack spacing={1}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        Статусы
                                    </Typography>
                                    <Tooltip title="Сбросить фильтры">
                                        <IconButton size="small" onClick={resetFilters}>
                                            <RestartAltRoundedIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                    {PUBLIC_STATUSES.map((status) => {
                                        const active = statusFilter[status];
                                        const meta = STATUS_META[status];
                                        return (
                                            <Chip
                                                key={status}
                                                label={meta.label}
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
                                                            borderRadius: '50%',
                                                            backgroundColor: meta.color,
                                                        }}
                                                    />
                                                }
                                                variant={active ? 'filled' : 'outlined'}
                                                sx={{
                                                    backgroundColor: active
                                                        ? alpha(meta.color, 0.14)
                                                        : 'transparent',
                                                    borderColor: alpha(meta.color, active ? 0.24 : 0.35),
                                                    color: active ? 'text.primary' : 'text.secondary',
                                                    '&:hover': {
                                                        backgroundColor: alpha(meta.color, 0.2),
                                                    },
                                                }}
                                            />
                                        );
                                    })}
                                </Box>

                                <Divider flexItem sx={{ my: 0.5, opacity: 0.35 }} />

                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    Приоритет
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                    {PRIORITIES.map((priority) => {
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
                                                variant={active ? 'filled' : 'outlined'}
                                                sx={{
                                                    backgroundColor: active
                                                        ? alpha('#0f172a', isDark ? 0.4 : 0.08)
                                                        : 'transparent',
                                                    color: active ? 'text.primary' : 'text.secondary',
                                                    borderColor: alpha('#0f172a', 0.2),
                                                    '&:hover': {
                                                        backgroundColor: alpha('#0f172a', isDark ? 0.5 : 0.12),
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
                        Публичные задачи с координатами не найдены.
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
                            options={{
                                suppressObsoleteBrowserNotifier: true,
                                suppressMapOpenBlock: true,
                            }}
                        >
                            <FullscreenControl options={{ position: { right: 16, top: 16 } }} />
                            <ZoomControl options={{ position: { right: 16, top: 80 } }} />

                            <Clusterer
                                options={{
                                    preset: 'islands#redClusterIcons',
                                    groupByCoordinates: false,
                                    gridSize: 80,
                                    clusterDisableClickZoom: true,
                                    clusterOpenBalloonOnClick: true,
                                    clusterBalloonContentLayout: 'cluster#balloonCarousel',
                                    clusterBalloonPanelMaxMapArea: 0,
                                    hideIconOnBalloonOpen: false,
                                }}
                                modules={['clusterer.addon.balloon', 'clusterer.addon.hint']}
                            >
                                {filteredPlacemarks.map((point) => (
                                    <Placemark
                                        key={point.id}
                                        geometry={point.coords}
                                        properties={{
                                            hintContent: `БС ${point.bsNumber}`,
                                            balloonContent: buildBalloonContent(point),
                                            iconCaption: point.bsNumber,
                                        }}
                                        options={{
                                            preset: 'islands#redIcon',
                                            iconColor: '#ef4444',
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
