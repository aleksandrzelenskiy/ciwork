'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    Autocomplete,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputAdornment,
    InputLabel,
    IconButton,
    MenuItem,
    Paper,
    Select,
    Stack,
    Tab,
    Tabs,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dynamic from 'next/dynamic';
import {
    dateFnsLocalizer,
    type CalendarProps,
    type Event as RBCEvent,
} from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
    format,
    parse,
    startOfWeek,
    getDay,
    addHours,
    getISOWeek,
    startOfDay,
    endOfDay,
} from 'date-fns';
import { ru } from 'date-fns/locale';

import { UI_RADIUS } from '@/config/uiTokens';
import { getPriorityIcon, getPriorityLabelRu, normalizePriority } from '@/utils/priorityIcons';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel, normalizeStatusTitle, STATUS_ORDER } from '@/utils/statusLabels';
import { getOperatorLabel } from '@/app/utils/operators';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import ProfileDialog from '@/features/profile/ProfileDialog';

type Priority = 'urgent' | 'high' | 'medium' | 'low';

type AdminTask = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: string;
    priority?: Priority | string;
    dueDate?: string;
    createdAt?: string;
    bsNumber?: string;
    totalCost?: number;
    authorId?: string;
    authorName?: string;
    authorEmail?: string;
    authorClerkUserId?: string;
    initiatorName?: string;
    initiatorEmail?: string;
    initiatorClerkUserId?: string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
    executorClerkUserId?: string;
    orgId?: string;
    orgName?: string;
    orgSlug?: string;
    projectId?: string;
    projectKey?: string;
    projectName?: string;
    projectOperator?: string;
    projectRegionCode?: string;
};

type AdminTaskFilters = {
    orgId: string;
    projectId: string;
    regionCode: string;
    operatorCode: string;
    status: string;
    priority: string;
    executor: string;
    dueFrom: Date | null;
    dueTo: Date | null;
};

type OrgOption = { id: string; label: string; slug?: string };
type ProjectOption = { id: string; label: string; key?: string; orgId?: string };
type RegionOption = { code: string; label: string };
type OperatorOption = { code: string; label: string };

const defaultFilters: AdminTaskFilters = {
    orgId: '',
    projectId: '',
    regionCode: '',
    operatorCode: '',
    status: '',
    priority: '',
    executor: '',
    dueFrom: null,
    dueTo: null,
};

const Calendar = dynamic(
    () =>
        import('react-big-calendar').then(
            (m) => m.Calendar as unknown as React.ComponentType<CalendarProps<CalendarEvent>>
        ),
    { ssr: false }
);

type CalendarEvent = RBCEvent<{ priority?: Priority | string; status?: string; id: string }>;

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales: { ru },
});

const statusBg: Record<string, string> = {
    'TO DO': '#9e9e9e',
    ASSIGNED: '#1565c0',
    'AT WORK': '#0288d1',
    DONE: '#2e7d32',
    PENDING: '#f59e0b',
    ISSUES: '#c62828',
    FIXED: '#00897b',
    AGREED: '#6d4c41',
};

const getExecutorLabel = (task: AdminTask) => {
    const name = task.executorName?.trim() || '';
    if (name) return name;
    return task.executorEmail?.trim() || '';
};

const getAuthorLabel = (task: AdminTask) => {
    const name = task.authorName?.trim() || '';
    if (name) return name;
    return task.authorEmail?.trim() || '';
};

const getInitiatorLabel = (task: AdminTask) => {
    const name = task.initiatorName?.trim() || '';
    if (name) return name;
    return task.initiatorEmail?.trim() || '';
};

const getRegionLabel = (code?: string | null) => {
    if (!code) return '—';
    return RUSSIAN_REGIONS.find((region) => region.code === code)?.label ?? code;
};

const getTaskHref = (task: AdminTask) => {
    if (!task.orgSlug) return null;
    const projectRef = task.projectKey || task.projectId;
    if (!projectRef) return null;
    const taskRef = task.taskId;
    if (!taskRef) return null;
    return `/org/${encodeURIComponent(task.orgSlug)}/projects/${encodeURIComponent(
        projectRef
    )}/tasks/${encodeURIComponent(taskRef)}`;
};

const getProjectHref = (task: AdminTask) => {
    if (!task.orgSlug) return null;
    const projectRef = task.projectKey || task.projectId;
    if (!projectRef) return null;
    return `/org/${encodeURIComponent(task.orgSlug)}/projects/${encodeURIComponent(projectRef)}`;
};

const getOrgHref = (task: AdminTask) => {
    if (!task.orgSlug) return null;
    return `/org/${encodeURIComponent(task.orgSlug)}`;
};

const formatDateRU = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU');
};

type ToolbarProps = {
    label: string;
    view: 'month' | 'week' | 'day' | string;
    date: Date;
    onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY' | 'DATE') => void;
    onView: (v: 'month' | 'week' | 'day' | string) => void;
};

function CalendarToolbar({ label, view, date, onNavigate, onView }: ToolbarProps) {
    const prefix = view === 'week' ? `W${getISOWeek(date)} — ` : '';
    return (
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => onNavigate('PREV')}>
                    ◀
                </Button>
                <Button size="small" onClick={() => onNavigate('TODAY')}>
                    Сегодня
                </Button>
                <Button size="small" onClick={() => onNavigate('NEXT')}>
                    ▶
                </Button>
            </Stack>
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                {prefix}
                {label}
            </Typography>
            <Stack direction="row" spacing={1}>
                {(['month', 'week', 'day'] as const).map((v) => (
                    <Button
                        key={v}
                        size="small"
                        variant={view === v ? 'contained' : 'outlined'}
                        onClick={() => onView(v)}
                    >
                        {v[0].toUpperCase() + v.slice(1)}
                    </Button>
                ))}
            </Stack>
        </Box>
    );
}

function AdminTaskTable({
    items,
    onOpenProfile,
}: {
    items: AdminTask[];
    onOpenProfile: (clerkUserId?: string | null) => void;
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const tableBg = isDark ? 'rgba(10,13,20,0.92)' : '#ffffff';
    const headBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(248,250,252,0.95)';
    const cellBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
    const tableShadow = isDark ? '0 25px 70px rgba(0,0,0,0.55)' : '0 20px 50px rgba(15,23,42,0.12)';

    return (
        <TableContainer sx={{ borderRadius: UI_RADIUS.panel, boxShadow: tableShadow, bgcolor: tableBg }}>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow sx={{ '& th': { bgcolor: headBg, borderColor: cellBorder } }}>
                        <TableCell>ID</TableCell>
                        <TableCell>Задача</TableCell>
                        <TableCell>Организация</TableCell>
                        <TableCell>Проект</TableCell>
                        <TableCell>Регион / оператор</TableCell>
                        <TableCell>Автор</TableCell>
                        <TableCell>Инициатор</TableCell>
                        <TableCell>Исполнитель</TableCell>
                        <TableCell align="center">Срок</TableCell>
                        <TableCell align="center">Статус</TableCell>
                        <TableCell align="center">Приоритет</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {items.map((task) => {
                        const taskHref = getTaskHref(task);
                        const orgHref = getOrgHref(task);
                        const projectHref = getProjectHref(task);
                        const executorLabel = getExecutorLabel(task);
                        const authorLabel = getAuthorLabel(task);
                        const initiatorLabel = getInitiatorLabel(task);
                        const priority = normalizePriority(task.priority);
                        const operatorLabel = getOperatorLabel(task.projectOperator);
                        return (
                            <TableRow
                                key={task._id}
                                hover
                                sx={{
                                    '& td': { borderColor: cellBorder },
                                    '&:hover': {
                                        backgroundColor: isDark
                                            ? 'rgba(255,255,255,0.08)'
                                            : '#fffde7',
                                    },
                                }}
                            >
                                <TableCell sx={{ fontWeight: 600 }}>
                                    {taskHref ? (
                                        <Link href={taskHref}>{task.taskId}</Link>
                                    ) : (
                                        task.taskId
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Typography variant="subtitle2">
                                        {taskHref ? (
                                            <Link href={taskHref}>{task.taskName}</Link>
                                        ) : (
                                            task.taskName
                                        )}
                                    </Typography>
                                    {task.bsNumber && (
                                        <Typography variant="caption" color="text.secondary">
                                            БС: {task.bsNumber}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {orgHref ? (
                                        <Link href={orgHref}>{task.orgName || task.orgSlug || '—'}</Link>
                                    ) : (
                                        task.orgName || task.orgSlug || '—'
                                    )}
                                </TableCell>
                                <TableCell>
                                    {projectHref ? (
                                        <Link href={projectHref}>
                                            {task.projectName || task.projectKey || '—'}
                                        </Link>
                                    ) : (
                                        task.projectName || task.projectKey || '—'
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2">
                                        {getRegionLabel(task.projectRegionCode)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {operatorLabel || task.projectOperator || '—'}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    {task.authorClerkUserId ? (
                                        <Button
                                            variant="text"
                                            size="small"
                                            onClick={() => onOpenProfile(task.authorClerkUserId)}
                                            sx={{ textTransform: 'none', px: 0, minWidth: 0 }}
                                        >
                                            {authorLabel || task.authorClerkUserId}
                                        </Button>
                                    ) : (
                                        authorLabel || '—'
                                    )}
                                </TableCell>
                                <TableCell>
                                    {task.initiatorClerkUserId ? (
                                        <Button
                                            variant="text"
                                            size="small"
                                            onClick={() => onOpenProfile(task.initiatorClerkUserId)}
                                            sx={{ textTransform: 'none', px: 0, minWidth: 0 }}
                                        >
                                            {initiatorLabel || task.initiatorClerkUserId}
                                        </Button>
                                    ) : (
                                        initiatorLabel || '—'
                                    )}
                                </TableCell>
                                <TableCell>
                                    {task.executorClerkUserId ? (
                                        <Button
                                            variant="text"
                                            size="small"
                                            onClick={() => onOpenProfile(task.executorClerkUserId)}
                                            sx={{ textTransform: 'none', px: 0, minWidth: 0 }}
                                        >
                                            {executorLabel || task.executorClerkUserId}
                                        </Button>
                                    ) : (
                                        executorLabel || '—'
                                    )}
                                </TableCell>
                                <TableCell align="center">{formatDateRU(task.dueDate)}</TableCell>
                                <TableCell align="center">
                                    <Chip
                                        label={getStatusLabel(task.status)}
                                        size="small"
                                        sx={{
                                            backgroundColor: getStatusColor(task.status ?? ''),
                                            color: '#fff',
                                            fontWeight: 600,
                                        }}
                                    />
                                </TableCell>
                                <TableCell align="center">
                                    {priority ? (
                                        <Tooltip title={getPriorityLabelRu(priority)}>
                                            <Box component="span" sx={{ display: 'inline-flex' }}>
                                                {getPriorityIcon(priority, { fontSize: 18 })}
                                            </Box>
                                        </Tooltip>
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

function AdminTaskBoard({
    items,
    onOpenProfile,
}: {
    items: AdminTask[];
    onOpenProfile: (clerkUserId?: string | null) => void;
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const columnBg = isDark ? 'rgba(10,13,20,0.9)' : 'rgba(255,255,255,0.94)';
    const columnBorder = isDark ? 'rgba(255,255,255,0.08)' : 'divider';
    const columnShadow = isDark ? '0 30px 70px rgba(0,0,0,0.55)' : '0 12px 30px rgba(15,23,42,0.12)';
    const cardBg = isDark
        ? 'linear-gradient(175deg, rgba(15,18,28,0.92), rgba(20,28,45,0.9))'
        : 'linear-gradient(175deg, rgba(255,255,255,0.96), rgba(248,250,255,0.92))';
    const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const cardShadow = isDark ? '0 25px 60px rgba(0,0,0,0.55)' : '0 25px 60px rgba(15,23,42,0.15)';

    const grouped = React.useMemo(() => {
        const base: Record<string, AdminTask[]> = {};
        STATUS_ORDER.forEach((status) => {
            base[status] = [];
        });
        for (const task of items) {
            const status = normalizeStatusTitle(task.status);
            if (!base[status]) base[status] = [];
            base[status].push(task);
        }
        return base;
    }, [items]);

    return (
        <Box sx={{ display: 'flex', gap: 3, p: 3, overflowX: 'auto', minHeight: '60vh' }}>
            {STATUS_ORDER.map((status) => (
                <Box
                    key={status}
                    sx={{
                        minWidth: 280,
                        backgroundColor: columnBg,
                        p: 2,
                        borderRadius: UI_RADIUS.item,
                        border: '1px solid',
                        borderColor: columnBorder,
                        boxShadow: columnShadow,
                        backdropFilter: 'blur(12px)',
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 2, textTransform: 'none' }}>
                        {getStatusLabel(status)} ({grouped[status]?.length || 0})
                    </Typography>
                    {(grouped[status] || []).map((task) => {
                        const taskHref = getTaskHref(task);
                        const executorLabel = getExecutorLabel(task);
                        const regionLabel = getRegionLabel(task.projectRegionCode);
                        const operatorLabel = getOperatorLabel(task.projectOperator) || task.projectOperator;
                        return (
                            <Paper
                                key={task._id}
                                component={taskHref ? Link : 'div'}
                                href={taskHref ?? undefined}
                                sx={{
                                    mb: 2,
                                    p: 2,
                                    cursor: taskHref ? 'pointer' : 'default',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    background: cardBg,
                                    border: `1px solid ${cardBorder}`,
                                    boxShadow: cardShadow,
                                    '&:hover': taskHref
                                        ? { transform: 'translateY(-1px)', transition: '150ms ease' }
                                        : undefined,
                                }}
                            >
                                <Typography variant="caption" color="text.secondary">
                                    {task.taskId} • {formatDateRU(task.createdAt)}
                                </Typography>
                                <Typography variant="subtitle1" sx={{ mt: 0.5 }}>
                                    {task.taskName}
                                </Typography>
                                <Typography variant="body2">БС: {task.bsNumber || '—'}</Typography>
                                <Typography variant="body2">
                                    {task.orgName || task.orgSlug || '—'} •{' '}
                                    {task.projectName || task.projectKey || '—'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {regionLabel}
                                    {operatorLabel ? ` • ${operatorLabel}` : ''}
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                                    <Chip
                                        label={getStatusLabel(status)}
                                        size="small"
                                        sx={{
                                            backgroundColor: getStatusColor(status),
                                            color: '#fff',
                                        }}
                                    />
                                    {executorLabel ? (
                                        <Chip
                                            label={executorLabel}
                                            size="small"
                                            variant="outlined"
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                onOpenProfile(task.executorClerkUserId);
                                            }}
                                        />
                                    ) : (
                                        <Chip label="Исполнитель: —" size="small" variant="outlined" />
                                    )}
                                </Stack>
                            </Paper>
                        );
                    })}
                </Box>
            ))}
        </Box>
    );
}

function AdminTaskCalendar({ items }: { items: AdminTask[] }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const calendarBg = isDark ? 'rgba(10,13,20,0.92)' : '#fff';
    const calendarBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const toolbarBg = isDark ? 'rgba(21,28,44,0.85)' : 'rgba(248,250,252,0.92)';
    const slotBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)';
    const offRangeBg = isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc';
    const todayBg = isDark ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.12)';

    const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
    const [view, setView] = React.useState<'month' | 'week' | 'day'>('month');

    const events = React.useMemo<CalendarEvent[]>(() => {
        return items
            .filter((task) => task.dueDate)
            .map((task) => ({
                id: task._id,
                title: `${task.taskName} | ${task.bsNumber || ''}`,
                start: new Date(task.dueDate as string),
                end: addHours(new Date(task.dueDate as string), 1),
                resource: { priority: task.priority, status: task.status, id: task._id },
            }));
    }, [items]);

    const components = React.useMemo(
        () => ({
            toolbar: CalendarToolbar,
        }),
        []
    );

    return (
        <Box
            sx={{
                height: 'calc(100vh - 260px)',
                '& .rbc-calendar': {
                    backgroundColor: calendarBg,
                    borderRadius: UI_RADIUS.tooltip,
                    border: `1px solid ${calendarBorder}`,
                    boxShadow: isDark
                        ? '0 30px 80px rgba(0,0,0,0.55)'
                        : '0 20px 50px rgba(15,23,42,0.15)',
                    overflow: 'hidden',
                    color: theme.palette.text.primary,
                },
                '& .rbc-toolbar': {
                    backgroundColor: toolbarBg,
                    borderBottom: `1px solid ${calendarBorder}`,
                },
                '& .rbc-header': {
                    backgroundColor: isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(248,250,252,0.9)',
                    color: theme.palette.text.primary,
                    borderColor: slotBorder,
                },
                '& .rbc-time-slot, & .rbc-day-bg': {
                    borderColor: slotBorder,
                },
                '& .rbc-off-range-bg': {
                    backgroundColor: offRangeBg,
                },
                '& .rbc-today': {
                    backgroundColor: todayBg,
                },
                '& .rbc-month-view, & .rbc-time-view, & .rbc-agenda-view': {
                    color: theme.palette.text.primary,
                },
                '& .rbc-event': {
                    borderRadius: UI_RADIUS.panel,
                    boxShadow: isDark
                        ? '0 10px 25px rgba(0,0,0,0.35)'
                        : '0 10px 25px rgba(15,23,42,0.15)',
                    border: 'none',
                },
            }}
        >
            <Calendar
                localizer={localizer}
                events={events}
                date={currentDate}
                view={view}
                onNavigate={setCurrentDate}
                onView={(v) => setView(v as 'month' | 'week' | 'day')}
                components={components as CalendarProps<CalendarEvent>['components']}
                views={{ month: true, week: true, day: true }}
                popup
                style={{ height: '100%' }}
                eventPropGetter={(ev) => {
                    const st = ((ev.resource?.status || 'TO DO') as string).toUpperCase();
                    return {
                        style: {
                            backgroundColor: statusBg[st] ?? '#9e9e9e',
                            color: '#fff',
                            fontSize: '0.75rem',
                            lineHeight: 1.15,
                        },
                    };
                }}
                onSelectEvent={(ev) => {
                    const id = ev.resource?.id;
                    if (!id) return;
                    const task = items.find((item) => item._id === id);
                    const href = task ? getTaskHref(task) : null;
                    if (href) {
                        window.location.href = href;
                    }
                }}
            />
        </Box>
    );
}

export default function AdminTasksPage() {
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
    const tabActiveBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
    const tabInactiveColor = isDarkMode ? 'rgba(226,232,240,0.65)' : 'rgba(15,23,42,0.55)';
    const tabBorderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';

    const [tab, setTab] = React.useState<'list' | 'board' | 'calendar'>('list');
    const [q, setQ] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [items, setItems] = React.useState<AdminTask[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const [searchAnchor, setSearchAnchor] = React.useState<HTMLElement | null>(null);
    const [filterDialogOpen, setFilterDialogOpen] = React.useState(false);
    const [filters, setFilters] = React.useState<AdminTaskFilters>(defaultFilters);
    const [profileUserId, setProfileUserId] = React.useState<string | null>(null);
    const [profileOpen, setProfileOpen] = React.useState(false);

    const load = React.useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/admin/tasks', { cache: 'no-store' });
            const payload = (await res.json().catch(() => null)) as
                | { tasks?: AdminTask[]; error?: string }
                | null;
            if (!res.ok || !payload?.tasks) {
                setError(payload?.error || `Не удалось загрузить задачи (${res.status})`);
                setItems([]);
                return;
            }
            setItems(payload.tasks);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Ошибка загрузки задач');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void load();
    }, [load]);

    const orgOptions = React.useMemo<OrgOption[]>(() => {
        const map = new Map<string, OrgOption>();
        items.forEach((task) => {
            if (!task.orgId) return;
            const label = task.orgName || task.orgSlug || task.orgId;
            if (!map.has(task.orgId)) {
                map.set(task.orgId, { id: task.orgId, label, slug: task.orgSlug });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [items]);

    const projectOptions = React.useMemo<ProjectOption[]>(() => {
        const map = new Map<string, ProjectOption>();
        items.forEach((task) => {
            if (!task.projectId) return;
            const label = task.projectName || task.projectKey || task.projectId;
            if (!map.has(task.projectId)) {
                map.set(task.projectId, {
                    id: task.projectId,
                    label,
                    key: task.projectKey,
                    orgId: task.orgId,
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [items]);

    const regionOptions = React.useMemo<RegionOption[]>(() => {
        const codes = Array.from(
            new Set(items.map((task) => task.projectRegionCode).filter(Boolean))
        ) as string[];
        return codes
            .map((code) => ({ code, label: getRegionLabel(code) }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [items]);

    const operatorOptions = React.useMemo<OperatorOption[]>(() => {
        const codes = Array.from(
            new Set(items.map((task) => task.projectOperator).filter(Boolean))
        ) as string[];
        return codes
            .map((code) => ({ code, label: getOperatorLabel(code) || code }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [items]);

    const filterOptions = React.useMemo(() => {
        const executors = new Set<string>();
        const statuses = new Set<(typeof STATUS_ORDER)[number]>();
        const priorities = new Set<Priority | string>();
        items.forEach((task) => {
            const executorLabel = getExecutorLabel(task);
            if (executorLabel) executors.add(executorLabel);
            if (task.status) statuses.add(normalizeStatusTitle(task.status));
            if (task.priority) priorities.add(task.priority);
        });

        const orderedStatuses = STATUS_ORDER.filter((status) => statuses.has(status));
        const remainingStatuses = Array.from(statuses).filter(
            (status) => !STATUS_ORDER.includes(status)
        );

        return {
            executors: Array.from(executors).sort((a, b) => a.localeCompare(b)),
            statuses: [...orderedStatuses, ...remainingStatuses],
            priorities: Array.from(priorities).sort(),
        };
    }, [items]);

    const filteredItems = React.useMemo(() => {
        const normalizedSearch = q.trim().toLowerCase();
        return items.filter((task) => {
            if (filters.orgId && task.orgId !== filters.orgId) return false;
            if (filters.projectId && task.projectId !== filters.projectId) return false;
            if (filters.regionCode && task.projectRegionCode !== filters.regionCode) return false;
            if (filters.operatorCode && task.projectOperator !== filters.operatorCode) return false;
            if (filters.status && normalizeStatusTitle(task.status) !== filters.status) return false;
            if (filters.priority && task.priority !== filters.priority) return false;
            if (filters.executor) {
                const label = getExecutorLabel(task);
                if (!label || label !== filters.executor) return false;
            }

            if (filters.dueFrom || filters.dueTo) {
                if (!task.dueDate) return false;
                const dueDate = new Date(task.dueDate);
                if (Number.isNaN(dueDate.getTime())) return false;
                if (filters.dueFrom && dueDate < startOfDay(filters.dueFrom)) return false;
                if (filters.dueTo && dueDate > endOfDay(filters.dueTo)) return false;
            }

            if (normalizedSearch) {
                const haystack = [
                    task.taskId,
                    task.taskName,
                    task.bsNumber,
                    task.orgName,
                    task.orgSlug,
                    task.projectName,
                    task.projectKey,
                    task.projectRegionCode,
                    getRegionLabel(task.projectRegionCode),
                    task.projectOperator,
                    getOperatorLabel(task.projectOperator),
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(normalizedSearch)) return false;
            }

            return true;
        });
    }, [filters, items, q]);

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
    };

    const handleFilterClose = () => {
        setFilterDialogOpen(false);
    };

    const handleFilterReset = () => {
        setFilters(defaultFilters);
    };

    const hasActiveFilters = Boolean(
        filters.orgId ||
            filters.projectId ||
            filters.regionCode ||
            filters.operatorCode ||
            filters.executor ||
            filters.status ||
            filters.priority ||
            filters.dueFrom ||
            filters.dueTo
    );

    const activeFilterCount =
        Number(Boolean(filters.orgId)) +
        Number(Boolean(filters.projectId)) +
        Number(Boolean(filters.regionCode)) +
        Number(Boolean(filters.operatorCode)) +
        Number(Boolean(filters.executor)) +
        Number(Boolean(filters.status)) +
        Number(Boolean(filters.priority)) +
        Number(Boolean(filters.dueFrom)) +
        Number(Boolean(filters.dueTo));

    const filterChips = React.useMemo(() => {
        const chips: Array<{ key: keyof AdminTaskFilters; label: string }> = [];
        const orgLabel = orgOptions.find((option) => option.id === filters.orgId)?.label;
        const projectLabel = projectOptions.find((option) => option.id === filters.projectId)?.label;
        const regionLabel = regionOptions.find((option) => option.code === filters.regionCode)?.label;
        const operatorLabel = operatorOptions.find(
            (option) => option.code === filters.operatorCode
        )?.label;

        if (filters.orgId) chips.push({ key: 'orgId', label: `Организация: ${orgLabel || filters.orgId}` });
        if (filters.projectId) chips.push({ key: 'projectId', label: `Проект: ${projectLabel || filters.projectId}` });
        if (filters.regionCode) chips.push({ key: 'regionCode', label: `Регион: ${regionLabel || filters.regionCode}` });
        if (filters.operatorCode) chips.push({ key: 'operatorCode', label: `Оператор: ${operatorLabel || filters.operatorCode}` });
        if (filters.executor) chips.push({ key: 'executor', label: `Исполнитель: ${filters.executor}` });
        if (filters.status) chips.push({ key: 'status', label: `Статус: ${getStatusLabel(filters.status)}` });
        if (filters.priority) chips.push({ key: 'priority', label: `Приоритет: ${getPriorityLabelRu(filters.priority as Priority)}` });
        if (filters.dueFrom) chips.push({ key: 'dueFrom', label: `Срок от: ${format(filters.dueFrom, 'dd.MM.yyyy')}` });
        if (filters.dueTo) chips.push({ key: 'dueTo', label: `Срок до: ${format(filters.dueTo, 'dd.MM.yyyy')}` });
        return chips;
    }, [filters, operatorOptions, orgOptions, projectOptions, regionOptions]);

    const handleRemoveFilter = (key: keyof AdminTaskFilters) => {
        setFilters((prev) => ({ ...prev, [key]: defaultFilters[key] }));
    };

    const openProfileDialog = (clerkUserId?: string | null) => {
        if (!clerkUserId) return;
        setProfileUserId(clerkUserId);
        setProfileOpen(true);
    };

    const closeProfileDialog = () => {
        setProfileOpen(false);
        setProfileUserId(null);
    };

    const orgCount = orgOptions.length;
    const projectCount = projectOptions.length;
    const regionCount = regionOptions.length;

    return (
        <Box
            sx={{
                minHeight: '100%',
                py: { xs: 4, md: 6 },
                px: { xs: 0.25, md: 6 },
            }}
        >
            <Box sx={{ maxWidth: 1320, mx: 'auto', width: '100%' }}>
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
                            <Typography
                                variant="h5"
                                fontWeight={700}
                                color={textPrimary}
                                sx={{ fontSize: { xs: '1.6rem', md: '1.95rem' } }}
                            >
                                Все задачи организаций
                            </Typography>
                            <Typography
                                variant="body2"
                                color={textSecondary}
                                sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, mt: 0.5 }}
                            >
                                {loading
                                    ? 'Загружаем задачи...'
                                    : `Всего задач: ${items.length}. Организаций: ${orgCount}. Проектов: ${projectCount}. Регионов: ${regionCount}.`}
                            </Typography>
                            {error && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                                    {error}
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
                                    sx={{
                                        borderRadius: UI_RADIUS.overlay,
                                        border: `1px solid ${iconBorderColor}`,
                                        backgroundColor: searchAnchor || q ? iconActiveBg : iconBg,
                                        color: searchAnchor || q ? iconActiveText : iconText,
                                        boxShadow: iconShadow,
                                        backdropFilter: 'blur(14px)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            backgroundColor: searchAnchor || q ? iconActiveBg : iconHoverBg,
                                        },
                                    }}
                                >
                                    <SearchIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Фильтры задач">
                                <IconButton
                                    onClick={() => setFilterDialogOpen(true)}
                                    sx={{
                                        borderRadius: UI_RADIUS.overlay,
                                        border: `1px solid ${iconBorderColor}`,
                                        color: filterDialogOpen || hasActiveFilters ? iconActiveText : iconText,
                                        backgroundColor: filterDialogOpen || hasActiveFilters ? iconActiveBg : iconBg,
                                        boxShadow: iconShadow,
                                        backdropFilter: 'blur(14px)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            backgroundColor:
                                                filterDialogOpen || hasActiveFilters ? iconActiveBg : iconHoverBg,
                                        },
                                    }}
                                >
                                    <FilterListIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Обновить">
                                <span>
                                    <IconButton
                                        onClick={() => void load()}
                                        disabled={loading}
                                        sx={{
                                            borderRadius: UI_RADIUS.overlay,
                                            border: `1px solid ${iconBorderColor}`,
                                            backgroundColor: iconBg,
                                            color: iconText,
                                            boxShadow: iconShadow,
                                            backdropFilter: 'blur(14px)',
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                backgroundColor: iconHoverBg,
                                            },
                                        }}
                                    >
                                        <RefreshIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Stack>
                    </Stack>
                </Box>

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
                    <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <Stack spacing={2}>
                                <Autocomplete
                                    options={orgOptions}
                                    value={
                                        orgOptions.find((option) => option.id === filters.orgId) ?? null
                                    }
                                    onChange={(_event, value) =>
                                        setFilters((prev) => ({ ...prev, orgId: value?.id ?? '' }))
                                    }
                                    getOptionLabel={(option) => option.label}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Организация" size="small" />
                                    )}
                                    clearOnEscape
                                    handleHomeEndKeys
                                />
                                <Autocomplete
                                    options={projectOptions}
                                    value={
                                        projectOptions.find(
                                            (option) => option.id === filters.projectId
                                        ) ?? null
                                    }
                                    onChange={(_event, value) =>
                                        setFilters((prev) => ({ ...prev, projectId: value?.id ?? '' }))
                                    }
                                    getOptionLabel={(option) => option.label}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Проект" size="small" />
                                    )}
                                    clearOnEscape
                                    handleHomeEndKeys
                                />
                                <Autocomplete
                                    options={regionOptions}
                                    value={
                                        regionOptions.find(
                                            (option) => option.code === filters.regionCode
                                        ) ?? null
                                    }
                                    onChange={(_event, value) =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            regionCode: value?.code ?? '',
                                        }))
                                    }
                                    getOptionLabel={(option) => option.label}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Регион" size="small" />
                                    )}
                                    clearOnEscape
                                    handleHomeEndKeys
                                />
                                <Autocomplete
                                    options={operatorOptions}
                                    value={
                                        operatorOptions.find(
                                            (option) => option.code === filters.operatorCode
                                        ) ?? null
                                    }
                                    onChange={(_event, value) =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            operatorCode: value?.code ?? '',
                                        }))
                                    }
                                    getOptionLabel={(option) => option.label}
                                    renderInput={(params) => (
                                        <TextField {...params} label="Оператор" size="small" />
                                    )}
                                    clearOnEscape
                                    handleHomeEndKeys
                                />
                                <Autocomplete
                                    options={filterOptions.executors}
                                    value={filters.executor || null}
                                    onChange={(_event, value) =>
                                        setFilters((prev) => ({ ...prev, executor: value ?? '' }))
                                    }
                                    renderInput={(params) => (
                                        <TextField {...params} label="Исполнитель" size="small" />
                                    )}
                                    clearOnEscape
                                    handleHomeEndKeys
                                />
                                <FormControl fullWidth size="small">
                                    <InputLabel>Статус</InputLabel>
                                    <Select
                                        label="Статус"
                                        value={filters.status}
                                        onChange={(event) =>
                                            setFilters((prev) => ({
                                                ...prev,
                                                status: event.target.value,
                                            }))
                                        }
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
                                        onChange={(event) =>
                                            setFilters((prev) => ({
                                                ...prev,
                                                priority: event.target.value,
                                            }))
                                        }
                                    >
                                        <MenuItem value="">
                                            <em>Все</em>
                                        </MenuItem>
                                        {filterOptions.priorities.map((priority) => (
                                            <MenuItem key={priority} value={priority}>
                                                {getPriorityLabelRu(priority as Priority)}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <Stack direction="row" spacing={1}>
                                    <DatePicker
                                        label="Срок от"
                                        value={filters.dueFrom}
                                        onChange={(value) =>
                                            setFilters((prev) => ({ ...prev, dueFrom: value }))
                                        }
                                        slotProps={{ textField: { size: 'small' } }}
                                    />
                                    <DatePicker
                                        label="Срок до"
                                        value={filters.dueTo}
                                        onChange={(value) =>
                                            setFilters((prev) => ({ ...prev, dueTo: value }))
                                        }
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
                            backgroundColor: isDarkMode
                                ? 'rgba(15,18,28,0.65)'
                                : 'rgba(255,255,255,0.7)',
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

                    {loading ? (
                        <Box sx={{ p: 3 }}>
                            <Typography color="text.secondary">Загрузка…</Typography>
                        </Box>
                    ) : filteredItems.length === 0 ? (
                        <Box sx={{ p: 3 }}>
                            <Typography color="text.secondary">Задачи не найдены.</Typography>
                        </Box>
                    ) : (
                        <>
                            {tab === 'list' && (
                                <AdminTaskTable
                                    items={filteredItems}
                                    onOpenProfile={openProfileDialog}
                                />
                            )}
                            {tab === 'board' && (
                                <AdminTaskBoard
                                    items={filteredItems}
                                    onOpenProfile={openProfileDialog}
                                />
                            )}
                            {tab === 'calendar' && <AdminTaskCalendar items={filteredItems} />}
                        </>
                    )}
                </Paper>
            </Box>

            <Dialog open={Boolean(searchAnchor)} onClose={handleSearchClose}>
                <DialogTitle sx={{ pr: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Typography variant="h6" fontWeight={600}>
                            Поиск
                        </Typography>
                        <IconButton onClick={handleSearchClose}>
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <TextField
                        label="Поиск (ID, название, организация, проект)"
                        value={q}
                        onChange={(event) => setQ(event.target.value)}
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
                                    <IconButton size="small" onClick={handleSearchReset} edge="end">
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                    />
                </DialogContent>
            </Dialog>

            <ProfileDialog
                open={profileOpen}
                onClose={closeProfileDialog}
                clerkUserId={profileUserId}
            />
        </Box>
    );
}
