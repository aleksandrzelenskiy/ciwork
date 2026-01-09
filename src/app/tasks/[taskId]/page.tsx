// app/tasks/[taskId]/page.tsx

'use client';

import React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Link,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Container,
    type PaperProps,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import TocOutlinedIcon from '@mui/icons-material/TocOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import HistoryIcon from '@mui/icons-material/History';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import {
    Timeline,
    TimelineConnector,
    TimelineContent,
    TimelineDot,
    TimelineItem,
    TimelineOppositeContent,
    TimelineSeparator,
} from '@mui/lab';
import Masonry from '@mui/lab/Masonry';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { getPriorityIcon, normalizePriority } from '@/utils/priorityIcons';
import TaskGeoLocation from '@/app/workspace/components/TaskGeoLocation';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel, normalizeStatusTitle } from '@/utils/statusLabels';
import TaskComments, { type TaskComment } from '@/features/tasks/TaskComments';
import PhotoReportUploader from '@/features/tasks/PhotoReportUploader';
import ReportSummaryList from '@/features/reports/ReportSummaryList';
import { fetchUserContext } from '@/app/utils/userContext';
import type { Task, WorkItem, TaskEvent } from '@/app/types/taskTypes';
import { extractFileNameFromUrl, isDocumentUrl } from '@/utils/taskFiles';
import { normalizeRelatedTasks } from '@/app/utils/relatedTasks';
import { usePhotoReports } from '@/hooks/usePhotoReports';
import { UI_RADIUS } from '@/config/uiTokens';
import { getOrgPageStyles } from '@/app/org/(protected)/[org]/styles';

const parseUserInfo = (userString?: string) => {
    if (!userString) return { name: 'N/A', email: 'N/A' };
    const cleanedString = userString.replace(/\)$/, '');
    const parts = cleanedString.split(' (');
    return { name: parts[0] || 'N/A', email: parts[1] || 'N/A' };
};

export default function TaskDetailPage() {
    const params = useParams<{ taskId: string }>();
    const taskId = params?.taskId?.trim() || '';
    const router = useRouter();
    const searchParams = useSearchParams();
    const theme = useTheme();
    const {
        masonryCardSx,
        iconBorderColor,
        iconBg,
        iconHoverBg,
        iconShadow,
        textPrimary,
        disabledIconColor,
    } = getOrgPageStyles(theme);
    const isDarkMode = theme.palette.mode === 'dark';
    const iconText = textPrimary;
    const iconActiveBg = isDarkMode ? 'rgba(59,130,246,0.4)' : 'rgba(15,23,42,0.9)';
    const iconActiveText = '#ffffff';
    const getIconButtonSx = (
        options?: { active?: boolean; disabled?: boolean; activeColor?: string; activeBg?: string }
    ) => {
        const active = options?.active ?? false;
        const disabled = options?.disabled ?? false;
        return {
            borderRadius: UI_RADIUS.overlay,
            border: `1px solid ${disabled ? 'transparent' : iconBorderColor}`,
            backgroundColor: disabled
                ? 'transparent'
                : active
                    ? options?.activeBg ?? iconActiveBg
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
                        ? options?.activeBg ?? iconActiveBg
                        : iconHoverBg,
            },
        };
    };
    const cardPadding = React.useMemo(() => ({ xs: 2, md: 2.5 }), []);
    const accordionSx = {
        backgroundColor: 'transparent',
        '&:before': { display: 'none' },
    } as const;
    const accordionSummarySx = {
        px: 0,
        '& .MuiAccordionSummary-content': { m: 0 },
    } as const;
    const accordionDetailsSx = { pt: 0, px: 0 } as const;
    const CardItem = React.useMemo(() => {
        const Component = React.forwardRef<HTMLDivElement, PaperProps>(({ sx, ...rest }, ref) => (
            <Paper ref={ref} {...rest} sx={{ ...masonryCardSx, p: cardPadding, minWidth: 0, ...sx }} />
        ));
        Component.displayName = 'CardItem';
        return Component;
    }, [cardPadding, masonryCardSx]);

    const pageGutter = { xs: 1, sm: 2.5, md: 3, lg: 3.5, xl: 4 };
    const masonrySpacing = { xs: 0.5, sm: 1.5, md: 2 } as const;

    const [task, setTask] = React.useState<Task | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = React.useState<string>('');
    const [profileType, setProfileType] = React.useState<'employer' | 'contractor' | undefined>(undefined);
    const [workItemsFullScreen, setWorkItemsFullScreen] = React.useState(false);
    const [commentsFullScreen, setCommentsFullScreen] = React.useState(false);
    const [pendingDecision, setPendingDecision] = React.useState<'accept' | 'reject' | null>(null);
    const [decisionLoading, setDecisionLoading] = React.useState(false);
    const [decisionError, setDecisionError] = React.useState<string | null>(null);
    const [completeConfirmOpen, setCompleteConfirmOpen] = React.useState(false);
    const [completeLoading, setCompleteLoading] = React.useState(false);
    const [completeError, setCompleteError] = React.useState<string | null>(null);
    const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);
    const [photoGuideOpen, setPhotoGuideOpen] = React.useState(false);
    const [issuesGuideOpen, setIssuesGuideOpen] = React.useState(false);
    const [issuesGuideRect, setIssuesGuideRect] = React.useState<DOMRect | null>(null);
    const [uploadButtonRect, setUploadButtonRect] = React.useState<DOMRect | null>(null);
    const uploadButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const issuesSectionRef = React.useRef<HTMLDivElement | null>(null);
    const hasOpenedIssuesGuide = React.useRef(false);

    const handleCompleteClick = React.useCallback(() => {
        setCompleteError(null);
        setCompleteConfirmOpen(true);
    }, []);

    const formatDate = (v?: string | Date) => {
        if (!v) return '—';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    };

    const formatDateTime = (v?: string | Date) => {
        if (!v) return '—';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v);
        return d.toLocaleString('ru-RU');
    };

    const formatRuble = (value?: number) => {
        if (typeof value !== 'number') return '—';
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value) + ' ₽';
    };

    const renderCost = () => {
        if (typeof task?.contractorPayment !== 'number') return '—';
        return formatRuble(task.contractorPayment);
    };

    const bsNumberDisplay = React.useMemo(() => {
        const names =
            task?.bsLocation
                ?.map((loc) => (loc?.name || '').trim())
                .filter(Boolean) ?? [];
        if (names.length === 1) return names[0];
        if (names.length === 2) return `${names[0]}-${names[1]}`;
        if (names.length > 2) return names.join(', ');
        return task?.bsNumber || '—';
    }, [task?.bsLocation, task?.bsNumber]);

    const asText = (x: unknown): string => {
        if (x === null || typeof x === 'undefined') return '—';
        if (typeof x === 'string') {
            const d = new Date(x);
            if (!Number.isNaN(d.getTime())) return d.toLocaleString('ru-RU');
        }
        return String(x);
    };

    const loadTask = React.useCallback(async () => {
        if (!taskId) return;
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
                cache: 'no-store',
            });
            const data = (await res.json()) as { task?: Task; error?: string };
            if (!res.ok || !data.task) {
                setError(data.error || `Не удалось загрузить задачу (${res.status})`);
                setTask(null);
            } else {
                setTask(data.task);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Network error');
            setTask(null);
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    React.useEffect(() => {
        const fetchUserRole = async () => {
            try {
                const ctx = await fetchUserContext();
                const clerkId =
                    (ctx?.user as { clerkUserId?: string; id?: string } | undefined)?.clerkUserId ||
                    (ctx?.user as { id?: string } | undefined)?.id ||
                    '';
                setCurrentUserId(clerkId);
                setProfileType(ctx?.profileType);
            } catch {
                setProfileType('contractor');
            }
        };
        void fetchUserRole();
    }, []);

    React.useEffect(() => {
        void loadTask();
    }, [loadTask]);

    const hasWorkItems = Array.isArray(task?.workItems) && task.workItems.length > 0;
    const attachmentLinks = React.useMemo(
        () => (Array.isArray(task?.attachments) ? task.attachments.filter((url) => !isDocumentUrl(url)) : []),
        [task]
    );

    const hasAttachmentBlock = attachmentLinks.length > 0;
    const relatedTasks = React.useMemo(
        () => normalizeRelatedTasks(task?.relatedTasks),
        [task?.relatedTasks]
    );
    const reportTaskId = (task?.taskId || taskId).trim();
    const issueReports = React.useMemo(() => {
        if (!Array.isArray(task?.photoReports)) return [];
        return task.photoReports
            .map((report) => {
                const issues = Array.isArray(report?.issues)
                    ? report.issues.map((issue) => issue.trim()).filter(Boolean)
                    : [];
                return { ...report, issues };
            })
            .filter((report) => report.issues.length > 0)
            .sort((a, b) => {
                const da = new Date(a.createdAt).getTime();
                const db = new Date(b.createdAt).getTime();
                return db - da;
            });
    }, [task?.photoReports]);

    const sortedEvents = React.useMemo(() => {
        if (!task?.events) return [];
        return [...task.events].sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            return db - da;
        });
    }, [task?.events]);

    const getEventTitle = (action: string) => {
        if (action === 'TASK_CREATED') return 'Задача создана';
        if (action === 'STATUS_CHANGED') return 'Статус изменен';
        return action;
    };

    const renderEventDetails = (ev: TaskEvent) => {
        if (ev.action === 'STATUS_CHANGED' && ev.details) {
            const oldStatus = 'oldStatus' in ev.details ? ev.details.oldStatus : undefined;
            const newStatus = 'newStatus' in ev.details ? ev.details.newStatus : undefined;
            return (
                <Typography variant="caption" display="block">
                    {oldStatus ? `Статус: ${oldStatus}` : 'Статус'} → {asText(newStatus)}
                </Typography>
            );
        }

        if (ev.details?.comment) {
            return (
                <Typography variant="caption" display="block">
                    {ev.details.comment}
                </Typography>
            );
        }

        return null;
    };

    const getEventAuthorLine = (ev: TaskEvent): string => {
        const parsed = parseUserInfo(ev.author);
        if (parsed.email && parsed.email !== 'N/A') return `${parsed.name} (${parsed.email})`;
        return parsed.name;
    };

    const getHasPhotoReport = React.useCallback((target: Task | null | undefined) => {
        if (!Array.isArray(target?.photoReports)) return false;
        return target.photoReports.some((report) => {
            const filesCount = Array.isArray(report.files) ? report.files.length : 0;
            const fixedCount = Array.isArray(report.fixedFiles) ? report.fixedFiles.length : 0;
            return filesCount + fixedCount > 0;
        });
    }, []);

    const { data: reportSummaries, refresh: refreshReportSummaries } = usePhotoReports(reportTaskId);
    const hasSummaryReports = React.useMemo(
        () => reportSummaries.some((summary) => summary.filesCount + summary.fixedCount > 0),
        [reportSummaries]
    );
    const hasPhotoReport = React.useMemo(
        () => hasSummaryReports || getHasPhotoReport(task),
        [getHasPhotoReport, hasSummaryReports, task]
    );
    const showReportActions = ['Done', 'Pending', 'Issues', 'Fixed', 'Agreed'].includes(task?.status ?? '');
    const isReportReadOnly = (task?.status ?? '') === 'Agreed';
    const shouldFocusIssues = searchParams?.get('focus') === 'issues';
    const reportSummaryItems = React.useMemo(() => {
        if (reportSummaries.length > 0) {
            return reportSummaries.filter((report) => report.filesCount + report.fixedCount > 0);
        }
        if (!Array.isArray(task?.photoReports)) return [];
        return task.photoReports
            .map((report) => {
                const baseId = report.baseId?.trim();
                if (!baseId) return null;
                const filesCount = Array.isArray(report.files) ? report.files.length : 0;
                const fixedCount = Array.isArray(report.fixedFiles) ? report.fixedFiles.length : 0;
                if (filesCount + fixedCount === 0) return null;
                return {
                    baseId,
                    status: report.status,
                    filesCount,
                    fixedCount,
                };
            })
            .filter(
                (
                    report
                ): report is { baseId: string; status: string; filesCount: number; fixedCount: number } =>
                    report !== null
            )
            .sort((a, b) => a.baseId.localeCompare(b.baseId, 'ru'));
    }, [reportSummaries, task?.photoReports]);

    const taskTitleLine = task?.taskName || task?.taskId || 'Задача';
    const guideText = `Нажмите для загрузки фотоотчета по задаче ${taskTitleLine}${
        bsNumberDisplay !== '—' ? ` ${bsNumberDisplay}` : ''
    }`;

    const guidePadding = 10;
    const guideRect = uploadButtonRect
        ? {
              top: Math.max(0, uploadButtonRect.top - guidePadding),
              left: Math.max(0, uploadButtonRect.left - guidePadding),
              width: uploadButtonRect.width + guidePadding * 2,
              height: uploadButtonRect.height + guidePadding * 2,
          }
        : null;
    const tooltipWidth = 320;
    const tooltipHeight = 120;
    const tooltipPosition = (() => {
        if (!guideRect) return { top: 0, left: 0 };
        if (typeof window === 'undefined') {
            return { top: guideRect.top + guideRect.height + 16, left: guideRect.left };
        }
        const padding = 16;
        const preferBelow = guideRect.top + guideRect.height + 16 + tooltipHeight < window.innerHeight;
        const top = preferBelow
            ? guideRect.top + guideRect.height + 16
            : Math.max(padding, guideRect.top - tooltipHeight - 16);
        const left = Math.min(
            window.innerWidth - tooltipWidth - padding,
            Math.max(padding, guideRect.left + guideRect.width / 2 - tooltipWidth / 2)
        );
        return { top, left };
    })();
    const issuesHighlightPadding = 12;

    const renderWorkItemsTable = (maxHeight?: number | string) => {
        if (!hasWorkItems) {
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
                        {task?.workItems?.map((item: WorkItem, idx) => (
                            <TableRow key={`work-${idx}`}>
                                <TableCell sx={{ minWidth: 180 }}>{item.workType || '—'}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    {Number.isFinite(item.quantity) ? item.quantity : '—'}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.unit || '—'}</TableCell>
                                <TableCell>{item.note || '—'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
        );
    };

    const renderCommentsSection = (maxHeight?: number | string) => {
        const currentTask = task;
        if (!currentTask) return null;

        return (
            <Box
                sx={{
                    maxHeight: maxHeight ?? { xs: 360, md: 520 },
                    overflow: 'auto',
                }}
            >
                <TaskComments
                    taskId={currentTask.taskId || taskId}
                    initialComments={currentTask.comments as TaskComment[]}
                    onTaskUpdated={(updatedTask) =>
                        setTask((prev) => (prev ? { ...prev, ...(updatedTask as Partial<Task>) } : prev))
                    }
                />
            </Box>
        );
    };

    const closeDecisionDialog = () => {
        if (decisionLoading) return;
        setPendingDecision(null);
        setDecisionError(null);
    };

    const closeCompleteDialog = () => {
        if (completeLoading) return;
        setCompleteConfirmOpen(false);
        setCompleteError(null);
    };

    const handleDecisionConfirm = async () => {
        if (!pendingDecision) return;
        if (!taskId) {
            setDecisionError('Не найден идентификатор задачи');
            return;
        }
        setDecisionLoading(true);
        setDecisionError(null);
        try {
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ decision: pendingDecision }),
            });
            const data = (await res.json()) as { task?: Task; error?: string };
            if (!res.ok || !data.task) {
                setDecisionError(data.error || 'Не удалось обновить задачу');
                return;
            }

            setTask((prev) => {
                const updated = data.task as Task;
                return prev ? { ...prev, ...updated } : updated;
            });
            setPendingDecision(null);
        } catch (e) {
            setDecisionError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        } finally {
            setDecisionLoading(false);
        }
    };

    const handleOpenUploadDialog = () => {
        setUploadDialogOpen(true);
        setPhotoGuideOpen(false);
    };

    const handleCloseUploadDialog = () => {
        setUploadDialogOpen(false);
    };

    React.useLayoutEffect(() => {
        if (!photoGuideOpen) return undefined;

        const updateRect = () => {
            const node = uploadButtonRef.current;
            if (!node) return;
            setUploadButtonRect(node.getBoundingClientRect());
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [photoGuideOpen]);

    React.useEffect(() => {
        if (!photoGuideOpen) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setPhotoGuideOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [photoGuideOpen]);

    React.useLayoutEffect(() => {
        if (!issuesGuideOpen) return undefined;

        const updateRect = () => {
            const node = issuesSectionRef.current;
            if (!node) return;
            setIssuesGuideRect(node.getBoundingClientRect());
        };

        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, true);

        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
        };
    }, [issuesGuideOpen, issueReports.length]);

    React.useEffect(() => {
        if (!issuesGuideOpen) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIssuesGuideOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [issuesGuideOpen]);

    React.useEffect(() => {
        if (!shouldFocusIssues || issueReports.length === 0) return;
        if (hasOpenedIssuesGuide.current) return;
        const node = issuesSectionRef.current;
        if (!node || typeof window === 'undefined') return;

        hasOpenedIssuesGuide.current = true;
        setPhotoGuideOpen(false);
        const offset = 24;
        const top = node.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(0, top - offset), behavior: 'smooth' });
        setIssuesGuideOpen(true);
    }, [issueReports.length, shouldFocusIssues]);

    const handleCompleteConfirm = React.useCallback(async () => {
        if (!taskId) {
            setCompleteError('Не найден идентификатор задачи');
            return;
        }
        setCompleteLoading(true);
        setCompleteError(null);
        try {
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: 'Done' }),
            });
            const data = (await res.json()) as { task?: Task; error?: string };
            if (!res.ok || !data.task) {
                setCompleteError(data.error || 'Не удалось завершить задачу');
                return;
            }

            const updatedTask = data.task as Task;
            setTask((prev) => (prev ? { ...prev, ...updatedTask } : updatedTask));
            setCompleteConfirmOpen(false);
            const shouldShowGuide =
                ['Done', 'Pending', 'Issues', 'Fixed', 'Agreed'].includes(updatedTask.status ?? '') &&
                !getHasPhotoReport(updatedTask);
            setPhotoGuideOpen(shouldShowGuide);
        } catch (e) {
            setCompleteError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        } finally {
            setCompleteLoading(false);
        }
    }, [getHasPhotoReport, taskId]);

    if (loading) {
        return (
            <Container
                disableGutters
                maxWidth="xl"
                sx={{ px: pageGutter, py: { xs: 3, sm: 4 }, display: 'flex', justifyContent: 'center' }}
            >
                <CircularProgress />
            </Container>
        );
    }

    if (error) {
        return (
            <Container
                disableGutters
                maxWidth="xl"
                sx={{ px: pageGutter, py: { xs: 3, sm: 4 }, textAlign: 'center' }}
            >
                <Typography color="error" gutterBottom>
                    {error}
                </Typography>
                <Button
                    variant="outlined"
                    onClick={() => void loadTask()}
                    sx={{ borderRadius: UI_RADIUS.button }}
                >
                    Повторить
                </Button>
            </Container>
        );
    }

    if (!task) {
        return (
            <Container
                disableGutters
                maxWidth="xl"
                sx={{ px: pageGutter, py: { xs: 3, sm: 4 }, textAlign: 'center' }}
            >
                <Typography gutterBottom>Задача не найдена</Typography>
                <Button
                    variant="text"
                    onClick={() => router.push('/tasks')}
                    startIcon={<ArrowBackIcon />}
                    sx={{ borderRadius: UI_RADIUS.button }}
                >
                    К списку задач
                </Button>
            </Container>
        );
    }

    if (profileType === undefined) {
        return (
            <Container
                disableGutters
                maxWidth="xl"
                sx={{ px: pageGutter, py: { xs: 3, sm: 4 }, display: 'flex', justifyContent: 'center' }}
            >
                <CircularProgress />
            </Container>
        );
    }

    if (profileType !== 'contractor') {
        return (
            <Container
                disableGutters
                maxWidth="xl"
                sx={{
                    px: pageGutter,
                    py: { xs: 3, sm: 4 },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    alignItems: 'center',
                    textAlign: 'center',
                }}
            >
                <Typography variant="h6">Страница доступна только подрядчикам</Typography>
                <Typography color="text.secondary">
                    Пожалуйста, используйте соответствующий личный кабинет.
                </Typography>
                <Button
                    variant="contained"
                    onClick={() => router.push('/tasks')}
                    sx={{ borderRadius: UI_RADIUS.button }}
                >
                    К списку задач
                </Button>
            </Container>
        );
    }

    const isContractorRestricted = (() => {
        if (profileType !== 'contractor') return false;
        const executorClerkId = (task.executorId || '').trim().toLowerCase();
        const current = (currentUserId || '').trim().toLowerCase();
        if (!executorClerkId) return true; // нет назначенного — доступ запрещен для подрядчиков
        if (!current) return true; // не смогли определить текущего пользователя
        return executorClerkId !== current;
    })();

    if (isContractorRestricted) {
        return (
            <Container
                disableGutters
                maxWidth="xl"
                sx={{
                    px: pageGutter,
                    py: { xs: 3, sm: 4 },
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    alignItems: 'center',
                    textAlign: 'center',
                }}
            >
                <Typography variant="h6">Задача доступна только назначенному исполнителю</Typography>
                <Typography color="text.secondary">
                    Для просмотра нужно, чтобы задача была назначена вам.
                </Typography>
                <Button
                    variant="contained"
                    onClick={() => router.push('/tasks')}
                    sx={{ borderRadius: UI_RADIUS.button }}
                >
                    К списку задач
                </Button>
            </Container>
        );
    }

    return (
        <Container
            disableGutters
            maxWidth="xl"
            sx={{
                px: pageGutter,
                py: { xs: 2, sm: 2.5 },
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
            }}
        >
            <Box sx={{ py: { xs: 0.5, sm: 1 } }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    justifyContent="space-between"
                    gap={{ xs: 1.5, md: 1 }}
                >
                    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0, width: '100%' }}>
                        <Tooltip title="Назад">
                            <IconButton onClick={() => router.back()} sx={getIconButtonSx()}>
                                <ArrowBackIcon />
                            </IconButton>
                        </Tooltip>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.75 }}>
                                <Typography variant="h6" sx={{ wordBreak: 'break-word', minWidth: 0 }}>
                                    {task.taskName || 'Задача'}
                                </Typography>
                                {bsNumberDisplay !== '—' && (
                                    <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
                                        {bsNumberDisplay}
                                    </Typography>
                                )}

                                {task.taskId && (
                                    <Chip
                                        label={task.taskId}
                                        size="small"
                                        variant="outlined"
                                        sx={{ mt: 0.5 }}
                                    />
                                )}
                                {task.status && (
                                    <Chip
                                        label={getStatusLabel(task.status)}
                                        size="small"
                                        sx={{
                                            bgcolor: getStatusColor(normalizeStatusTitle(task.status)),
                                            color: '#fff',
                                            fontWeight: 500,
                                        }}
                                    />
                                )}
                            </Stack>

                            {(task.projectName || task.projectKey) && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0 }}
                                >
                                    Проект:{' '}
                                    {task.projectKey && task.orgId ? (
                                        <Link
                                            href={`/org/${encodeURIComponent(task.orgId ?? '')}/projects/${encodeURIComponent(
                                                task.projectKey
                                            )}/tasks`}
                                            underline="hover"
                                            color="inherit"
                                        >
                                            {task.projectName || task.projectKey}
                                        </Link>
                                    ) : (
                                        task.projectName || task.projectKey
                                    )}
                                </Typography>
                            )}
                        </Box>
                    </Stack>
                </Stack>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box
                    sx={(theme) => ({
                        width: '100%',
                        px: {
                            xs: `calc(${theme.spacing(masonrySpacing.xs)} / 2)`,
                            sm: `calc(${theme.spacing(masonrySpacing.sm)} / 2)`,
                            md: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
                            lg: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
                            xl: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
                        },
                        boxSizing: 'border-box',
                    })}
                >
                    <Masonry
                        columns={{ xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }}
                        spacing={masonrySpacing}
                        sx={{
                            width: '100%',
                            boxSizing: 'border-box',
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
                                    <strong>Базовая станция:</strong> {bsNumberDisplay}
                                </Typography>

                                <Typography variant="body1">
                                    <strong>Адрес:</strong> {task.bsAddress || 'Адрес не указан'}
                                </Typography>

                                <Typography variant="body1">
                                    <strong>Срок:</strong> {task.dueDate ? formatDate(task.dueDate) : '—'}
                                </Typography>
                                <Typography
                                    variant="body1"
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.75,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <strong>Приоритет:</strong>
                                    <Box
                                        component="span"
                                        sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                        }}
                                    >
                                        {getPriorityIcon(
                                            (normalizePriority(task.priority as string) ?? 'medium') as
                                                'urgent' | 'high' | 'medium' | 'low'
                                        )}
                                        <span>{task.priority || '—'}</span>
                                    </Box>
                                </Typography>

                                <Typography variant="body1">
                                    <strong>Стоимость:</strong> {renderCost()}
                                </Typography>
                                <Typography variant="body1">
                                    <strong>Тип задачи:</strong> {task.taskType || '—'}
                                </Typography>

                                {(task.executorName || task.executorEmail) && (
                                    <Typography variant="body1">
                                        <strong>Исполнитель:</strong> {task.executorName || task.executorEmail}
                                    </Typography>
                                )}

                                {(task.initiatorName || task.initiatorEmail) && (
                                    <Typography variant="body1">
                                        <strong>Инициатор:</strong>{' '}
                                        {task.initiatorName && task.initiatorEmail
                                            ? `${task.initiatorName} (${task.initiatorEmail})`
                                            : task.initiatorName || task.initiatorEmail}
                                    </Typography>
                                )}

                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: 3,
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        pt: 0.5,
                                    }}
                                >
                                    <Typography variant="body1">
                                        <strong>Создана:</strong>{' '}
                                        {task.createdAt ? formatDate(task.createdAt) : '—'}
                                    </Typography>
                                </Box>

                                <Divider sx={{ mt: 1.5, mb: 1 }} />
                                {task.status === 'Assigned' && (
                                    <Stack spacing={1}>
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1.5}
                                            alignItems={{ xs: 'stretch', sm: 'center' }}
                                            justifyContent="flex-start"
                                        >
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    setDecisionError(null);
                                                    setPendingDecision('accept');
                                                }}
                                                disabled={decisionLoading}
                                                sx={{
                                                    borderRadius: UI_RADIUS.button,
                                                    textTransform: 'none',
                                                    px: 2.75,
                                                    py: 1.1,
                                                    fontWeight: 700,
                                                    background: 'linear-gradient(135deg, #2fd66b, #1ecf5a)',
                                                    boxShadow: '0 10px 28px rgba(38, 189, 104, 0.35)',
                                                    color: '#0b2916',
                                                    '&:hover': {
                                                        background: 'linear-gradient(135deg, #29c961, #1abf51)',
                                                    },
                                                }}
                                            >
                                                Принять
                                            </Button>
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    setDecisionError(null);
                                                    setPendingDecision('reject');
                                                }}
                                                disabled={decisionLoading}
                                                sx={{
                                                    borderRadius: UI_RADIUS.button,
                                                    textTransform: 'none',
                                                    px: 2.75,
                                                    py: 1.1,
                                                    fontWeight: 700,
                                                    background: 'linear-gradient(135deg, #f4f6fa, #e8ebf1)',
                                                    boxShadow: '0 8px 22px rgba(15, 16, 20, 0.12)',
                                                    color: '#0f1115',
                                                    border: '1px solid rgba(0,0,0,0.06)',
                                                    '&:hover': {
                                                        background: 'linear-gradient(135deg, #e6e9ef, #d9dce4)',
                                                    },
                                                }}
                                            >
                                                Отказать
                                            </Button>
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary">
                                            Статус после принятия: At work. После отказа: To do.
                                        </Typography>
                                    </Stack>
                                )}
                                {task.status === 'At work' && (
                                    <Box sx={{ pt: 0.5 }}>
                                        <Divider sx={{ mb: 1.5 }} />
                                        <Button
                                            variant="contained"
                                            color="success"
                                            onClick={handleCompleteClick}
                                            disabled={completeLoading}
                                            fullWidth
                                            sx={{
                                                borderRadius: UI_RADIUS.button,
                                                textTransform: 'none',
                                                py: 1.1,
                                                fontWeight: 700,
                                            }}
                                        >
                                            Завершено
                                        </Button>
                                    </Box>
                                )}
                            </Stack>
                        </CardItem>

                    {showReportActions && (
                        <CardItem ref={issuesSectionRef} sx={{ minWidth: 0 }}>
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                gutterBottom
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <PhotoLibraryOutlinedIcon fontSize="small" />
                                Фотоотчеты
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                useFlexGap
                                flexWrap="wrap"
                            >
                                {hasPhotoReport && reportSummaryItems.length > 0 && (
                                    <ReportSummaryList items={reportSummaryItems} taskId={reportTaskId} mode="pill" />
                                )}
                                {!hasPhotoReport && (
                                    <Button
                                        variant="contained"
                                        startIcon={<CloudUploadIcon />}
                                        onClick={handleOpenUploadDialog}
                                        ref={uploadButtonRef}
                                        sx={{
                                            textTransform: 'none',
                                            borderRadius: UI_RADIUS.button,
                                            fontWeight: 700,
                                        }}
                                    >
                                        {isReportReadOnly ? 'Посмотреть отчет' : 'Загрузить фото'}
                                    </Button>
                                )}
                            </Stack>
                        </CardItem>
                    )}

                    {relatedTasks.length > 0 && (
                        <CardItem sx={{ minWidth: 0 }}>
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                gutterBottom
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <LinkOutlinedIcon fontSize="small" />
                                Связанные задачи
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            <Stack spacing={1}>
                                {relatedTasks.map((related) => {
                                    const detailLabel = related.bsNumber ? `BS ${related.bsNumber}` : null;
                                    const statusLabel = related.status
                                        ? getStatusLabel(normalizeStatusTitle(related.status))
                                        : undefined;
                                    const href = related.taskId
                                        ? `/tasks/${encodeURIComponent(related.taskId.toLowerCase())}`
                                        : null;
                                    const sharedSx = {
                                        display: 'block',
                                        borderRadius: UI_RADIUS.item,
                                        p: 1,
                                        '&:hover': {
                                            backgroundColor: 'rgba(59,130,246,0.04)',
                                        },
                                    } as const;
                                    return href ? (
                                        <Link
                                            key={related._id}
                                            href={href}
                                            color="inherit"
                                            underline="hover"
                                            sx={sharedSx}
                                        >
                                            <Stack
                                                direction="row"
                                                alignItems="flex-start"
                                                justifyContent="space-between"
                                                spacing={1}
                                            >
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography
                                                        variant="body1"
                                                        fontWeight={600}
                                                        sx={{ wordBreak: 'break-word' }}
                                                    >
                                                        {related.taskName || related.taskId || related._id}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}
                                                    >
                                                        {related.taskId ? `#${related.taskId}` : related._id}
                                                        {detailLabel ? ` · ${detailLabel}` : null}
                                                    </Typography>
                                                </Box>
                                                {statusLabel && (
                                                    <Chip
                                                        label={statusLabel}
                                                        size="small"
                                                        sx={{ fontWeight: 500 }}
                                                    />
                                                )}
                                            </Stack>
                                        </Link>
                                    ) : (
                                        <Box key={related._id} sx={sharedSx}>
                                            <Stack
                                                direction="row"
                                                alignItems="flex-start"
                                                justifyContent="space-between"
                                                spacing={1}
                                            >
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography
                                                        variant="body1"
                                                        fontWeight={600}
                                                        sx={{ wordBreak: 'break-word' }}
                                                    >
                                                        {related.taskName || related.taskId || related._id}
                                                    </Typography>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}
                                                    >
                                                        {related.taskId ? `#${related.taskId}` : related._id}
                                                        {detailLabel ? ` · ${detailLabel}` : null}
                                                    </Typography>
                                                </Box>
                                                {statusLabel && (
                                                    <Chip
                                                        label={statusLabel}
                                                        size="small"
                                                        sx={{ fontWeight: 500 }}
                                                    />
                                                )}
                                            </Stack>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </CardItem>
                    )}

                    {task.taskDescription && (
                        <CardItem sx={{ minWidth: 0 }}>
                            <Typography
                                variant="body1"
                                fontWeight={600}
                                gutterBottom
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <DescriptionOutlinedIcon fontSize="small" />
                                Описание
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{task.taskDescription}</Typography>
                        </CardItem>
                    )}

                    <CardItem sx={{ minWidth: 0 }}>
                        <TaskGeoLocation locations={task.bsLocation} />
                    </CardItem>

                    {(hasWorkItems || Array.isArray(task.workItems)) && (
                        <CardItem sx={{ minWidth: 0 }}>
                            <Accordion defaultExpanded disableGutters elevation={0} sx={accordionSx}>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
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
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                            }}
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
                                <AccordionDetails sx={accordionDetailsSx}>
                                    <Divider sx={{ mb: 1.5 }} />
                                    {renderWorkItemsTable()}
                                </AccordionDetails>
                            </Accordion>
                        </CardItem>
                    )}

                    {hasAttachmentBlock && (
                        <CardItem sx={{ minWidth: 0 }}>
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                gutterBottom
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <AttachFileOutlinedIcon fontSize="small" />
                                Вложения
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            <Stack gap={1}>
                                {attachmentLinks.map((url, idx) => (
                                    <Link
                                        key={`att-${idx}`}
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        underline="hover"
                                    >
                                        {extractFileNameFromUrl(url, `Вложение ${idx + 1}`)}
                                    </Link>
                                ))}
                            </Stack>
                        </CardItem>
                    )}

                    <CardItem sx={{ minWidth: 0 }}>
                        <Accordion
                            defaultExpanded={!!task?.comments?.length}
                            disableGutters
                            elevation={0}
                            sx={accordionSx}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
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
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                        }}
                                    >
                                        <CommentOutlinedIcon fontSize="small" />
                                        Комментарии
                                    </Typography>

                                    <Tooltip title="Развернуть на весь экран">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCommentsFullScreen(true);
                                            }}
                                        >
                                            <OpenInFullIcon fontSize="inherit" />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={accordionDetailsSx}>
                                <Divider sx={{ mb: 1.5 }} />
                                {renderCommentsSection()}
                            </AccordionDetails>
                        </Accordion>
                    </CardItem>

                    <CardItem sx={{ p: 0, minWidth: 0 }}>
                        <Accordion disableGutters elevation={0} sx={accordionSx}>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{ ...accordionSummarySx, px: cardPadding, pt: cardPadding, pb: 0 }}
                            >
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    gutterBottom
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                    }}
                                >
                                    <HistoryIcon fontSize="small" />
                                    История
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={accordionDetailsSx}>
                                <Divider sx={{ mb: 1.5 }} />
                                {sortedEvents.length === 0 ? (
                                    <Typography color="text.secondary" sx={{ px: 2, pb: 1.5 }}>
                                        История пуста
                                    </Typography>
                                ) : (
                                    <Timeline
                                        sx={{
                                            p: 0,
                                            m: 0,
                                            px: 2,
                                            pb: 1.5,
                                            '& .MuiTimelineOppositeContent-root': {
                                                flex: '0 0 110px',
                                                whiteSpace: 'normal',
                                            },
                                            '& .MuiTimelineContent-root': {
                                                wordBreak: 'break-word',
                                                overflowWrap: 'anywhere',
                                                minWidth: 0,
                                            },
                                        }}
                                    >
                                        {sortedEvents.map((ev, idx) => (
                                            <TimelineItem key={ev._id ?? idx}>
                                                <TimelineOppositeContent sx={{ pr: 1 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {formatDateTime(ev.date)}
                                                    </Typography>
                                                </TimelineOppositeContent>
                                                <TimelineSeparator>
                                                    <TimelineDot
                                                        color={ev.action === 'TASK_CREATED' ? 'primary' : 'success'}
                                                    />
                                                    {idx < sortedEvents.length - 1 && <TimelineConnector />}
                                                </TimelineSeparator>
                                                <TimelineContent sx={{ py: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {getEventTitle(ev.action)}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Автор: {getEventAuthorLine(ev)}
                                                    </Typography>
                                                    <Box sx={{ mt: 0.5 }}>{renderEventDetails(ev)}</Box>
                                                </TimelineContent>
                                            </TimelineItem>
                                        ))}
                                    </Timeline>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    </CardItem>
                    </Masonry>
                </Box>
            </Box>

            <PhotoReportUploader
                open={uploadDialogOpen}
                onClose={handleCloseUploadDialog}
                taskId={task.taskId || taskId}
                taskName={task.taskName}
                bsLocations={task.bsLocation}
                photoReports={task.photoReports}
                onSubmitted={() => {
                    void loadTask();
                    void refreshReportSummaries();
                }}
                readOnly={isReportReadOnly}
            />

            {photoGuideOpen && guideRect && (
                <Box
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1500,
                        pointerEvents: 'auto',
                    }}
                    onClick={() => {
                        if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
                            setPhotoGuideOpen(false);
                        }
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            top: guideRect.top,
                            left: guideRect.left,
                            width: guideRect.width,
                            height: guideRect.height,
                            borderRadius: UI_RADIUS.pill,
                            border: '2px solid rgba(255,255,255,0.95)',
                            boxShadow: '0 0 0 9999px rgba(9, 12, 18, 0.72)',
                            pointerEvents: 'none',
                        }}
                    />
                    <Box
                        sx={{
                            position: 'absolute',
                            top: tooltipPosition.top,
                            left: tooltipPosition.left,
                            width: tooltipWidth,
                            maxWidth: 'calc(100vw - 32px)',
                            p: 2,
                            borderRadius: UI_RADIUS.tooltip,
                            background:
                                'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(235,242,255,0.98))',
                            border: '1px solid rgba(255,255,255,0.85)',
                            boxShadow: '0 16px 50px rgba(8, 12, 24, 0.28)',
                            pointerEvents: 'none',
                        }}
                    >
                        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
                            Фотоотчет
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {guideText}
                        </Typography>
                    </Box>
                </Box>
            )}

            {issuesGuideOpen && issuesGuideRect && (
                <Box
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1490,
                        pointerEvents: 'auto',
                    }}
                    onClick={() => setIssuesGuideOpen(false)}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            top: issuesGuideRect.top - issuesHighlightPadding,
                            left: issuesGuideRect.left - issuesHighlightPadding,
                            width: issuesGuideRect.width + issuesHighlightPadding * 2,
                            height: issuesGuideRect.height + issuesHighlightPadding * 2,
                            borderRadius: UI_RADIUS.overlay,
                            border: '2px solid rgba(255,255,255,0.95)',
                            boxShadow: '0 0 0 9999px rgba(9, 12, 18, 0.72)',
                            pointerEvents: 'none',
                        }}
                    />
                </Box>
            )}

            <Dialog
                open={completeConfirmOpen}
                onClose={closeCompleteDialog}
                slotProps={{
                    paper: {
                        sx: {
                            borderRadius: UI_RADIUS.surface,
                            background:
                                'linear-gradient(160deg, rgba(255,255,255,0.92), rgba(244,247,252,0.94))',
                            border: '1px solid rgba(255,255,255,0.6)',
                            boxShadow: '0 30px 80px rgba(12, 16, 29, 0.28)',
                            backdropFilter: 'blur(18px)',
                            minWidth: { xs: 'calc(100% - 32px)', sm: 420 },
                        },
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>Завершить задачу?</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Typography variant="body1" sx={{ mb: 1.5 }}>
                        Подтвердите, что работы по задаче «{task.taskName || task.taskId || 'Задача'}»
                        {bsNumberDisplay !== '—' ? ` (БС ${bsNumberDisplay})` : ''} завершены. Статус будет изменен на
                        «Выполнено», а участники получат уведомление.
                    </Typography>
                    {completeError && (
                        <Typography variant="body2" color="error" fontWeight={600}>
                            {completeError}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions
                    sx={{
                        px: 3,
                        pb: 2.5,
                        display: 'flex',
                        gap: 1,
                        justifyContent: 'flex-end',
                    }}
                >
                    <Button
                        onClick={closeCompleteDialog}
                        disabled={completeLoading}
                        sx={{
                            textTransform: 'none',
                            borderRadius: UI_RADIUS.button,
                            px: 2.25,
                            py: 1,
                            color: '#111',
                            background: 'rgba(17,17,17,0.06)',
                            '&:hover': {
                                background: 'rgba(17,17,17,0.1)',
                            },
                        }}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleCompleteConfirm()}
                        disabled={completeLoading}
                        sx={{
                            textTransform: 'none',
                            borderRadius: UI_RADIUS.button,
                            px: 2.75,
                            py: 1,
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #2fd66b, #1ecf5a)',
                            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
                            color: '#0c2d18',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #29c961, #1abf51)',
                            },
                        }}
                    >
                        {completeLoading ? 'Сохранение...' : 'Подтвердить'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={!!pendingDecision}
                onClose={closeDecisionDialog}
                slotProps={{
                    paper: {
                        sx: {
                            borderRadius: UI_RADIUS.surface,
                            background:
                                'linear-gradient(160deg, rgba(255,255,255,0.92), rgba(244,247,252,0.94))',
                            border: '1px solid rgba(255,255,255,0.6)',
                            boxShadow: '0 30px 80px rgba(12, 16, 29, 0.28)',
                            backdropFilter: 'blur(18px)',
                            minWidth: { xs: 'calc(100% - 32px)', sm: 420 },
                        },
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>
                    {pendingDecision === 'accept' ? 'Принять задачу' : 'Отказаться от задачи'}
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Typography variant="body1" sx={{ mb: 1.5 }}>
                        {pendingDecision === 'accept'
                            ? `Вы подтверждаете что готовы принять задачу ${task.taskName} ${bsNumberDisplay !== '—' ? bsNumberDisplay : ''}? Срок выполнение - ${
                                  task.dueDate ? formatDate(task.dueDate) : '—'
                              }.`
                            : `Вы уверены что хотите отказаться от задачи ${task.taskName} ${bsNumberDisplay !== '—' ? bsNumberDisplay : ''}?`}
                    </Typography>
                    {decisionError && (
                        <Typography variant="body2" color="error" fontWeight={600}>
                            {decisionError}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions
                    sx={{
                        px: 3,
                        pb: 2.5,
                        display: 'flex',
                        gap: 1,
                        justifyContent: 'flex-end',
                    }}
                >
                    <Button
                        onClick={closeDecisionDialog}
                        disabled={decisionLoading}
                        sx={{
                            textTransform: 'none',
                            borderRadius: UI_RADIUS.button,
                            px: 2.25,
                            py: 1,
                            color: '#111',
                            background: 'rgba(17,17,17,0.06)',
                            '&:hover': {
                                background: 'rgba(17,17,17,0.1)',
                            },
                        }}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleDecisionConfirm()}
                        disabled={decisionLoading}
                        sx={{
                            textTransform: 'none',
                            borderRadius: UI_RADIUS.button,
                            px: 2.75,
                            py: 1,
                            fontWeight: 700,
                            background:
                                pendingDecision === 'accept'
                                    ? 'linear-gradient(135deg, #2fd66b, #1ecf5a)'
                                    : 'linear-gradient(135deg, #f04343, #d33131)',
                            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
                            color: pendingDecision === 'accept' ? '#0c2d18' : '#fff',
                            '&:hover': {
                                background:
                                    pendingDecision === 'accept'
                                        ? 'linear-gradient(135deg, #29c961, #1abf51)'
                                        : 'linear-gradient(135deg, #db3c3c, #c12b2b)',
                            },
                        }}
                    >
                        {decisionLoading
                            ? 'Сохранение...'
                            : pendingDecision === 'accept'
                              ? 'Принять'
                              : 'Отказать'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog fullScreen open={workItemsFullScreen} onClose={() => setWorkItemsFullScreen(false)}>
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

                <Box sx={{ p: 2 }}>{renderWorkItemsTable('calc(100vh - 80px)')}</Box>
            </Dialog>

            <Dialog fullScreen open={commentsFullScreen} onClose={() => setCommentsFullScreen(false)}>
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
                        Комментарии
                    </Typography>
                    <IconButton onClick={() => setCommentsFullScreen(false)}>
                        <CloseFullscreenIcon />
                    </IconButton>
                </Box>

                <Box sx={{ p: 2 }}>{renderCommentsSection('calc(100vh - 80px)')}</Box>
            </Dialog>
        </Container>
    );
}
