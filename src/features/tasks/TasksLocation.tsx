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
import { YMaps, Map, Placemark, Clusterer, ZoomControl, FullscreenControl } from '@pbe/react-yandex-maps';
import { fetchUserContext } from '@/app/utils/userContext';
import type { CurrentStatus, PriorityLevel } from '@/app/types/taskTypes';
import { getStatusColor } from '@/utils/statusColors';
import { getPriorityIcon, getPriorityLabelRu } from '@/utils/priorityIcons';
import { getStatusLabel } from '@/utils/statusLabels';
import { withBasePath } from '@/utils/basePath';
import {
    OPERATOR_CLUSTER_PRESETS,
    OPERATOR_COLORS,
    normalizeOperator,
    type OperatorSlug,
} from '@/utils/operatorColors';

type TaskLocation = {
    _id?: string;
    taskId?: string;
    taskName?: string;
    bsNumber?: string;
    bsLocation?: Array<{ name?: string; coordinates?: string | null }>;
    executorId?: string | null;
    executorEmail?: string | null;
    executorName?: string | null;
    status?: CurrentStatus;
    priority?: PriorityLevel;
    projectOperator?: string | null;
};

type MapPoint = {
    id: string;
    coords: [number, number];
    bsNumber: string;
    taskId: string;
    taskName: string;
    relatedNumbers: string | null;
    slug: string | null;
    status?: CurrentStatus;
    priority?: PriorityLevel;
    executorName?: string | null;
    operator: OperatorSlug;
};

type UserIdentity = {
    id?: string;
    email?: string;
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

const normalizeSlug = (task: TaskLocation): string | null => {
    if (typeof task.taskId === 'string' && task.taskId.trim()) {
        return task.taskId.trim().toLowerCase();
    }
    return null;
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

export default function TasksLocation(): React.ReactElement {
    const [tasks, setTasks] = React.useState<TaskLocation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [userIdentity, setUserIdentity] = React.useState<UserIdentity | null>(null);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<Record<CurrentStatus, boolean>>(() => {
        const base: Record<CurrentStatus, boolean> = {
            'To do': true,
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
    const [filtersOpen, setFiltersOpen] = React.useState(false);
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    React.useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const [ctx, tasksResponse] = await Promise.all([
                    fetchUserContext(),
                    fetch(withBasePath('/api/tasks'), { cache: 'no-store' }),
                ]);
                if (!active) return;

                if (ctx?.user) {
                    const emailFromPayload = typeof ctx.email === 'string' ? ctx.email : undefined;
                    const rawUser = ctx.user as { email?: unknown; clerkUserId?: unknown };
                    const userEmail =
                        typeof rawUser?.email === 'string'
                            ? rawUser.email
                            : emailFromPayload;
                    const email = userEmail ? userEmail.toLowerCase() : undefined;
                    const clerkId = typeof rawUser?.clerkUserId === 'string' ? rawUser.clerkUserId : undefined;
                    setUserIdentity({
                        id: clerkId,
                        email,
                    });
                } else {
                    setError('Не удалось определить текущего пользователя');
                }

                const payload = (await tasksResponse.json()) as { tasks?: TaskLocation[]; error?: string };
                if (!tasksResponse.ok) {
                    setError(payload?.error ?? 'Не удалось загрузить задачи');
                    return;
                }
                setTasks(Array.isArray(payload.tasks) ? payload.tasks : []);
            } catch (err) {
                if (!active) return;
                setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, []);

    const assignedTasks = React.useMemo(() => {
        const executorId = userIdentity?.id;
        const email = userIdentity?.email;
        if (!executorId && !email) return [];
        return tasks.filter((task) => {
            const taskEmail =
                typeof task.executorEmail === 'string' ? task.executorEmail.toLowerCase() : '';
            return Boolean(
                (executorId && task.executorId === executorId) ||
                    (email && taskEmail === email)
            );
        });
    }, [tasks, userIdentity]);

    const placemarks = React.useMemo(() => {
        const result: MapPoint[] = [];
        for (const task of assignedTasks) {
            if (!Array.isArray(task.bsLocation) || task.bsLocation.length === 0) continue;
            const bsNumbers = collectBsNumbers(task);
            task.bsLocation.forEach((loc, idx) => {
                const coords = parseCoords(loc?.coordinates);
                if (!coords) return;

                const bsNumber =
                    (loc?.name && loc.name.trim()) || bsNumbers[idx] || bsNumbers[0] || task.bsNumber || `БС ${idx + 1}`;
                const relatedNumbers = buildRelatedNumbers(task, bsNumbers, idx);

                result.push({
                    id: `${task._id ?? task.taskId ?? 'task'}-${idx}`,
                    coords,
                    bsNumber,
                    taskId: task.taskId ?? '',
                    taskName: task.taskName?.trim() || 'Задача',
                    relatedNumbers,
                    slug: normalizeSlug(task),
                    status: task.status,
                    priority: task.priority,
                    executorName: task.executorName ?? null,
                    operator: normalizeOperator(task.projectOperator),
                });
            });
        }
        return result;
    }, [assignedTasks]);

    const filteredPlacemarks = React.useMemo(() => {
        const query = search.trim().toLowerCase();
        return placemarks.filter((point) => {
            const matchesSearch =
                !query ||
                point.bsNumber.toLowerCase().includes(query) ||
                point.taskName.toLowerCase().includes(query) ||
                (point.relatedNumbers ? point.relatedNumbers.toLowerCase().includes(query) : false);
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
        for (const status of ALL_STATUSES) {
            const expected = status !== 'Agreed';
            if (statusFilter[status] !== expected) return false;
        }
        for (const pr of ALL_PRIORITIES) {
            if (!priorityFilter[pr]) return false;
        }
        return true;
    }, [priorityFilter, search, statusFilter]);

    const buildBalloonContent = React.useCallback((point: MapPoint) => {
        const linkHref = point.slug ? `/tasks/${encodeURIComponent(point.slug)}` : null;
        const relatedBlock = point.relatedNumbers
            ? `<div style="margin-bottom:4px;">Связанные БС: ${point.relatedNumbers}</div>`
            : '';
        const statusLine = point.status
            ? `<div style="margin-bottom:4px;">Статус: ${getStatusLabel(point.status)}</div>`
            : '';
        const priorityLine = point.priority
            ? `<div style="margin-bottom:4px;">Приоритет: ${getPriorityLabelRu(point.priority)}</div>`
            : '';
        return `<div style="font-family:Inter,Arial,sans-serif;min-width:240px;">
            <div style="font-weight:600;margin-bottom:4px;">БС ${point.bsNumber}</div>
            <div style="margin-bottom:4px;">ID задачи: ${point.taskId || '—'}</div>
            <div style="margin-bottom:4px;">${point.taskName || '—'}</div>
            ${statusLine}
            ${priorityLine}
            ${relatedBlock}
            ${
                linkHref
                    ? `<a href="${linkHref}" style="color:#1976d2;text-decoration:none;font-weight:600;" target="_self">Перейти к задаче</a>`
                    : ''
            }
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
            'To do': true,
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
    }, []);

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
                                placeholder="Поиск по БС или задаче"
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
                                    {ALL_STATUSES.map((status) => {
                                        const active = statusFilter[status];
                                        return (
                                            <Chip
                                                key={status}
                                                label={getStatusLabel(status)}
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
                                                            backgroundColor: getStatusColor(status),
                                                        }}
                                                    />
                                                }
                                                variant={active ? 'filled' : 'outlined'}
                                                sx={{
                                                    backgroundColor: active
                                                        ? alpha(getStatusColor(status), 0.14)
                                                        : 'transparent',
                                                    borderColor: alpha(getStatusColor(status), active ? 0.24 : 0.4),
                                                    color: active ? 'text.primary' : 'text.secondary',
                                                    '&:hover': {
                                                        backgroundColor: alpha(getStatusColor(status), 0.2),
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
                                    {ALL_PRIORITIES.map((priority) => {
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
                        Нет задач с координатами, назначенных вам.
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
                                    preset: clusterPreset,
                                    groupByCoordinates: false,
                                    gridSize: 80,

                                    // Вместо зума — открываем балун кластера
                                    clusterDisableClickZoom: true,
                                    clusterOpenBalloonOnClick: true,

                                    // Балун кластера в виде карусели,
                                    // каждый Placemark -> отдельный слайд с его balloonContent
                                    clusterBalloonContentLayout: 'cluster#balloonCarousel',

                                    // Чтобы панель-кластер открывалась на любом масштабе
                                    clusterBalloonPanelMaxMapArea: 0,

                                    // Не скрывать значок кластера при открытом балуне
                                    hideIconOnBalloonOpen: false,
                                }}
                                // Модули для работы баллонов и подсказок у кластера
                                modules={['clusterer.addon.balloon', 'clusterer.addon.hint']}
                            >
                                {filteredPlacemarks.map((point) => (
                                    <Placemark
                                        key={point.id}
                                        geometry={point.coords}
                                        properties={{
                                            hintContent: `БС ${point.bsNumber}`,
                                            // это и будет контентом слайда в карусели кластера
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
