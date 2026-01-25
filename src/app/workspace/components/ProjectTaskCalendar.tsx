// app/workspace/components/ProjectTaskCalendar.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
    Box,
    Typography,
    Alert,
    ButtonGroup,
    Button,
} from '@mui/material';

import {
    format,
    parse,
    startOfWeek,
    getDay,
    addHours,
    getISOWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    dateFnsLocalizer,
    type CalendarProps,
    type Event as RBCEvent,
} from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useTheme } from '@mui/material/styles';
import ArrowBackIos from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIos from '@mui/icons-material/ArrowForwardIos';
import Today from '@mui/icons-material/Today';
import { UI_RADIUS } from '@/config/uiTokens';
import { useI18n } from '@/i18n/I18nProvider';
import { normalizeStatusTitle } from '@/utils/statusLabels';

// Типы
type Status = 'TO DO' | 'IN PROGRESS' | 'DONE';
type Priority = 'urgent' | 'high' | 'medium' | 'low';
type ViewType = 'month' | 'week' | 'day';

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    taskType?: 'installation' | 'document';
    bsNumber?: string;
    bsAddress?: string;
    projectKey?: string;
    totalCost?: number;
    createdAt?: string;
    dueDate?: string;
    status?: Status | string;
    priority?: Priority | string;
};

type CalendarEvent = RBCEvent<{
    priority?: Priority | string;
    status?: Status | string;
    id: string;
    taskType?: 'installation' | 'document';
}>;

const statusBg: Record<Status, string> = {
    'TO DO': '#9e9e9e',
    'IN PROGRESS': '#0288d1',
    'DONE': '#2e7d32',
};

// Динамический импорт Calendar
const Calendar = dynamic(
    () =>
        import('react-big-calendar').then(
            (m) => m.Calendar as unknown as React.ComponentType<CalendarProps<CalendarEvent>>
        ),
    { ssr: false }
);

// Localizer
const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales: { ru },
});

// Кастомный Toolbar
type ToolbarProps = {
    label: string;
    view: ViewType | string;
    date: Date;
    onNavigate: (a: 'PREV' | 'NEXT' | 'TODAY' | 'DATE') => void;
    onView: (v: ViewType | string) => void;
};

function Toolbar({ label, view, date, onNavigate, onView }: ToolbarProps) {
    const prefix = view === 'week' ? `W${getISOWeek(date)} — ` : '';
    return (
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between' }}>
            <ButtonGroup size="small">
                <Button onClick={() => onNavigate('PREV')}>
                    <ArrowBackIos fontSize="inherit" />
                </Button>
                <Button onClick={() => onNavigate('TODAY')}>
                    <Today fontSize="inherit" />
                </Button>
                <Button onClick={() => onNavigate('NEXT')}>
                    <ArrowForwardIos fontSize="inherit" />
                </Button>
            </ButtonGroup>

            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                {prefix}
                {label}
            </Typography>

            <ButtonGroup size="small">
                {(['month', 'week', 'day'] as ViewType[]).map((v) => (
                    <Button
                        key={v}
                        variant={view === v ? 'contained' : 'outlined'}
                        onClick={() => onView(v)}
                    >
                        {v[0].toUpperCase() + v.slice(1)}
                    </Button>
                ))}
            </ButtonGroup>
        </Box>
    );
}

// Компонент
export default function ProjectTaskCalendar({
                                                items,
                                                loading,
                                                error,
                                                org,
                                                project,
                                                onReloadAction,
                                            }: {
    items: Task[];
    loading: boolean;
    error: string | null;
    org?: string;
    project?: string;
    onReloadAction?: () => void;
}) {
    const { t } = useI18n();
    const router = useRouter();
    void onReloadAction;
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const calendarBg = isDark ? 'rgba(10,13,20,0.92)' : '#fff';
    const calendarBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const toolbarBg = isDark ? 'rgba(21,28,44,0.85)' : 'rgba(248,250,252,0.92)';
    const slotBorder = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)';
    const offRangeBg = isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc';
    const todayBg = isDark ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.12)';

    const openTaskPage = (task: Task) => {
        if (!org || !project) return;
        const slug = task.taskId;
        const projectRef = task.projectKey || project;
        router.push(
            `/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(projectRef)}/tasks/${encodeURIComponent(slug)}`
        );
    };

    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [view, setView] = useState<ViewType>('month');

    const events = useMemo<CalendarEvent[]>(() => {
        return items
            .filter((t) => t.dueDate)
            .map((t) => ({
                id: t._id,
                title: `${t.taskName} | ${t.bsNumber || ''}`,
                start: new Date(t.dueDate as string),
                end: addHours(new Date(t.dueDate as string), 1),
                resource: { priority: t.priority, status: t.status, id: t._id, taskType: t.taskType },
            }));
    }, [items]);

    const resolveDocumentStatusHint = (status?: string) => {
        const normalized = normalizeStatusTitle(status);
        switch (normalized) {
            case 'Assigned':
                return t('task.document.status.assigned', 'Назначена проектировщику');
            case 'At work':
                return t('task.document.status.atWork', 'Подготовка документации в работе');
            case 'Pending':
                return t('task.document.status.pending', 'PDF переданы на согласование');
            case 'Issues':
                return t('task.document.status.issues', 'Есть замечания, ждём исправления');
            case 'Fixed':
                return t('task.document.status.fixed', 'Исправления переданы на проверку');
            case 'Agreed':
                return t('task.document.status.agreed', 'Документация согласована');
            case 'Done':
                return t('task.document.status.done', 'Задача завершена');
            case 'To do':
            default:
                return t('task.document.status.todo', 'Ожидает начала работ');
        }
    };

    if (loading) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">{t('common.loading', 'Загрузка…')}</Typography>
            </Box>
        );
    }
    if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;

    const calendarComponents = {
        toolbar: Toolbar,
    } as unknown as CalendarProps<CalendarEvent>['components'];

    return (
        <Box
            sx={{
                height: 'calc(100vh - 260px)',
                '& .rbc-calendar': {
                    backgroundColor: calendarBg,
                    borderRadius: UI_RADIUS.tooltip,
                    border: `1px solid ${calendarBorder}`,
                    boxShadow: isDark ? '0 30px 80px rgba(0,0,0,0.55)' : '0 20px 50px rgba(15,23,42,0.15)',
                    overflow: 'hidden',
                    color: theme.palette.text.primary,
                },
                '& .rbc-toolbar': {
                    backgroundColor: toolbarBg,
                    borderBottom: `1px solid ${calendarBorder}`,
                },
                '& .rbc-header': {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(248,250,252,0.9)',
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
                    boxShadow: isDark ? '0 10px 25px rgba(0,0,0,0.35)' : '0 10px 25px rgba(15,23,42,0.15)',
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
                onView={(v) => setView(v as ViewType)}
                components={calendarComponents}
                tooltipAccessor={(ev) => {
                    if (ev.resource?.taskType === 'document') {
                        return resolveDocumentStatusHint(String(ev.resource?.status || ''));
                    }
                    return ev.title;
                }}
                views={{ month: true, week: true, day: true }}
                popup
                style={{ height: '100%' }}
                eventPropGetter={(ev) => {
                    const st = ((ev.resource?.status || 'TO DO') as string).toUpperCase() as Status;
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
                    const t = items.find((x) => x._id === id);
                    if (t) {
                        openTaskPage(t);
                    }
                }}
            />
        </Box>
    );
}
