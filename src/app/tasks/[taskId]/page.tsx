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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { getPriorityIcon, normalizePriority } from '@/utils/priorityIcons';
import TaskGeoLocation from '@/app/workspace/components/TaskGeoLocation';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel, normalizeStatusTitle } from '@/utils/statusLabels';
import TaskComments, { type TaskComment } from '@/features/tasks/TaskComments';
import PhotoReportUploader from '@/features/tasks/PhotoReportUploader';
import ReportSummaryList from '@/features/reports/ReportSummaryList';
import DocumentReviewTaskPanel from '@/features/documents/DocumentReviewTaskPanel';
import { fetchUserContext, resolveRoleFromContext } from '@/app/utils/userContext';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { MANAGER_ROLES } from '@/app/types/roles';
import type { Task, WorkItem, TaskEvent } from '@/app/types/taskTypes';
import { extractFileNameFromUrl, isDocumentUrl } from '@/utils/taskFiles';
import { normalizeRelatedTasks } from '@/app/utils/relatedTasks';
import { usePhotoReports } from '@/hooks/usePhotoReports';
import { UI_RADIUS } from '@/config/uiTokens';
import { getOrgPageStyles } from '@/app/org/(protected)/[org]/styles';
import ProfileDialog from '@/features/profile/ProfileDialog';
import { formatNameFromEmail } from '@/utils/email';
import { useI18n } from '@/i18n/I18nProvider';

type TaskEventDetailsValue = string | number | boolean | null | undefined;

type Change = {
    from?: unknown;
    to?: unknown;
};

type TaskEventDetails = Record<string, TaskEventDetailsValue | Change>;
type AgreedDocumentPackage = {
    currentVersion?: number;
    publishedFiles?: string[];
    error?: string;
};

export default function TaskDetailPage() {
    const { t, locale } = useI18n();
    const params = useParams<{ taskId: string }>();
    const taskId = params?.taskId?.trim() || '';
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams?.get('token')?.trim() || '';
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
    const dialogPaperSx = React.useMemo(
        () => ({
            borderRadius: UI_RADIUS.surface,
            background: isDarkMode
                ? 'linear-gradient(160deg, rgba(14,18,28,0.98), rgba(22,30,44,0.98))'
                : 'linear-gradient(160deg, rgba(255,255,255,0.92), rgba(244,247,252,0.94))',
            border: isDarkMode ? '1px solid rgba(148,163,184,0.25)' : '1px solid rgba(255,255,255,0.6)',
            boxShadow: isDarkMode ? '0 30px 80px rgba(0, 0, 0, 0.55)' : '0 30px 80px rgba(12, 16, 29, 0.28)',
            backdropFilter: 'blur(18px)',
            minWidth: { xs: 'calc(100% - 32px)', sm: 420 },
        }),
        [isDarkMode]
    );
    const CardItem = React.useMemo(() => {
        const Component = React.forwardRef<HTMLDivElement, PaperProps>(({ sx, ...rest }, ref) => (
            <Paper ref={ref} {...rest} sx={{ ...masonryCardSx, p: cardPadding, minWidth: 0, ...sx }} />
        ));
        Component.displayName = 'CardItem';
        return Component;
    }, [cardPadding, masonryCardSx]);

    const pageGutter = { xs: 0.25, sm: 2.5, md: 3, lg: 3.5, xl: 4 };
    const masonrySpacing = { xs: 0.5, sm: 1.5, md: 2 } as const;

    const [task, setTask] = React.useState<Task | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = React.useState<string>('');
    const [userRole, setUserRole] = React.useState<EffectiveOrgRole | null>(null);
    const [profileType, setProfileType] = React.useState<'employer' | 'contractor' | undefined>(undefined);
    const [profileUserId, setProfileUserId] = React.useState<string | null>(null);
    const [profileOpen, setProfileOpen] = React.useState(false);
    const [workItemsFullScreen, setWorkItemsFullScreen] = React.useState(false);
    const [commentsFullScreen, setCommentsFullScreen] = React.useState(false);
    const [pendingDecision, setPendingDecision] = React.useState<'accept' | 'reject' | null>(null);
    const [decisionLoading, setDecisionLoading] = React.useState(false);
    const [decisionError, setDecisionError] = React.useState<string | null>(null);
    const [agreedDocsLoading, setAgreedDocsLoading] = React.useState(false);
    const [agreedDocsError, setAgreedDocsError] = React.useState<string | null>(null);
    const [agreedDocsVersion, setAgreedDocsVersion] = React.useState<number>(0);
    const [agreedDocsFiles, setAgreedDocsFiles] = React.useState<string[]>([]);
    const [agreedDocsArchiveLoading, setAgreedDocsArchiveLoading] = React.useState(false);

    const openProfileDialog = (clerkUserId?: string | null) => {
        if (!clerkUserId) return;
        setProfileUserId(clerkUserId);
        setProfileOpen(true);
    };

    const closeProfileDialog = () => {
        setProfileOpen(false);
        setProfileUserId(null);
    };
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
        if (!v) return t('common.empty', '—');
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v);
        return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const formatDateTime = (v?: string | Date) => {
        if (!v) return t('common.empty', '—');
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v);
        return d.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU');
    };

    const formatRuble = (value?: number) => {
        if (typeof value !== 'number') return t('common.empty', '—');
        return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value) + (locale === 'en' ? ' RUB' : ' ₽');
    };

    const renderCost = () => {
        if (typeof task?.contractorPayment !== 'number') return t('common.empty', '—');
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
        return task?.bsNumber || t('common.empty', '—');
    }, [task?.bsLocation, task?.bsNumber, t]);

    const authorDisplayName = React.useMemo(() => {
        const rawName = task?.authorName?.trim() ?? '';
        const rawEmail = task?.authorEmail?.trim() ?? '';
        if (rawName) {
            return rawName.includes('@') ? formatNameFromEmail(rawName) : rawName;
        }
        if (rawEmail) {
            return formatNameFromEmail(rawEmail);
        }
        return '';
    }, [task?.authorName, task?.authorEmail]);

    const asText = (x: unknown): string => {
        if (x === null || typeof x === 'undefined') return t('common.empty', '—');
        if (typeof x === 'string') {
            const d = new Date(x);
            if (!Number.isNaN(d.getTime())) return d.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU');
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
                setError(data.error || t('tasks.error.loadTask', 'Не удалось загрузить задачу ({status})', { status: res.status }));
                setTask(null);
            } else {
                setTask(data.task);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : t('tasks.error.network', 'Network error'));
            setTask(null);
        } finally {
            setLoading(false);
        }
    }, [taskId, t]);

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
                setUserRole(resolveRoleFromContext(ctx));
            } catch {
                setProfileType('contractor');
                setUserRole(null);
            }
        };
        void fetchUserRole();
    }, []);

    React.useEffect(() => {
        void loadTask();
    }, [loadTask]);

    const hasWorkItems =
        task?.taskType !== 'document' && Array.isArray(task?.workItems) && task.workItems.length > 0;
    const documentInputLinks = Array.isArray(task?.documentInputLinks) ? task.documentInputLinks : [];
    const documentInputPhotos = Array.isArray(task?.documentInputPhotos) ? task.documentInputPhotos : [];
    const documentStages = Array.isArray(task?.documentStages) ? task.documentStages : [];
    const hasDocumentInputs =
        task?.taskType === 'document' &&
        (Boolean(task?.documentInputNotes) ||
            documentInputLinks.length > 0 ||
            documentInputPhotos.length > 0 ||
            documentStages.length > 0);
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
        if (task?.taskType === 'document') return [];
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
    }, [task?.photoReports, task?.taskType]);

    const sortedEvents = React.useMemo(() => {
        if (!task?.events) return [];

        const raw = [...task.events].sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            return db - da;
        });

        const result: TaskEvent[] = [];

        for (const ev of raw) {
            if (ev.action === 'status_changed_assigned') {
                const pair = raw.find(
                    (p) => p.action === 'updated' && p.date === ev.date
                );

                if (pair && pair.details) {
                    const mergedDetails: TaskEventDetails = {
                        ...((ev.details || {}) as TaskEventDetails),
                    };

                    const st = (pair.details as TaskEventDetails).status;
                    if (
                        st &&
                        typeof st === 'object' &&
                        ('from' in (st as Record<string, unknown>) || 'to' in (st as Record<string, unknown>))
                    ) {
                        mergedDetails.status = st as Change;
                    }

                    const executorEmail = (pair.details as TaskEventDetails).executorEmail;
                    if (executorEmail && !mergedDetails.executorEmail) {
                        mergedDetails.executorEmail = executorEmail;
                    }

                    result.push({
                        ...ev,
                        details: mergedDetails,
                    });
                    continue;
                }

                result.push(ev);
                continue;
            }

            const hasAssignWithSameTime = raw.some(
                (p) => p.action === 'status_changed_assigned' && p.date === ev.date
            );
            if (ev.action === 'updated' && hasAssignWithSameTime) {
                continue;
            }

            result.push(ev);
        }

        return result;
    }, [task?.events]);

    const getEventTitle = (action: string, ev?: TaskEvent): string => {
        if (action === 'created') return t('tasks.events.created', 'Задача создана');
        if (action === 'status_changed_assigned') return t('tasks.events.assigned', 'Задача назначена исполнителю');
        if (action === 'updated' && ev && isExecutorRemovedEvent(ev)) {
            return t('tasks.events.executorRemoved', 'Исполнитель снят с задачи');
        }
        if (action === 'updated') return t('tasks.events.updated', 'Задача изменена');
        return action;
    };

    const isChange = (value: unknown): value is Change => {
        return (
            typeof value === 'object' &&
            value !== null &&
            ('from' in (value as Record<string, unknown>) || 'to' in (value as Record<string, unknown>))
        );
    };

    const isExecutorRemovedEvent = (ev: TaskEvent): boolean => {
        if (ev.action !== 'updated') return false;
        const d = (ev.details || {}) as TaskEventDetails;
        const candidates = [d.executorId, d.executorName, d.executorEmail];

        const isRemovedChange = (val: unknown): val is { from?: unknown; to?: unknown } => {
            if (typeof val !== 'object' || val === null) return false;
            const obj = val as { from?: unknown; to?: unknown };
            if ('to' in obj && typeof obj.to === 'undefined') return true;
            return 'from' in obj && !('to' in obj);
        };

        return candidates.some((c) => isRemovedChange(c));
    };

    const getDetailString = (details: TaskEventDetails, key: string): string => {
        const raw = details[key];
        if (
            typeof raw === 'string' ||
            typeof raw === 'number' ||
            typeof raw === 'boolean' ||
            raw === null ||
            typeof raw === 'undefined'
        ) {
        return raw === null || typeof raw === 'undefined' ? t('common.empty', '—') : String(raw);
        }

        return '—';
    };

    const isManager = Boolean(userRole && MANAGER_ROLES.includes(userRole));
    const normalizedStatus = normalizeStatusTitle(task?.status);
    const shouldShowAgreedDocsBlock = task?.taskType === 'document' && normalizedStatus === 'Agreed';
    const buildDocumentReviewFileUrl = React.useCallback(
        (fileUrl: string, download = false) => {
            const downloadParam = download ? '&download=1' : '';
            const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
            return `/api/document-reviews/${encodeURIComponent(
                task?.taskId ?? taskId
            )}/file?url=${encodeURIComponent(fileUrl)}${downloadParam}${tokenParam}`;
        },
        [task?.taskId, taskId, token]
    );

    React.useEffect(() => {
        if (!shouldShowAgreedDocsBlock || !task?.taskId) {
            setAgreedDocsFiles([]);
            setAgreedDocsVersion(0);
            setAgreedDocsError(null);
            setAgreedDocsLoading(false);
            return;
        }

        const loadAgreedDocs = async () => {
            try {
                setAgreedDocsLoading(true);
                setAgreedDocsError(null);
                const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
                const res = await fetch(
                    `/api/document-reviews/${encodeURIComponent(task.taskId)}${tokenParam}`,
                    { cache: 'no-store' }
                );
                const data = (await res.json().catch(() => null)) as AgreedDocumentPackage | null;
                if (!res.ok || !data) {
                    setAgreedDocsFiles([]);
                    setAgreedDocsVersion(0);
                    setAgreedDocsError(
                        data?.error ||
                            t(
                                'task.document.agreed.error',
                                'Не удалось загрузить согласованную документацию'
                            )
                    );
                    return;
                }
                const files = Array.isArray(data.publishedFiles)
                    ? data.publishedFiles.filter(
                          (file): file is string => file.trim().length > 0
                      )
                    : [];
                setAgreedDocsFiles(files);
                setAgreedDocsVersion(
                    typeof data.currentVersion === 'number' ? data.currentVersion : 0
                );
            } catch (loadError) {
                setAgreedDocsFiles([]);
                setAgreedDocsVersion(0);
                setAgreedDocsError(
                    loadError instanceof Error
                        ? loadError.message
                        : t(
                              'task.document.agreed.error',
                              'Не удалось загрузить согласованную документацию'
                          )
                );
            } finally {
                setAgreedDocsLoading(false);
            }
        };

        void loadAgreedDocs();
    }, [shouldShowAgreedDocsBlock, task?.taskId, t, token]);

    const handleDownloadAgreedDocsArchive = React.useCallback(async () => {
        if (!task?.taskId) return;
        try {
            setAgreedDocsArchiveLoading(true);
            setAgreedDocsError(null);
            const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
            const res = await fetch(
                `/api/document-reviews/${encodeURIComponent(task.taskId)}/download${tokenParam}`,
                { cache: 'no-store' }
            );
            const errorData = (await res
                .clone()
                .json()
                .catch(() => null)) as { error?: string } | null;
            if (!res.ok) {
                setAgreedDocsError(
                    errorData?.error ||
                        t(
                            'task.document.agreed.archiveError',
                            'Не удалось скачать архив согласованной документации'
                        )
                );
                return;
            }

            const blob = await res.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const contentDisposition = res.headers.get('Content-Disposition') || '';
            const encodedNameMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
            const plainNameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
            const resolvedName = encodedNameMatch?.[1] || plainNameMatch?.[1];
            const filename = resolvedName
                ? decodeURIComponent(resolvedName)
                : `agreed-documents-${task.taskId}.zip`;

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
        } catch (downloadError) {
            setAgreedDocsError(
                downloadError instanceof Error
                    ? downloadError.message
                    : t(
                          'task.document.agreed.archiveError',
                          'Не удалось скачать архив согласованной документации'
                      )
            );
        } finally {
            setAgreedDocsArchiveLoading(false);
        }
    }, [task?.taskId, t, token]);

    const documentStatusHint = React.useMemo(() => {
        if (task?.taskType !== 'document') return null;
        switch (normalizedStatus) {
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
    }, [normalizedStatus, task?.taskType, t]);
    const statusKeys = new Set(['status', 'publicStatus', 'publicModerationStatus']);
    const dateKeys = new Set([
        'createdAt',
        'updatedAt',
        'dueDate',
        'orderDate',
        'orderSignDate',
        'workCompletionDate',
    ]);
    const fieldLabels: Record<string, string> = {
        taskName: t('tasks.fields.taskName', 'Задача'),
        bsNumber: t('tasks.fields.bsNumber', 'БС'),
        status: t('tasks.fields.status', 'Статус'),
        priority: t('tasks.fields.priority', 'Приоритет'),
        executorName: t('tasks.fields.executorName', 'Исполнитель'),
        executorEmail: t('tasks.fields.executorEmail', 'Почта'),
        executorId: t('tasks.fields.executorId', 'Исполнитель'),
        taskDescription: t('tasks.fields.taskDescription', 'Описание'),
        publicDescription: t('tasks.fields.publicDescription', 'Информация для подрядчика'),
        dueDate: t('tasks.fields.dueDate', 'Срок'),
        totalCost: t('tasks.fields.totalCost', 'Стоимость'),
        budget: t('tasks.fields.budget', 'Плановый бюджет'),
        contractorPayment: t('tasks.fields.contractorPayment', 'Оплата подрядчику'),
        taskType: t('tasks.fields.taskType', 'Тип задачи'),
        visibility: t('tasks.fields.visibility', 'Видимость'),
        publicStatus: t('tasks.fields.publicStatus', 'Публичный статус'),
        publicModerationStatus: t('tasks.fields.publicModerationStatus', 'Статус модерации'),
        publicModerationComment: t('tasks.fields.publicModerationComment', 'Комментарий модерации'),
        orderNumber: t('tasks.fields.orderNumber', 'Номер заказа'),
        orderDate: t('tasks.fields.orderDate', 'Дата заказа'),
        orderSignDate: t('tasks.fields.orderSignDate', 'Дата подписания'),
        orderUrl: t('tasks.fields.orderUrl', 'Ссылка на заказ'),
        bsAddress: t('tasks.fields.bsAddress', 'Адрес'),
        workCompletionDate: t('tasks.fields.workCompletionDate', 'Дата завершения'),
        applicationCount: t('tasks.fields.applicationCount', 'Отклики'),
        allowInstantClaim: t('tasks.fields.allowInstantClaim', 'Мгновенный отклик'),
        currency: t('tasks.fields.currency', 'Валюта'),
        authorName: t('tasks.fields.authorName', 'Автор'),
        authorEmail: t('tasks.fields.authorEmail', 'Почта автора'),
        initiatorName: t('tasks.fields.initiatorName', 'Инициатор'),
        initiatorEmail: t('tasks.fields.initiatorEmail', 'Почта инициатора'),
        createdAt: t('tasks.fields.createdAt', 'Создана'),
        updatedAt: t('tasks.fields.updatedAt', 'Обновлена'),
    };

    const getDetailLabel = (key: string) => fieldLabels[key] ?? t('tasks.fields.unknown', 'Поле');

    const formatEventValue = (key: string, value: unknown): string => {
        if (typeof value === 'boolean') return value ? t('common.yes', 'Да') : t('common.no', 'Нет');
        if (typeof value === 'string' && dateKeys.has(key)) return formatDateTime(value);
        if (typeof value === 'string' && statusKeys.has(key)) {
            const label = getStatusLabel(normalizeStatusTitle(value));
            return label || value;
        }
        if (typeof value === 'string' && key === 'priority') {
            const label = (() => {
                switch (value) {
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
            })();
            return label || value;
        }
        return asText(value);
    };

    const getEventAuthorInfo = (ev: TaskEvent) => {
        const detailAuthorId =
            ev.details && typeof (ev.details as TaskEventDetails).authorId === 'string'
                ? String((ev.details as TaskEventDetails).authorId)
                : undefined;
        const detailAuthorName =
            ev.details && typeof (ev.details as TaskEventDetails).authorName === 'string'
                ? String((ev.details as TaskEventDetails).authorName)
                : undefined;
        const rawName = (ev.author || detailAuthorName || '').trim();
        const normalizedName = rawName.includes('@') ? formatNameFromEmail(rawName) : rawName;
        return {
            id: ev.authorId || detailAuthorId,
            name: normalizedName || t('common.empty', '—'),
        };
    };

    const renderEventDetails = (ev: TaskEvent): React.ReactNode => {
        const d: TaskEventDetails = (ev.details || {}) as TaskEventDetails;

        if (ev.action === 'created') {
            const taskNameStr = getDetailString(d, 'taskName');
            const bsNumberStr = getDetailString(d, 'bsNumber');
            const statusStr = getDetailString(d, 'status');
            const priorityStr = getDetailString(d, 'priority');

            return (
                <>
                    <Typography variant="caption" display="block">
                        {getDetailLabel('taskName')}: {formatEventValue('taskName', taskNameStr)}
                    </Typography>
                    <Typography variant="caption" display="block">
                        {getDetailLabel('bsNumber')}: {formatEventValue('bsNumber', bsNumberStr)}
                    </Typography>
                    <Typography variant="caption" display="block">
                        {getDetailLabel('status')}: {formatEventValue('status', statusStr)}
                    </Typography>
                    <Typography variant="caption" display="block">
                        {getDetailLabel('priority')}: {formatEventValue('priority', priorityStr)}
                    </Typography>
                </>
            );
        }

        if (ev.action === 'status_changed_assigned') {
            const executorStr = getDetailString(d, 'executorName');
            const executorEmailStr = getDetailString(d, 'executorEmail');

            let statusLine: string | null = null;
            const maybeStatus = d.status;
            if (
                maybeStatus &&
                typeof maybeStatus === 'object' &&
                ('from' in (maybeStatus as Record<string, unknown>) ||
                    'to' in (maybeStatus as Record<string, unknown>))
            ) {
                const st = maybeStatus as { from?: unknown; to?: unknown };
                statusLine = `${getDetailLabel('status')}: ${formatEventValue(
                    'status',
                    st.from
                )} → ${formatEventValue('status', st.to)}`;
            }

            return (
                <>
                    <Typography variant="caption" display="block">
                        {getDetailLabel('executorName')}: {formatEventValue(
                            'executorName',
                            executorStr
                        )}
                    </Typography>
                    {executorEmailStr !== '—' && (
                        <Typography variant="caption" display="block">
                            {getDetailLabel('executorEmail')}: {executorEmailStr}
                        </Typography>
                    )}
                    {statusLine && (
                        <Typography variant="caption" display="block">
                            {statusLine}
                        </Typography>
                    )}
                </>
            );
        }

        if (ev.action === 'updated') {
            if (!isManager) {
                return (
                    <Typography variant="caption" display="block">
                        {t('tasks.events.managerOnly', 'Детали изменений доступны менеджеру')}
                    </Typography>
                );
            }
            if (isExecutorRemovedEvent(ev)) {
                const st = d.status;
                let statusLine: string | null = null;
                if (
                    st &&
                    typeof st === 'object' &&
                    ('from' in (st as Record<string, unknown>) || 'to' in (st as Record<string, unknown>))
                ) {
                    const ch = st as Change;
                    statusLine = `${getDetailLabel('status')}: ${formatEventValue(
                        'status',
                        ch.from
                    )} → ${formatEventValue('status', ch.to)}`;
                }

                return (
                    <>
                        <Typography variant="caption" display="block">
                            {getDetailLabel('executorName')}: {t('common.empty', '—')}
                        </Typography>
                        {statusLine && (
                            <Typography variant="caption" display="block">
                                {statusLine}
                            </Typography>
                        )}
                    </>
                );
            }

            return Object.entries(d).map(([key, value]) => {
                if (isChange(value)) {
                    return (
                        <Typography key={key} variant="caption" display="block">
                            {getDetailLabel(key)}: {formatEventValue(key, value.from)} →{' '}
                            {formatEventValue(key, value.to)}
                        </Typography>
                    );
                }
                return (
                    <Typography key={key} variant="caption" display="block">
                        {getDetailLabel(key)}: {formatEventValue(key, value)}
                    </Typography>
                );
            });
        }

        return Object.entries(d).map(([key, value]) => (
            <Typography key={key} variant="caption" display="block">
                {getDetailLabel(key)}: {formatEventValue(key, value)}
            </Typography>
        ));
    };

    const getHasPhotoReport = React.useCallback((target: Task | null | undefined) => {
        if (target?.taskType === 'document') return false;
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
    const showReportActions =
        task?.taskType !== 'document' &&
        ['Done', 'Pending', 'Issues', 'Fixed', 'Agreed'].includes(task?.status ?? '');
    const isReportReadOnly = task?.taskType !== 'document' && (task?.status ?? '') === 'Agreed';
    const shouldFocusIssues = searchParams?.get('focus') === 'issues';
    const reportSummaryItems = React.useMemo(() => {
        if (task?.taskType === 'document') return [];
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
    }, [reportSummaries, task?.photoReports, task?.taskType]);

    const orgTasksHref = React.useMemo(() => {
        if (task?.projectKey && task?.orgId) {
            return `/org/${encodeURIComponent(task.orgId)}/projects/${encodeURIComponent(
                task.projectKey
            )}/tasks`;
        }
        return '/tasks';
    }, [task?.orgId, task?.projectKey]);

    const taskTitleLine = task?.taskName || task?.taskId || t('tasks.defaultName', 'Задача');
    const guideText = t('tasks.guide.upload', 'Нажмите для загрузки фотоотчета по задаче {task}{base}', {
        task: taskTitleLine,
        base: bsNumberDisplay !== t('common.empty', '—') ? ` ${bsNumberDisplay}` : '',
    });

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
                        {task?.workItems?.map((item: WorkItem, idx) => (
                            <TableRow key={`work-${idx}`}>
                                <TableCell sx={{ minWidth: 180 }}>{item.workType || t('common.empty', '—')}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    {Number.isFinite(item.quantity) ? item.quantity : t('common.empty', '—')}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.unit || t('common.empty', '—')}</TableCell>
                                <TableCell>{item.note || t('common.empty', '—')}</TableCell>
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
            setDecisionError(t('tasks.error.missingId', 'Не найден идентификатор задачи'));
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
                setDecisionError(data.error || t('tasks.error.update', 'Не удалось обновить задачу'));
                return;
            }

            setTask((prev) => {
                const updated = data.task as Task;
                return prev ? { ...prev, ...updated } : updated;
            });
            await loadTask();
            setPendingDecision(null);
        } catch (e) {
            setDecisionError(e instanceof Error ? e.message : t('tasks.error.unknown', 'Неизвестная ошибка'));
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
            setCompleteError(t('tasks.error.missingId', 'Не найден идентификатор задачи'));
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
                body: JSON.stringify({ status: 'Done', workCompletionDate: new Date().toISOString() }),
            });
            const data = (await res.json()) as { task?: Task; error?: string };
            if (!res.ok || !data.task) {
                setCompleteError(data.error || t('tasks.error.complete', 'Не удалось завершить задачу'));
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
            setCompleteError(e instanceof Error ? e.message : t('tasks.error.unknown', 'Неизвестная ошибка'));
        } finally {
            setCompleteLoading(false);
        }
    }, [getHasPhotoReport, taskId, t]);

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
                    {t('common.retry', 'Повторить')}
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
                <Typography gutterBottom>{t('tasks.notFound', 'Задача не найдена')}</Typography>
                <Button
                    variant="text"
                    onClick={() => router.push('/tasks')}
                    startIcon={<ArrowBackIcon />}
                    sx={{ borderRadius: UI_RADIUS.button }}
                >
                    {t('tasks.backToList', 'К списку задач')}
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
                <Typography variant="h6">{t('tasks.restricted.contractorsOnly', 'Страница доступна только подрядчикам')}</Typography>
                <Typography color="text.secondary">
                    {t('tasks.restricted.contractorsHint', 'Пожалуйста, используйте соответствующий личный кабинет.')}
                </Typography>
                    <Button
                        variant="contained"
                        onClick={() => router.push(orgTasksHref)}
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                    {t('tasks.backToList', 'К списку задач')}
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
                <Typography variant="h6">
                    {t('tasks.restricted.executorOnly', 'Задача доступна только назначенному исполнителю')}
                </Typography>
                <Typography color="text.secondary">
                    {t('tasks.restricted.executorHint', 'Для просмотра нужно, чтобы задача была назначена вам.')}
                </Typography>
                <Button
                    variant="contained"
                    onClick={() => router.push('/tasks')}
                    sx={{ borderRadius: UI_RADIUS.button }}
                >
                    {t('tasks.backToList', 'К списку задач')}
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
                        <Tooltip title={t('common.back', 'Назад')}>
                            <IconButton onClick={() => router.back()} sx={getIconButtonSx()}>
                                <ArrowBackIcon />
                            </IconButton>
                        </Tooltip>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.75 }}>
                                <Typography variant="h6" sx={{ wordBreak: 'break-word', minWidth: 0 }}>
                                    {task.taskName || t('tasks.defaultName', 'Задача')}
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
                                {documentStatusHint && (
                                    <Tooltip title={documentStatusHint}>
                                        <Chip
                                            icon={<InfoOutlinedIcon fontSize="small" />}
                                            label={t('task.document.status.hint', 'Статус документации')}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Tooltip>
                                )}
                            </Stack>

                            {(task.projectName || task.projectKey) && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0 }}
                                >
                                    {t('tasks.project', 'Проект:')}{' '}
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
                                {t('market.details.info', 'Информация')}
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />

                            <Stack spacing={1}>
                                <Typography variant="body1">
                                    <strong>{t('market.details.base', 'Базовая станция:')}</strong> {bsNumberDisplay}
                                </Typography>

                                <Typography variant="body1">
                                    <strong>{t('market.details.address', 'Адрес:')}</strong>{' '}
                                    {task.bsAddress || t('tasks.addressMissing', 'Адрес не указан')}
                                </Typography>

                                <Typography variant="body1">
                                    <strong>{t('tasks.dueDate', 'Срок:')}</strong>{' '}
                                    {task.dueDate ? formatDate(task.dueDate) : t('common.empty', '—')}
                                </Typography>
                                {task.workCompletionDate && (
                                    <Typography variant="body1">
                                        <strong>{t('tasks.completedAt', 'Дата завершения:')}</strong>{' '}
                                        {formatDate(task.workCompletionDate)}
                                    </Typography>
                                )}
                                <Typography
                                    variant="body1"
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.75,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <strong>{t('market.details.priority', 'Приоритет:')}</strong>
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
                                        <span>{task.priority || t('common.empty', '—')}</span>
                                    </Box>
                                </Typography>

                                <Typography variant="body1">
                                    <strong>{t('tasks.cost', 'Стоимость:')}</strong> {renderCost()}
                                </Typography>
                                <Typography variant="body1">
                                    <strong>{t('market.details.taskType', 'Тип задачи:')}</strong>{' '}
                                    {task.taskType || t('common.empty', '—')}
                                </Typography>

                                {authorDisplayName && (
                                    <Typography variant="body1">
                                        <strong>{t('tasks.author', 'Автор:')}</strong>{' '}
                                        {task.authorId ? (
                                            <Button
                                                variant="text"
                                                size="small"
                                                onClick={() => openProfileDialog(task.authorId)}
                                                sx={{
                                                    textTransform: 'none',
                                                    px: 0,
                                                    minWidth: 0,
                                                    fontSize: 'inherit',
                                                    fontWeight: 'inherit',
                                                lineHeight: 'inherit',
                                                color: 'primary.main',
                                            }}
                                        >
                                                {authorDisplayName}
                                            </Button>
                                        ) : (
                                            authorDisplayName
                                        )}
                                    </Typography>
                                )}

                                {(task.initiatorName || task.initiatorEmail) && (
                                    <Typography variant="body1">
                                        <strong>{t('tasks.initiator', 'Инициатор:')}</strong>{' '}
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
                                        <strong>{t('tasks.createdAt', 'Создана:')}</strong>{' '}
                                        {task.createdAt ? formatDate(task.createdAt) : t('common.empty', '—')}
                                    </Typography>
                                    <Typography variant="body1">
                                        <strong>{t('tasks.updatedAt', 'Обновлена:')}</strong>{' '}
                                        {task.updatedAt ? formatDateTime(task.updatedAt) : t('common.empty', '—')}
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
                                                {t('tasks.decisions.accept', 'Принять')}
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
                                                {t('tasks.decisions.reject', 'Отказать')}
                                            </Button>
                                        </Stack>
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
                                            {t('tasks.complete', 'Завершено')}
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
                                {t('reports.list.title', 'Фотоотчеты')}
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
                                        {isReportReadOnly
                                            ? t('tasks.reports.view', 'Посмотреть отчет')
                                            : t('tasks.reports.upload', 'Загрузить фото')}
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
                                {t('tasks.related', 'Связанные задачи')}
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
                                {t('market.details.description', 'Описание')}
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{task.taskDescription}</Typography>
                        </CardItem>
                    )}

                    {hasDocumentInputs && (
                        <CardItem sx={{ minWidth: 0 }}>
                            <Typography
                                variant="body1"
                                fontWeight={600}
                                gutterBottom
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <DescriptionOutlinedIcon fontSize="small" />
                                {t('task.document.inputs.title', 'Исходные данные для документации')}
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            <Stack spacing={1.5}>
                                {task?.documentInputNotes && (
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            {t('task.document.inputs.notes', 'Техническое задание / примечания')}
                                        </Typography>
                                        <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                                            {task.documentInputNotes}
                                        </Typography>
                                    </Box>
                                )}
                                {documentStages.length > 0 && (
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            {t('task.document.inputs.stages', 'Этапы / стадии')}
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            {documentStages.map((stage, idx) => (
                                                <Typography key={`${stage}-${idx}`}>• {stage}</Typography>
                                            ))}
                                        </Stack>
                                    </Box>
                                )}
                                {documentInputLinks.length > 0 && (
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            {t('task.document.inputs.links', 'Ссылки на исходные материалы')}
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            {documentInputLinks.map((link, idx) => (
                                                <Link key={`${link}-${idx}`} href={link} target="_blank" rel="noreferrer">
                                                    {link}
                                                </Link>
                                            ))}
                                        </Stack>
                                    </Box>
                                )}
                                {documentInputPhotos.length > 0 && (
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary">
                                            {t('task.document.inputs.photos', 'Фото / архивы / ссылки на сервер')}
                                        </Typography>
                                        <Stack spacing={0.5}>
                                            {documentInputPhotos.map((link, idx) => (
                                                <Link key={`${link}-${idx}`} href={link} target="_blank" rel="noreferrer">
                                                    {link}
                                                </Link>
                                            ))}
                                        </Stack>
                                    </Box>
                                )}
                            </Stack>
                        </CardItem>
                    )}

                    {task?.taskType === 'document' && normalizedStatus === 'Done' && (
                        <CardItem sx={{ minWidth: 0 }}>
                            <Typography
                                variant="body1"
                                fontWeight={600}
                                gutterBottom
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <DescriptionOutlinedIcon fontSize="small" />
                                {t('task.document.review.title', 'Согласование документации')}
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            <DocumentReviewTaskPanel taskId={task.taskId} />
                        </CardItem>
                    )}
                    {shouldShowAgreedDocsBlock && (
                        <CardItem sx={{ minWidth: 0 }}>
                            <Typography
                                variant="body1"
                                fontWeight={600}
                                gutterBottom
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <DescriptionOutlinedIcon fontSize="small" />
                                {t('task.document.agreed.title', 'Согласованная документация')}
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            {agreedDocsLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : agreedDocsError ? (
                                <Typography color="error.main">{agreedDocsError}</Typography>
                            ) : agreedDocsFiles.length === 0 ? (
                                <Typography color="text.secondary">
                                    {t('task.document.agreed.empty', 'В согласованном пакете пока нет файлов')}
                                </Typography>
                            ) : (
                                <Stack spacing={1.25}>
                                    <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        alignItems={{ xs: 'stretch', sm: 'center' }}
                                        justifyContent="space-between"
                                        gap={1}
                                    >
                                        <Typography variant="body2" color="text.secondary">
                                            {t('task.document.agreed.version', 'Пакет версии v{version}', {
                                                version: agreedDocsVersion || 1,
                                            })}
                                        </Typography>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={handleDownloadAgreedDocsArchive}
                                            disabled={agreedDocsArchiveLoading}
                                        >
                                            {agreedDocsArchiveLoading
                                                ? t('task.document.agreed.archiveLoading', 'Скачиваем...')
                                                : t('task.document.agreed.archiveDownload', 'Скачать архивом')}
                                        </Button>
                                    </Stack>
                                    <Stack spacing={1}>
                                        {agreedDocsFiles.map((fileUrl, index) => (
                                            <Stack
                                                key={`${fileUrl}-${index}`}
                                                direction={{ xs: 'column', sm: 'row' }}
                                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                                                justifyContent="space-between"
                                                gap={1}
                                                sx={{
                                                    p: 1.25,
                                                    borderRadius: 1,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                }}
                                            >
                                                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                                    {extractFileNameFromUrl(
                                                        fileUrl,
                                                        t('task.documents.documentNumber', 'Документ {index}', {
                                                            index: index + 1,
                                                        })
                                                    )}
                                                </Typography>
                                                <Stack direction="row" spacing={0.5}>
                                                    <Tooltip title={t('common.open', 'Открыть')}>
                                                        <IconButton
                                                            component="a"
                                                            href={buildDocumentReviewFileUrl(fileUrl)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            size="small"
                                                        >
                                                            <OpenInNewIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={t('common.download', 'Скачать')}>
                                                        <IconButton
                                                            component="a"
                                                            href={buildDocumentReviewFileUrl(fileUrl, true)}
                                                            size="small"
                                                        >
                                                            <CloudDownloadOutlinedIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </Stack>
                                        ))}
                                    </Stack>
                                </Stack>
                            )}
                        </CardItem>
                    )}

                    <CardItem sx={{ minWidth: 0 }}>
                        <TaskGeoLocation locations={task.bsLocation} />
                    </CardItem>

                    {task?.taskType !== 'document' && (hasWorkItems || Array.isArray(task.workItems)) && (
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
                                {t('tasks.attachments', 'Вложения')}
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
                                        {extractFileNameFromUrl(
                                            url,
                                            t('tasks.attachment', 'Вложение {index}', { index: idx + 1 })
                                        )}
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
                                        {t('tasks.comments', 'Комментарии')}
                                    </Typography>

                                    <Tooltip title={t('market.workItems.fullscreen', 'Развернуть на весь экран')}>
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

                    <CardItem sx={{ minWidth: 0 }}>
                        <Accordion disableGutters elevation={0} sx={accordionSx}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
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
                                    {t('tasks.history', 'История')}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={accordionDetailsSx}>
                                <Divider sx={{ mb: 1.5 }} />
                                {sortedEvents.length === 0 ? (
                                    <Typography color="text.secondary" sx={{ pb: 1 }}>
                                        {t('tasks.history.empty', 'История пуста')}
                                    </Typography>
                                ) : (
                                    <Timeline
                                        sx={{
                                            p: 0,
                                            m: 0,
                                            pb: 1,
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
                                                        color={ev.action === 'created' ? 'primary' : 'success'}
                                                    />
                                                    {idx < sortedEvents.length - 1 && <TimelineConnector />}
                                                </TimelineSeparator>
                                                <TimelineContent sx={{ py: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {getEventTitle(ev.action, ev)}
                                                    </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {t('tasks.author', 'Автор:')}{' '}
                                                {(() => {
                                                    const author = getEventAuthorInfo(ev);
                                                    return author.id ? (
                                                        <Button
                                                            variant="text"
                                                            size="small"
                                                            onClick={() => openProfileDialog(author.id)}
                                                            sx={{
                                                                textTransform: 'none',
                                                                px: 0,
                                                                minWidth: 0,
                                                                fontSize: 'inherit',
                                                                fontWeight: 'inherit',
                                                                lineHeight: 'inherit',
                                                                color: 'primary.main',
                                                            }}
                                                        >
                                                            {author.name}
                                                        </Button>
                                                    ) : (
                                                        author.name
                                                    );
                                                })()}
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

            {task.taskType !== 'document' && (
                <PhotoReportUploader
                    open={uploadDialogOpen}
                    onClose={handleCloseUploadDialog}
                    taskId={task.taskId || taskId}
                    taskName={task.taskName}
                    bsLocations={task.bsLocation}
                    photoReports={task.photoReports}
                    onUploaded={() => {
                        void loadTask();
                        void refreshReportSummaries();
                    }}
                    onSubmitted={() => {
                        void loadTask();
                        void refreshReportSummaries();
                    }}
                    readOnly={isReportReadOnly}
                />
            )}

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
                            {t('reports.header.title', 'Фотоотчет')}
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
                            ...dialogPaperSx,
                        },
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, pb: 0.5, color: 'text.primary' }}>
                    {t('tasks.complete.title', 'Завершить задачу?')}
                </DialogTitle>
                <DialogContent sx={{ pt: 1, color: 'text.primary' }}>
                    <Typography variant="body1" sx={{ mb: 1.5 }}>
                        {t(
                            'tasks.complete.confirm',
                            'Подтвердите, что работы по задаче «{task}»{base} завершены. Статус будет изменен на «Выполнено», а участники получат уведомление.',
                            {
                                task: task.taskName || task.taskId || t('tasks.defaultName', 'Задача'),
                                base: bsNumberDisplay !== t('common.empty', '—') ? ` (БС ${bsNumberDisplay})` : '',
                            }
                        )}
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
                            color: isDarkMode ? 'rgba(255,255,255,0.92)' : '#111',
                            background: isDarkMode ? 'rgba(148,163,184,0.16)' : 'rgba(17,17,17,0.06)',
                            '&:hover': {
                                background: isDarkMode ? 'rgba(148,163,184,0.26)' : 'rgba(17,17,17,0.1)',
                            },
                        }}
                    >
                        {t('common.cancel', 'Отмена')}
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
                            color: isDarkMode ? '#ecfff3' : '#0c2d18',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #29c961, #1abf51)',
                            },
                        }}
                    >
                        {completeLoading
                            ? t('tasks.saving', 'Сохранение...')
                            : t('common.confirm', 'Подтвердить')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={!!pendingDecision}
                onClose={closeDecisionDialog}
                slotProps={{
                    paper: {
                        sx: {
                            ...dialogPaperSx,
                        },
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, pb: 0.5, color: 'text.primary' }}>
                    {pendingDecision === 'accept'
                        ? t('tasks.decisions.acceptTitle', 'Принять задачу')
                        : t('tasks.decisions.rejectTitle', 'Отказаться от задачи')}
                </DialogTitle>
                <DialogContent sx={{ pt: 1, color: 'text.primary' }}>
                    <Typography variant="body1" sx={{ mb: 1.5 }}>
                        {pendingDecision === 'accept' ? (
                            <>
                                {t(
                                    'tasks.decisions.acceptText',
                                    'Вы подтверждаете что готовы принять задачу {task}{base}? Срок выполнения -',
                                    {
                                        task: task.taskName || t('tasks.defaultName', 'Задача'),
                                        base: bsNumberDisplay !== t('common.empty', '—') ? ` ${bsNumberDisplay}` : '',
                                    }
                                )}{' '}
                                <Box component="span" sx={{ fontWeight: 700 }}>
                                    {task.dueDate ? formatDate(task.dueDate) : t('common.empty', '—')}
                                </Box>
                                .
                            </>
                        ) : (
                            <>
                                {t(
                                    'tasks.decisions.rejectText',
                                    'Вы уверены что хотите отказаться от задачи {task}{base}?',
                                    {
                                        task: task.taskName || t('tasks.defaultName', 'Задача'),
                                        base: bsNumberDisplay !== t('common.empty', '—') ? ` ${bsNumberDisplay}` : '',
                                    }
                                )}
                            </>
                        )}
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
                            color: isDarkMode ? 'rgba(255,255,255,0.92)' : '#111',
                            background: isDarkMode ? 'rgba(148,163,184,0.16)' : 'rgba(17,17,17,0.06)',
                            '&:hover': {
                                background: isDarkMode ? 'rgba(148,163,184,0.26)' : 'rgba(17,17,17,0.1)',
                            },
                        }}
                    >
                        {t('common.cancel', 'Отмена')}
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
                            color: pendingDecision === 'accept'
                                ? isDarkMode
                                    ? '#ecfff3'
                                    : '#0c2d18'
                                : '#fff',
                            '&:hover': {
                                background:
                                    pendingDecision === 'accept'
                                        ? 'linear-gradient(135deg, #29c961, #1abf51)'
                                        : 'linear-gradient(135deg, #db3c3c, #c12b2b)',
                            },
                        }}
                    >
                        {decisionLoading
                            ? t('tasks.saving', 'Сохранение...')
                            : pendingDecision === 'accept'
                              ? t('tasks.decisions.accept', 'Принять')
                              : t('tasks.decisions.reject', 'Отказать')}
                    </Button>
                </DialogActions>
            </Dialog>

            {task.taskType !== 'document' && (
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
                            {t('market.workItems.title', 'Состав работ')}
                        </Typography>
                        <IconButton onClick={() => setWorkItemsFullScreen(false)}>
                            <CloseFullscreenIcon />
                        </IconButton>
                    </Box>

                    <Box sx={{ p: 2 }}>{renderWorkItemsTable('calc(100vh - 80px)')}</Box>
                </Dialog>
            )}

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
                        {t('tasks.comments', 'Комментарии')}
                    </Typography>
                    <IconButton onClick={() => setCommentsFullScreen(false)}>
                        <CloseFullscreenIcon />
                    </IconButton>
                </Box>

                <Box sx={{ p: 2 }}>{renderCommentsSection('calc(100vh - 80px)')}</Box>
            </Dialog>

            <ProfileDialog
                open={profileOpen}
                onClose={closeProfileDialog}
                clerkUserId={profileUserId}
            />
        </Container>
    );
}
