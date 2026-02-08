// app/org/[org]/projects/[project]/tasks/[taskId]/page.tsx

'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box,
    Stack,
    Typography,
    Paper,
    Chip,
    IconButton,
    Tooltip,
    CircularProgress,
    Button,
    Link,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Snackbar,
    Alert,
    TextField,
    Container,
    Checkbox,
    FormControlLabel,
    type PaperProps,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import GroupsIcon from '@mui/icons-material/Groups';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import TocOutlinedIcon from '@mui/icons-material/TocOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import HistoryIcon from '@mui/icons-material/History';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CasesOutlinedIcon from '@mui/icons-material/CasesOutlined';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import WorkspaceTaskDialog from '@/app/workspace/components/WorkspaceTaskDialog';
import type { TaskForEdit } from '@/app/workspace/components/WorkspaceTaskDialog';
import TaskComments from '@/features/tasks/TaskComments';
import DocumentReviewTaskPanel from '@/features/documents/DocumentReviewTaskPanel';
import type { TaskComment } from '@/features/tasks/TaskComments';
import type { ParsedWorkItem } from '@/app/workspace/components/T2/T2EstimateParser';
import { T2NcwGenerator } from '@/app/workspace/components/T2/T2NcwGenerator';
import { getPriorityIcon, getPriorityLabel, normalizePriority } from '@/utils/priorityIcons';
import TaskGeoLocation from '@/app/workspace/components/TaskGeoLocation';
import type { TaskApplication } from '@/app/types/application';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel, normalizeStatusTitle } from '@/utils/statusLabels';
import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineDot,
    TimelineConnector,
    TimelineContent,
    TimelineOppositeContent,
} from '@mui/lab';
import Masonry from '@mui/lab/Masonry';
import { UI_RADIUS } from '@/config/uiTokens';
import { getOrgPageStyles } from '@/app/org/(protected)/[org]/styles';
import { extractFileNameFromUrl, isDocumentUrl } from '@/utils/taskFiles';
import { normalizeRelatedTasks } from '@/app/utils/relatedTasks';
import type { RelatedTaskRef } from '@/app/types/taskTypes';
import { buildBsAddressFromLocations } from '@/utils/bsLocation';
import ProfileDialog from '@/features/profile/ProfileDialog';
import type { PhotoReport } from '@/app/types/taskTypes';
import { fetchUserContext, resolveRoleFromContext } from '@/app/utils/userContext';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { MANAGER_ROLES } from '@/app/types/roles';
import { useI18n } from '@/i18n/I18nProvider';

type TaskFile = {
    url: string;
    name?: string;
    size?: number;
};

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

type TaskEvent = {
    action: string;
    author: string;
    authorId: string;
    authorEmail?: string;
    date: string;
    details?: TaskEventDetails;
};

type WorkItem = {
    workType?: string;
    quantity?: number;
    unit?: string;
    note?: string;
};

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    projectKey?: string;
    status?: string;
    visibility?: 'public' | 'private';
    publicStatus?: 'open' | 'in_review' | 'assigned' | 'closed';
    publicModerationStatus?: 'pending' | 'approved' | 'rejected';
    publicModerationComment?: string;
    publicModeratedById?: string;
    publicModeratedByName?: string;
    publicModeratedAt?: string;
    bsNumber?: string;
    bsAddress?: string;
    bsLocation?: Array<{ name?: string; coordinates: string; address?: string | null }>;
    totalCost?: number;
    budget?: number | null;
    publicDescription?: string;
    currency?: string;
    applicationCount?: number;
    acceptedApplicationId?: string;
    allowInstantClaim?: boolean;
    contractorPayment?: number;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    dueDate?: string;
    taskType?: string;
    orderUrl?: string;
    orderNumber?: string;
    orderDate?: string;
    orderSignDate?: string;
    taskDescription?: string;
    createdAt?: string;
    updatedAt?: string;
    authorId?: string;
    authorName?: string;
    authorEmail?: string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
    initiatorName?: string;
    initiatorEmail?: string;
    files?: TaskFile[];
    attachments?: string[];
    documents?: string[];
    ncwUrl?: string;
    workCompletionDate?: string;
    events?: TaskEvent[];
    workItems?: WorkItem[];
    comments?: TaskComment[];
    relatedTasks?: RelatedTaskRef[];
    photoReports?: PhotoReport[];
    documentInputNotes?: string;
    documentInputLinks?: string[];
    documentInputPhotos?: string[];
    documentStages?: string[];
    documentReviewFiles?: string[];
    documentFinalFiles?: string[];
    documentFinalFormats?: string[];
};

type DocumentItem = {
    url: string;
    type: 'estimate' | 'order' | 'other' | 'ncw';
    label: string;
};

type NcwDefaults = {
    orderNumber?: string | null;
    orderDate?: string | null;
    orderSignDate?: string | null;
    completionDate?: string | null;
    bsNumber?: string | null;
    address?: string | null;
};

const TASK_SECTION_KEYS = [
    'info',
    'applications',
    'description',
    'geo',
    'work',
    'attachments',
    'photoReports',
    'documents',
    'order',
    'comments',
    'history',
    'related',
] as const;

type TaskSectionKey = (typeof TASK_SECTION_KEYS)[number];

const TASK_SECTION_STORAGE_KEY = 'task-section-visibility';

export default function TaskDetailsPage() {
    const { t, locale } = useI18n();
    const params = useParams<{ org: string; project: string; taskId: string }>() as {
        org: string;
        project: string;
        taskId: string;
    };

    const router = useRouter();
    const theme = useTheme();
    const { masonryCardSx, cardBaseSx, cardBorder } = getOrgPageStyles(theme);
    const isDarkMode = theme.palette.mode === 'dark';
    const formatLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
    const taskSectionLabels = React.useMemo(
        () => ({
            info: t('task.sections.info', 'Информация'),
            applications: t('task.sections.applications', 'Отклики'),
            description: t('task.sections.description', 'Описание'),
            geo: t('task.sections.geo', 'Геолокация'),
            work: t('task.sections.work', 'Состав работ'),
            attachments: t('task.sections.attachments', 'Вложения'),
            photoReports: t('task.sections.photoReports', 'Фотоотчеты'),
            documents: t('task.sections.documents', 'Документы'),
            order: t('task.sections.order', 'Заказ'),
            comments: t('task.sections.comments', 'Комментарии'),
            history: t('task.sections.history', 'История'),
            related: t('task.sections.related', 'Связанные задачи'),
        }),
        [t]
    );
    const iconBorderColor = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.12)';
    const iconBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
    const iconHoverBg = isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)';
    const iconShadow = isDarkMode ? '0 6px 18px rgba(0,0,0,0.4)' : '0 6px 18px rgba(15,23,42,0.08)';
    const iconText = isDarkMode ? '#f8fafc' : '#0f172a';
    const iconActiveBg = isDarkMode ? 'rgba(59,130,246,0.4)' : 'rgba(15,23,42,0.9)';
    const iconActiveText = '#ffffff';
    const disabledIconColor = isDarkMode ? 'rgba(148,163,184,0.7)' : 'rgba(15,23,42,0.35)';
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

    const pageGutter = { xs: 0.25, sm: 2.5, md: 3, lg: 3.5, xl: 4 };
    const masonrySpacing = { xs: 0.5, sm: 1.5, md: 2 } as const;

    const org = params.org?.trim();
    const project = params.project?.trim();
    const taskId = params.taskId?.trim();

    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [task, setTask] = React.useState<Task | null>(null);
    const taskMongoId = task?._id || '';

    const [editOpen, setEditOpen] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [deleteReports, setDeleteReports] = React.useState(true);
    const [deleteDocuments, setDeleteDocuments] = React.useState(true);
    const [deleteDocumentOpen, setDeleteDocumentOpen] = React.useState(false);
    const [documentToDelete, setDocumentToDelete] = React.useState<string | null>(null);
    const [documentToDeleteType, setDocumentToDeleteType] = React.useState<
        'estimate' | 'order' | 'other' | 'ncw' | null
    >(null);
    const [documentDeleting, setDocumentDeleting] = React.useState(false);
    const [publishLoading, setPublishLoading] = React.useState(false);
    const [publishSnack, setPublishSnack] = React.useState<{
        open: boolean;
        message: string;
        sev: 'success' | 'error';
    }>({ open: false, message: '', sev: 'success' });
    const [profileDialogOpen, setProfileDialogOpen] = React.useState(false);
    const [profileClerkUserId, setProfileClerkUserId] = React.useState<string | null>(
        null
    );
    const [currentUserId, setCurrentUserId] = React.useState('');
    const [userRole, setUserRole] = React.useState<EffectiveOrgRole | null>(null);

    const [orgName, setOrgName] = React.useState<string | null>(null);
    const [projectOperator, setProjectOperator] = React.useState<string | null>(null);
    const [projectKey, setProjectKey] = React.useState<string | null>(null);
    const [workItemsFullScreen, setWorkItemsFullScreen] = React.useState(false);
    const [commentsFullScreen, setCommentsFullScreen] = React.useState(false);
    const [documentDialogOpen, setDocumentDialogOpen] = React.useState(false);
    const [selectedDocumentType, setSelectedDocumentType] = React.useState<'order' | null>(null);
    const [orderNumberInput, setOrderNumberInput] = React.useState('');
    const [orderDateInput, setOrderDateInput] = React.useState('');
    const [orderSignDateInput, setOrderSignDateInput] = React.useState('');
    const [orderFile, setOrderFile] = React.useState<File | null>(null);
    const [orderDragActive, setOrderDragActive] = React.useState(false);
    const [orderUploading, setOrderUploading] = React.useState(false);
    const [orderFormError, setOrderFormError] = React.useState<string | null>(null);
    const [ncwDialogOpen, setNcwDialogOpen] = React.useState(false);
    const [ncwDefaults, setNcwDefaults] = React.useState<NcwDefaults | null>(null);
    const [documentSnackbar, setDocumentSnackbar] = React.useState<{
        type: 'success' | 'error';
        message: string;
    } | null>(null);
    const [sectionDialogOpen, setSectionDialogOpen] = React.useState(false);
    const [visibleSections, setVisibleSections] = React.useState<TaskSectionKey[]>([
        ...TASK_SECTION_KEYS,
    ]);
    const [publishDialogOpen, setPublishDialogOpen] = React.useState(false);
    const [publishBudgetInput, setPublishBudgetInput] = React.useState('');
    const [publishInfoInput, setPublishInfoInput] = React.useState('');
    const [publishDialogError, setPublishDialogError] = React.useState<string | null>(null);
    const [applications, setApplications] = React.useState<TaskApplication[]>([]);
    const [applicationsLoading, setApplicationsLoading] = React.useState(false);
    const [applicationsError, setApplicationsError] = React.useState<string | null>(null);
    const [applicationActionLoading, setApplicationActionLoading] = React.useState<string | null>(
        null
    );
    const [agreedDocsLoading, setAgreedDocsLoading] = React.useState(false);
    const [agreedDocsError, setAgreedDocsError] = React.useState<string | null>(null);
    const [agreedDocsVersion, setAgreedDocsVersion] = React.useState<number>(0);
    const [agreedDocsFiles, setAgreedDocsFiles] = React.useState<string[]>([]);
    const [agreedDocsArchiveLoading, setAgreedDocsArchiveLoading] = React.useState(false);
    const [applicationConfirm, setApplicationConfirm] = React.useState<{
        open: boolean;
        applicationId: string | null;
        action: 'assign' | 'unassign' | null;
        contractorName?: string | null;
    }>({
        open: false,
        applicationId: null,
        action: null,
        contractorName: null,
    });
    const [applicationSnack, setApplicationSnack] = React.useState<{
        open: boolean;
        message: string;
        sev: 'success' | 'error';
    }>({ open: false, message: '', sev: 'success' });
    const orderFileInputRef = React.useRef<HTMLInputElement | null>(null);

    const asText = (x: unknown): string => {
        if (x === null || typeof x === 'undefined') return '—';
        if (typeof x === 'string') {
            const d = new Date(x);
            if (!Number.isNaN(d.getTime())) return d.toLocaleString(formatLocale);
        }
        return String(x);
    };

    const formatDate = (v?: string | Date) => {
        if (!v) return '—';
        const d = v instanceof Date ? v : new Date(v);
        if (Number.isNaN(d.getTime())) return typeof v === 'string' ? v : '—';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    };

    const formatDateTime = (v?: string) => {
        if (!v) return '—';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return v;
        return d.toLocaleString(formatLocale);
    };

    const toInputDate = (v?: string) => {
        if (!v) return '';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return '';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${yyyy}-${mm}-${dd}`;
    };

    const formatPrice = (v?: number | null) => {
        if (typeof v !== 'number' || Number.isNaN(v)) return '—';
        return new Intl.NumberFormat(formatLocale).format(v) + ' ₽';
    };

    const addDays = (v: string, days: number): Date | null => {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return null;
        const result = new Date(d);
        result.setDate(result.getDate() + days);
        return result;
    };

    const load = React.useCallback(async () => {
        if (!org || !project || !taskId) return;
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                    project
                )}/tasks/${encodeURIComponent(taskId)}`,
                { cache: 'no-store' }
            );
            const data = (await res.json()) as { task?: Task; error?: string };
            if (!res.ok || !data.task) {
                setError(
                    data.error ||
                        t('task.error.load', 'Не удалось загрузить задачу ({status})', {
                            status: res.status,
                        })
                );
                setTask(null);
            } else {
                setTask(data.task);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : t('common.networkError', 'Ошибка сети'));
            setTask(null);
        } finally {
            setLoading(false);
        }
    }, [org, project, taskId, t]);

    const loadOrg = React.useCallback(async () => {
        if (!org) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}`, {
                cache: 'no-store',
            });
            if (!res.ok) return;
            const data = (await res.json()) as { org?: { name?: string } };
            if (data.org?.name) {
                setOrgName(data.org.name);
            }
        } catch {
            // ignore
        }
    }, [org]);

    const loadProjectOperator = React.useCallback(async () => {
        if (!org || !project) return;
        try {
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}`,
                { cache: 'no-store' }
            );
            if (!res.ok) {
                setProjectOperator(null);
                return;
            }
            const data = (await res.json()) as { project?: { operator?: string; key?: string } };
            setProjectOperator(data.project?.operator ?? null);
            setProjectKey(data.project?.key ?? null);
        } catch {
            setProjectOperator(null);
            setProjectKey(null);
        }
    }, [org, project]);

    const fetchApplications = React.useCallback(async () => {
        if (!taskMongoId) return;
        setApplicationsLoading(true);
        setApplicationsError(null);
        try {
            const res = await fetch(`/api/tasks/${taskMongoId}/applications`, {
                cache: 'no-store',
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) {
                setApplications([]);
                setApplicationsError(
                    data.error || t('task.applications.error.load', 'Не удалось загрузить отклики')
                );
                return;
            }
            setApplications(Array.isArray(data.applications) ? data.applications : []);
        } catch (e) {
            setApplications([]);
            setApplicationsError(
                e instanceof Error
                    ? e.message
                    : t('task.applications.error.load', 'Не удалось загрузить отклики')
            );
        } finally {
            setApplicationsLoading(false);
        }
    }, [taskMongoId, t]);

    const handlePublishToggle = React.useCallback(
        async (
            makePublic: boolean,
            payload?: { budget?: number | null; publicDescription?: string }
        ) => {
            if (!taskId) return false;
            setPublishLoading(true);
            try {
                const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/publish`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                        makePublic
                            ? {
                                visibility: 'public',
                                publicStatus: 'open',
                                budget: payload?.budget,
                                publicDescription: payload?.publicDescription,
                            }
                            : { visibility: 'private', publicStatus: 'closed' }
                    ),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || data.error) {
                    setPublishSnack({
                        open: true,
                        sev: 'error',
                        message:
                            data.error ||
                            t('task.publish.error.update', 'Не удалось обновить публикацию'),
                    });
                    return false;
                }
                const updatedTask = data.task as Task | undefined;
                const moderationPending =
                    Boolean(updatedTask?.publicModerationStatus === 'pending') &&
                    updatedTask?.visibility !== 'public';
                setPublishSnack({
                    open: true,
                    sev: 'success',
                    message: makePublic
                        ? moderationPending
                            ? t(
                                'task.publish.moderationSent',
                                'Задача отправлена на модерацию. Задача будет опубликована после прохождения модерации'
                            )
                            : t('task.publish.published', 'Задача опубликована')
                        : t('task.publish.unpublished', 'Публикация снята'),
                });
                await load();
                return true;
            } catch (e) {
                setPublishSnack({
                    open: true,
                    sev: 'error',
                    message: e instanceof Error ? e.message : t('common.networkError', 'Ошибка сети'),
                });
                return false;
            } finally {
                setPublishLoading(false);
            }
        },
        [taskId, load, t]
    );

    const openProfileDialog = (clerkUserId?: string | null) => {
        if (!clerkUserId) return;
        setProfileClerkUserId(String(clerkUserId));
        setProfileDialogOpen(true);
    };

    const closeProfileDialog = () => {
        setProfileDialogOpen(false);
        setProfileClerkUserId(null);
    };

    React.useEffect(() => {
        void load();
    }, [load]);

    React.useEffect(() => {
        const fetchUser = async () => {
            try {
                const ctx = await fetchUserContext();
                const clerkId =
                    (ctx?.user as { clerkUserId?: string; id?: string } | undefined)
                        ?.clerkUserId ||
                    (ctx?.user as { id?: string } | undefined)?.id ||
                    '';
                setCurrentUserId(clerkId);
                setUserRole(resolveRoleFromContext(ctx));
            } catch {
                setCurrentUserId('');
                setUserRole(null);
            }
        };
        void fetchUser();
    }, []);

    React.useEffect(() => {
        void loadOrg();
    }, [loadOrg]);

    React.useEffect(() => {
        void loadProjectOperator();
    }, [loadProjectOperator]);

    React.useEffect(() => {
        if (task?.visibility === 'public') {
            void fetchApplications();
        } else {
            setApplications([]);
        }
    }, [task?.visibility, fetchApplications]);

    React.useEffect(() => {
        const stored =
            typeof window !== 'undefined'
                ? localStorage.getItem(TASK_SECTION_STORAGE_KEY)
                : null;
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    const valid = parsed.filter((key): key is TaskSectionKey =>
                        TASK_SECTION_KEYS.includes(key)
                    );
                    const missing = TASK_SECTION_KEYS.filter((key) => !valid.includes(key));
                    setVisibleSections([...valid, ...missing]);
                }
            } catch {
                // ignore corrupted storage
            }
        }
    }, []);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(TASK_SECTION_STORAGE_KEY, JSON.stringify(visibleSections));
    }, [visibleSections]);

    const handleSectionToggle = (section: TaskSectionKey) => {
        setVisibleSections((prev) =>
            prev.includes(section) ? prev.filter((item) => item !== section) : [...prev, section]
        );
    };

    const handleSelectAllSections = () => {
        setVisibleSections([...allowedSections]);
    };

    const handleClearSections = () => {
        setVisibleSections([]);
    };

    const allowedSections = React.useMemo<TaskSectionKey[]>(() => {
        if (task?.taskType === 'document') {
            return TASK_SECTION_KEYS.filter(
                (key) => key !== 'work' && key !== 'photoReports'
            ) as TaskSectionKey[];
        }
        return [...TASK_SECTION_KEYS];
    }, [task?.taskType]);

    React.useEffect(() => {
        setVisibleSections((prev) => prev.filter((section) => allowedSections.includes(section)));
    }, [allowedSections]);

    const isSectionVisible = React.useCallback(
        (section: TaskSectionKey) =>
            allowedSections.includes(section) && visibleSections.includes(section),
        [allowedSections, visibleSections]
    );

    const hasCustomVisibility = React.useMemo(
        () => allowedSections.some((key) => !visibleSections.includes(key)),
        [allowedSections, visibleSections]
    );

    const attachmentLinks = React.useMemo(
        () =>
            Array.isArray(task?.attachments)
                ? task.attachments.filter((url) => !isDocumentUrl(url))
                : [],
        [task]
    );

    const documentLinks = React.useMemo(
        () => {
            const docs = Array.isArray(task?.documents) ? task.documents : [];
            const docsFromAttachments = Array.isArray(task?.attachments)
                ? task.attachments.filter((url) => isDocumentUrl(url))
                : [];
            const urls: string[] = [...docs, ...docsFromAttachments];
            if (task?.ncwUrl) {
                urls.push(task.ncwUrl);
            }
            return Array.from(new Set(urls));
        },
        [task]
    );

    const documentItems = React.useMemo(() => {
        const items: DocumentItem[] = [];
        const seen = new Set<string>();

        const formatNcwFileName = (url: string) => {
            const noticePrefix = t('task.documents.notice', 'Уведомление');
            const escapedPrefix = noticePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const raw = extractFileNameFromUrl(
                url,
                task?.orderNumber ? `${noticePrefix}_${task.orderNumber}` : noticePrefix
            );
            return raw
                .replace(new RegExp(`^${escapedPrefix}[_-]?`, 'i'), '')
                .replace(/^У[Оо][Рр][_-]?/u, '')
                .trim() || raw;
        };

        documentLinks.forEach((url, idx) => {
            const isOrder = task?.orderUrl && url === task.orderUrl;
            const isNcw = task?.ncwUrl && url === task.ncwUrl;
            const type: DocumentItem['type'] =
                isOrder ? 'order' : isNcw ? 'ncw' : idx === 0 ? 'estimate' : 'other';
            const fallback =
                type === 'estimate'
                    ? t('task.documents.estimate', 'Смета')
                    : type === 'order'
                        ? task?.orderNumber || t('task.documents.order', 'Заказ')
                        : type === 'ncw'
                            ? t('task.documents.notice', 'Уведомление')
                            : t('task.documents.documentNumber', 'Документ {index}', {
                                index: idx + 1,
                            });
            items.push({
                url,
                type,
                label:
                    type === 'order'
                        ? `${t('task.documents.order', 'Заказ')} — ${
                            task?.orderNumber || extractFileNameFromUrl(url, fallback)
                        }`
                        : type === 'estimate'
                            ? extractFileNameFromUrl(url, t('task.documents.estimate', 'Смета'))
                            : type === 'ncw'
                                ? `${t('task.documents.notice', 'Уведомление')} — ${formatNcwFileName(url)}`
                                : extractFileNameFromUrl(url, fallback),
            });
            seen.add(url);
        });

        if (task?.orderUrl && !seen.has(task.orderUrl)) {
            items.push({
                url: task.orderUrl,
                type: 'order',
                label: `${t('task.documents.order', 'Заказ')} — ${
                    task.orderNumber || t('task.documents.orderFile', 'файл заказа')
                }`,
            });
        }
        if (task?.ncwUrl && !seen.has(task.ncwUrl)) {
            items.push({
                url: task.ncwUrl,
                type: 'ncw',
                label: `${t('task.documents.notice', 'Уведомление')} — ${formatNcwFileName(task.ncwUrl)}`,
            });
        }

        return items;
    }, [documentLinks, task?.ncwUrl, task?.orderNumber, task?.orderUrl, t]);

    const hasWorkItems =
        task?.taskType !== 'document' && Array.isArray(task?.workItems) && task.workItems.length > 0;
    const hasDocuments = documentItems.length > 0;
    const hasAttachments =
        !!task &&
        ((Array.isArray(task.files) && task.files.length > 0) ||
            attachmentLinks.length > 0);
    const photoReportItems = React.useMemo(() => {
        if (task?.taskType === 'document') return [];
        if (!Array.isArray(task?.photoReports)) return [];
        return task.photoReports
            .map((report) => {
                const filesCount = Array.isArray(report.files) ? report.files.length : 0;
                const fixedCount = Array.isArray(report.fixedFiles) ? report.fixedFiles.length : 0;
                return {
                    baseId: report.baseId,
                    status: report.status,
                    filesCount,
                    fixedCount,
                    totalCount: filesCount + fixedCount,
                };
            })
            .filter((report) => report.baseId && report.totalCount > 0)
            .sort((a, b) => a.baseId.localeCompare(b.baseId));
    }, [task?.photoReports, task?.taskType]);
    const hasPhotoReports = task?.taskType !== 'document' && photoReportItems.length > 0;

    const orderCompletionDate = React.useMemo(() => {
        if (!task?.orderSignDate) return null;
        return addDays(task.orderSignDate, 60);
    }, [task?.orderSignDate]);

    const relatedTasks = React.useMemo(
        () => normalizeRelatedTasks(task?.relatedTasks),
        [task?.relatedTasks]
    );
    const isManager = Boolean(userRole && MANAGER_ROLES.includes(userRole));

    const documentInputLinks = Array.isArray(task?.documentInputLinks) ? task.documentInputLinks : [];
    const documentInputPhotos = Array.isArray(task?.documentInputPhotos) ? task.documentInputPhotos : [];
    const documentStages = Array.isArray(task?.documentStages) ? task.documentStages : [];
    const hasDocumentInputs =
        task?.taskType === 'document' &&
        (Boolean(task?.documentInputNotes) ||
            documentInputLinks.length > 0 ||
            documentInputPhotos.length > 0 ||
            documentStages.length > 0);
    const normalizedStatus = normalizeStatusTitle(task?.status);
    const shouldShowAgreedDocsBlock = task?.taskType === 'document' && normalizedStatus === 'Agreed';
    const buildDocumentReviewFileUrl = React.useCallback(
        (fileUrl: string, download = false) => {
            const downloadParam = download ? '&download=1' : '';
            return `/api/document-reviews/${encodeURIComponent(
                task?.taskId ?? taskId
            )}/file?url=${encodeURIComponent(fileUrl)}${downloadParam}`;
        },
        [task?.taskId, taskId]
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
                const res = await fetch(
                    `/api/document-reviews/${encodeURIComponent(task.taskId)}`,
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
                          (file): file is string =>
                              typeof file === 'string' && file.trim().length > 0
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
    }, [shouldShowAgreedDocsBlock, task?.taskId, t]);

    const handleDownloadAgreedDocsArchive = React.useCallback(async () => {
        if (!task?.taskId) return;
        try {
            setAgreedDocsArchiveLoading(true);
            setAgreedDocsError(null);
            const res = await fetch(
                `/api/document-reviews/${encodeURIComponent(task.taskId)}/download`,
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
    }, [task?.taskId, t]);

    const toEditWorkItems = (list: Task['workItems']): ParsedWorkItem[] | undefined => {
        if (!Array.isArray(list)) return undefined;
        const cleaned: ParsedWorkItem[] = [];
        list.forEach((wi) => {
            const workType = typeof wi?.workType === 'string' ? wi.workType.trim() : '';
            const unit = typeof wi?.unit === 'string' ? wi.unit.trim() : '';
            const qty = typeof wi?.quantity === 'number' ? wi.quantity : Number(wi?.quantity);
            if (!workType || !unit || !Number.isFinite(qty)) return;
            const note =
                typeof wi?.note === 'string' && wi.note.trim() ? wi.note.trim() : undefined;
            cleaned.push({ workType, quantity: qty, unit, note });
        });
        return cleaned.length ? cleaned : undefined;
    };

    const toEditShape = (task: Task): TaskForEdit => {
        return {
            _id: task._id,
            taskId: task.taskId,
            taskName: task.taskName,
            status: task.status,
            dueDate: task.dueDate,
            bsNumber: task.bsNumber,
            bsAddress: task.bsAddress,
            taskDescription: task.taskDescription,
            documentInputNotes: task.documentInputNotes,
            documentInputLinks: task.documentInputLinks,
            documentInputPhotos: task.documentInputPhotos,
            documentStages: task.documentStages,
            documentReviewFiles: task.documentReviewFiles,
            documentFinalFiles: task.documentFinalFiles,
            documentFinalFormats: task.documentFinalFormats,
            totalCost: task.totalCost,
            contractorPayment: task.contractorPayment,
            priority: task.priority,
            executorId: task.executorId,
            executorName: task.executorName,
            executorEmail: task.executorEmail,
            workItems: toEditWorkItems(task.workItems),
            files: task.files?.map((f) => ({ name: f.name, url: f.url, size: f.size })),
            attachments: Array.isArray(task.attachments)
                ? task.attachments.filter((url) => !isDocumentUrl(url))
                : task.attachments,
            bsLocation: task.bsLocation
                ? task.bsLocation.map((loc, idx) => ({
                    name:
                        loc.name ??
                        t('task.geo.point', 'Точка {index}', { index: idx + 1 }),
                    coordinates: loc.coordinates,
                }))
                : undefined,
            relatedTasks: task.relatedTasks,
        };
    };

    const handleDelete = async () => {
        if (!org || !project || !taskId) return;
        setDeleting(true);
        try {
            const query = new URLSearchParams({
                deleteReports: deleteReports ? 'true' : 'false',
                deleteDocuments: deleteDocuments ? 'true' : 'false',
            });
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                    project
                )}/tasks/${encodeURIComponent(taskId)}?${query.toString()}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                console.error('Не удалось удалить задачу');
            } else {
                router.back();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDeleting(false);
            setDeleteOpen(false);
        }
    };


    const openDeleteDocumentDialog = (url: string, type: 'estimate' | 'order' | 'other' | 'ncw') => {
        setDocumentToDelete(url);
        setDocumentToDeleteType(type);
        setDeleteDocumentOpen(true);
    };

    const closeDeleteDocumentDialog = () => {
        if (documentDeleting) return;
        setDeleteDocumentOpen(false);
        setDocumentToDelete(null);
        setDocumentToDeleteType(null);
    };

    const confirmDeleteDocument = async () => {
        if (!task?.taskId || !documentToDelete || !documentToDeleteType) return;
        setDocumentDeleting(true);
        try {
            if (documentToDeleteType === 'order' || documentToDeleteType === 'ncw') {
                const query = new URLSearchParams();
                if (documentToDeleteType === 'ncw') {
                    query.set('file', 'ncw');
                }
                const endpoint = `/api/tasks/${encodeURIComponent(task.taskId)}${
                    query.toString() ? `?${query.toString()}` : ''
                }`;
                const res = await fetch(endpoint, {
                    method: 'DELETE',
                });
                let body: unknown = null;
                try {
                    body = await res.json();
                } catch {
                    /* ignore */
                }
                if (!res.ok) {
                    console.error('Не удалось удалить заказ', body);
                } else if (body && typeof body === 'object' && 'task' in body) {
                    const updatedTask = (body as { task: Task | null }).task;
                    if (updatedTask) {
                        setTask(updatedTask);
                    } else {
                        await load();
                    }
                } else {
                    await load();
                }
            } else {
                const q = new URLSearchParams({
                    taskId: task.taskId,
                    url: documentToDelete,
                    mode: 'documents',
                });
                const res = await fetch(`/api/upload?${q.toString()}`, {
                    method: 'DELETE',
                });
                if (!res.ok) {
                    console.error('Не удалось удалить документ');
                } else {
                    setTask((prev) =>
                        prev
                            ? {
                                ...prev,
                                documents: prev.documents?.filter((d) => d !== documentToDelete),
                                attachments: prev.attachments?.filter((a) => a !== documentToDelete),
                            }
                            : prev
                    );
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDocumentDeleting(false);
            setDeleteDocumentOpen(false);
            setDocumentToDelete(null);
            setDocumentToDeleteType(null);
        }
    };

    const openPublishDialog = () => {
        if (!task) return;
        setPublishBudgetInput(
            typeof task.budget === 'number' && Number.isFinite(task.budget)
                ? String(task.budget)
                : ''
        );
        setPublishInfoInput(task.publicDescription || '');
        setPublishDialogError(null);
        setPublishDialogOpen(true);
    };

    const closePublishDialog = () => {
        if (publishLoading) return;
        setPublishDialogOpen(false);
        setPublishDialogError(null);
    };

    const handlePublishSubmit = async () => {
        const budgetRaw = publishBudgetInput.trim();
        let budget: number | null | undefined;
        if (budgetRaw) {
            const num = Number(budgetRaw);
            if (Number.isNaN(num) || num < 0) {
                setPublishDialogError(
                    t('task.publish.error.budget', 'Бюджет должен быть неотрицательным числом')
                );
                return;
            }
            budget = num;
        } else {
            budget = null;
        }

        setPublishDialogError(null);
        const success = await handlePublishToggle(true, {
            budget,
            publicDescription: publishInfoInput.trim(),
        });
        if (success) {
            setPublishDialogOpen(false);
        }
    };

    const prefillOrderFields = React.useCallback(() => {
        setOrderNumberInput(task?.orderNumber || '');
        setOrderDateInput(toInputDate(task?.orderDate));
        setOrderSignDateInput(toInputDate(task?.orderSignDate));
    }, [task?.orderDate, task?.orderNumber, task?.orderSignDate]);

    const doneStatusChangeDate = React.useMemo(() => {
        if (!task?.events) return undefined;
        const chronological = [...task.events].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        for (const ev of chronological) {
            const statusDetail = ev.details?.status;
            if (
                statusDetail &&
                typeof statusDetail === 'object' &&
                ('to' in (statusDetail as Record<string, unknown>) ||
                    'from' in (statusDetail as Record<string, unknown>))
            ) {
                const change = statusDetail as Change;
                if (
                    typeof change.to === 'string' &&
                    change.to.trim().toLowerCase() === 'done'
                ) {
                    const date = new Date(ev.date);
                    if (!Number.isNaN(date.getTime())) {
                        return date.toISOString();
                    }
                }
            }
        }
        return undefined;
    }, [task?.events]);

    const canCreateNcw = projectOperator === '250020';
    const executorAssigned = Boolean(task?.executorId || task?.executorName || task?.executorEmail);
    const publicModerationStatus = task?.publicModerationStatus;
    const isModerationPending = publicModerationStatus === 'pending';
    const isModerationRejected = publicModerationStatus === 'rejected';
    const canUnassignExecutor = ![
        'Done',
        'Pending',
        'Issues',
        'Fixed',
        'Agreed',
    ].includes(normalizedStatus);

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

    const openNcwCreator = () => {
        if (!task || !canCreateNcw) return;
        const address =
            buildBsAddressFromLocations(
                task.bsLocation as Array<{ address?: string | null }> | null,
                task.bsAddress
            ) || task.bsAddress || '';
        setNcwDefaults({
            orderNumber: task.orderNumber,
            orderDate: task.orderDate,
            orderSignDate: task.orderSignDate,
            completionDate: doneStatusChangeDate ?? null,
            bsNumber: task.bsNumber,
            address,
        });
        closeAddDocumentDialog();
        setNcwDialogOpen(true);
    };

    const closeNcwDialog = () => {
        setNcwDialogOpen(false);
        setNcwDefaults(null);
    };

    const handleNcwSaved = (_url?: string) => {
        void _url;
        setNcwDialogOpen(false);
        setNcwDefaults(null);
        void load();
    };

    const openAddDocumentDialog = () => {
        prefillOrderFields();
        setOrderFormError(null);
        setOrderFile(null);
        setSelectedDocumentType(null);
        setDocumentDialogOpen(true);
    };

    const closeAddDocumentDialog = () => {
        if (orderUploading) return;
        setDocumentDialogOpen(false);
        setSelectedDocumentType(null);
        setOrderFormError(null);
        setOrderFile(null);
        setOrderDragActive(false);
    };

    const handleSelectOrderDocument = () => {
        prefillOrderFields();
        setOrderFormError(null);
        setOrderFile(null);
        setSelectedDocumentType('order');
    };

    const validateOrderFile = (file: File): string | null => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.type) && !file.type.startsWith('image/')) {
            return t('task.order.validation.fileType', 'Поддерживаются PDF или изображения');
        }
        if (file.size > 20 * 1024 * 1024) {
            return t('task.order.validation.fileSize', 'Файл больше 20 МБ');
        }
        return null;
    };

    const handleOrderFileChange = (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;
        const file = fileList[0];
        const validationError = validateOrderFile(file);
        if (validationError) {
            setOrderFormError(validationError);
            return;
        }
        setOrderFormError(null);
        setOrderFile(file);
    };

    const onOrderDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setOrderDragActive(true);
    };

    const onOrderDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setOrderDragActive(false);
    };

    const onOrderDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setOrderDragActive(false);
        const files = e.dataTransfer.files;
        handleOrderFileChange(files);
    };

    const handleOrderSubmit = async () => {
        if (!task) return;
        if (!orderFile) {
            setOrderFormError(t('task.order.validation.missingFile', 'Добавьте файл заказа'));
            return;
        }
        setOrderFormError(null);
        setOrderUploading(true);
        try {
            const fd = new FormData();
            fd.append('orderFile', orderFile, orderFile.name);
            fd.append('orderNumber', orderNumberInput.trim());
            if (orderDateInput) fd.append('orderDate', orderDateInput);
            if (orderSignDateInput) fd.append('orderSignDate', orderSignDateInput);

            const res = await fetch(
                `/api/tasks/${encodeURIComponent(task.taskId)}`,
                {
                    method: 'PATCH',
                    body: fd,
                }
            );

            let body: unknown = null;
            try {
                body = await res.json();
            } catch {
                /* ignore */
            }

            if (!res.ok) {
                let errMsg = t('task.order.error.upload', 'Не удалось загрузить заказ');
                if (
                    body &&
                    typeof body === 'object' &&
                    'error' in body &&
                    typeof (body as { error?: unknown }).error === 'string'
                ) {
                    errMsg = (body as { error?: unknown }).error as string;
                }
                setDocumentSnackbar({ type: 'error', message: errMsg });
                return;
            }

            if (body && typeof body === 'object' && 'task' in body) {
                const updatedTask = (body as { task: Task | null }).task;
                if (updatedTask) {
                    setTask(updatedTask);
                } else {
                    await load();
                }
            } else {
                await load();
            }
            setDocumentSnackbar({ type: 'success', message: t('task.order.success.uploaded', 'Заказ загружен') });
            closeAddDocumentDialog();
        } catch (e) {
            console.error(e);
            setDocumentSnackbar({ type: 'error', message: t('task.order.error.upload', 'Не удалось загрузить заказ') });
        } finally {
            setOrderUploading(false);
        }
    };

    const handleDocumentSnackbarClose = () => setDocumentSnackbar(null);

    const handleAcceptApplication = async (applicationId: string) => {
        if (!taskMongoId) return;
        setApplicationActionLoading(applicationId);
        try {
            const res = await fetch(`/api/tasks/${taskMongoId}/applications`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationId, status: 'accepted' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) {
                setApplicationSnack({
                    open: true,
                    sev: 'error',
                    message:
                        data.error ||
                        t('task.applications.error.assign', 'Не удалось назначить исполнителя'),
                });
                return;
            }
            setApplicationSnack({
                open: true,
                sev: 'success',
                message: t('task.applications.assigned', 'Исполнитель назначен из отклика'),
            });
            await fetchApplications();
            await load();
        } catch (e) {
            setApplicationSnack({
                open: true,
                sev: 'error',
                message:
                    e instanceof Error ? e.message : t('task.applications.error.assign', 'Не удалось назначить исполнителя'),
            });
        } finally {
            setApplicationActionLoading(null);
        }
    };

    const handleUnassignApplication = async (applicationId: string) => {
        if (!taskMongoId) return;
        setApplicationActionLoading(applicationId);
        try {
            const res = await fetch(`/api/tasks/${taskMongoId}/applications`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationId, status: 'submitted' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.error) {
                setApplicationSnack({
                    open: true,
                    sev: 'error',
                    message:
                        data.error ||
                        t('task.applications.error.unassign', 'Не удалось снять исполнителя'),
                });
                return;
            }
            setApplicationSnack({
                open: true,
                sev: 'success',
                message: t('task.applications.unassigned', 'Исполнитель снят с задачи'),
            });
            await fetchApplications();
            await load();
        } catch (e) {
            setApplicationSnack({
                open: true,
                sev: 'error',
                message:
                    e instanceof Error
                        ? e.message
                        : t('task.applications.error.unassign', 'Не удалось снять исполнителя'),
            });
        } finally {
            setApplicationActionLoading(null);
        }
    };

    const closeApplicationConfirm = () => {
        if (applicationActionLoading) return;
        setApplicationConfirm({
            open: false,
            applicationId: null,
            action: null,
            contractorName: null,
        });
    };

    const confirmApplicationAction = async () => {
        if (!applicationConfirm.applicationId || !applicationConfirm.action) return;
        if (applicationConfirm.action === 'assign') {
            await handleAcceptApplication(applicationConfirm.applicationId);
        } else {
            await handleUnassignApplication(applicationConfirm.applicationId);
        }
        setApplicationConfirm({
            open: false,
            applicationId: null,
            action: null,
            contractorName: null,
        });
    };

    const sortedEvents = React.useMemo(() => {
        if (!task?.events) return [];

        // сначала отсортируем как было
        const raw = [...task.events].sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            return db - da;
        });

        const result: TaskEvent[] = [];

        for (const ev of raw) {
            // если это "назначена исполнителю" — попробуем найти пару updated с тем же временем
            if (ev.action === 'status_changed_assigned') {
                const pair = raw.find(
                    (p) =>
                        p.action === 'updated' &&
                        p.date === ev.date // у тебя они реально в один момент пишутся
                );

                if (pair && pair.details) {
                    // из updated достанем статус (from → to) и, на всякий случай, executorEmail
                    const mergedDetails: TaskEventDetails = {
                        ...(ev.details || {}),
                    };

                    // статус может быть в формате { status: { from, to } }
                    const st = pair.details.status;
                    if (
                        st &&
                        typeof st === 'object' &&
                        ('from' in st || 'to' in st)
                    ) {
                        mergedDetails.status = st as Change;
                    }

                    // executorEmail мог прийти в updated
                    if (pair.details.executorEmail && !mergedDetails.executorEmail) {
                        mergedDetails.executorEmail = pair.details.executorEmail as string;
                    }

                    result.push({
                        ...ev,
                        details: mergedDetails,
                    });

                    continue;
                }

                // если пары нет — просто кладём как есть
                result.push(ev);
                continue;
            }

            // если это updated, но у него есть "назначение исполнителя" с тем же временем — пропустим
            const hasAssignWithSameTime = raw.some(
                (p) => p.action === 'status_changed_assigned' && p.date === ev.date
            );
            if (ev.action === 'updated' && hasAssignWithSameTime) {
                // пропускаем избыточный updated
                continue;
            }

            result.push(ev);
        }

        return result;
    }, [task?.events]);


    const getEventTitle = (action: string, ev?: TaskEvent): string => {
        if (action === 'created') return t('task.history.created', 'Задача создана');
        if (action === 'status_changed_assigned') {
            return t('task.history.assigned', 'Задача назначена исполнителю');
        }
        if (action === 'updated' && ev && isExecutorRemovedEvent(ev)) {
            return t('task.history.unassigned', 'Исполнитель снят с задачи');
        }
        if (action === 'updated') return t('task.history.updated', 'Задача изменена');
        return action;
    };


    const isChange = (value: unknown): value is Change => {
        return (
            typeof value === 'object' &&
            value !== null &&
            ('from' in (value as Record<string, unknown>) ||
                'to' in (value as Record<string, unknown>))
        );
    };

    const isExecutorRemovedEvent = (ev: TaskEvent): boolean => {
        if (ev.action !== 'updated') return false;
        const d = ev.details || {};

        // исполнителя могли снять по любому из этих полей
        const candidates = [d.executorId, d.executorName, d.executorEmail];

        const isRemovedChange = (val: unknown): val is { from?: unknown; to?: unknown } => {
            if (typeof val !== 'object' || val === null) return false;
            const obj = val as { from?: unknown; to?: unknown };
            // вариант 1: был to и он undefined
            if ('to' in obj && typeof obj.to === 'undefined') return true;
            // вариант 2: было только from (значит стало пусто)
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
            return raw === null || typeof raw === 'undefined' ? '—' : String(raw);
        }

        return '—';
    };

    const statusKeys = new Set(['status', 'publicStatus', 'publicModerationStatus']);
    const dateKeys = new Set([
        'createdAt',
        'updatedAt',
        'dueDate',
        'orderDate',
        'orderSignDate',
        'workCompletionDate',
    ]);
    const fieldLabels = React.useMemo<Record<string, string>>(
        () => ({
            taskName: t('task.fields.taskName', 'Задача'),
            bsNumber: t('task.fields.bsNumber', 'БС'),
            status: t('task.fields.status', 'Статус'),
            priority: t('task.fields.priority', 'Приоритет'),
            executorName: t('task.fields.executorName', 'Исполнитель'),
            executorEmail: t('task.fields.executorEmail', 'Почта'),
            executorId: t('task.fields.executorId', 'Исполнитель'),
            taskDescription: t('task.fields.taskDescription', 'Описание'),
            publicDescription: t('task.fields.publicDescription', 'Информация для подрядчика'),
            dueDate: t('task.fields.dueDate', 'Срок'),
            totalCost: t('task.fields.totalCost', 'Стоимость'),
            budget: t('task.fields.budget', 'Плановый бюджет'),
            contractorPayment: t('task.fields.contractorPayment', 'Оплата подрядчику'),
            taskType: t('task.fields.taskType', 'Тип задачи'),
            visibility: t('task.fields.visibility', 'Видимость'),
            publicStatus: t('task.fields.publicStatus', 'Публичный статус'),
            publicModerationStatus: t('task.fields.publicModerationStatus', 'Статус модерации'),
            publicModerationComment: t('task.fields.publicModerationComment', 'Комментарий модерации'),
            orderNumber: t('task.fields.orderNumber', 'Номер заказа'),
            orderDate: t('task.fields.orderDate', 'Дата заказа'),
            orderSignDate: t('task.fields.orderSignDate', 'Дата подписания'),
            orderUrl: t('task.fields.orderUrl', 'Ссылка на заказ'),
            bsAddress: t('task.fields.bsAddress', 'Адрес'),
            workCompletionDate: t('task.fields.workCompletionDate', 'Дата завершения'),
            applicationCount: t('task.fields.applicationCount', 'Отклики'),
            allowInstantClaim: t('task.fields.allowInstantClaim', 'Мгновенный отклик'),
            currency: t('task.fields.currency', 'Валюта'),
            authorName: t('task.fields.authorName', 'Автор'),
            authorEmail: t('task.fields.authorEmail', 'Почта автора'),
            initiatorName: t('task.fields.initiatorName', 'Инициатор'),
            initiatorEmail: t('task.fields.initiatorEmail', 'Почта инициатора'),
            createdAt: t('task.fields.createdAt', 'Создана'),
            updatedAt: t('task.fields.updatedAt', 'Обновлена'),
        }),
        [t]
    );

    const getDetailLabel = (key: string) =>
        fieldLabels[key] ?? t('task.fields.unknown', 'Поле');

    const formatEventValue = (key: string, value: unknown): string => {
        if (typeof value === 'boolean') {
            return value ? t('common.yes', 'Да') : t('common.no', 'Нет');
        }
        if (typeof value === 'string' && dateKeys.has(key)) return formatDateTime(value);
        if (typeof value === 'string' && statusKeys.has(key)) {
            const label = getStatusLabel(normalizeStatusTitle(value), t);
            return label || value;
        }
        if (typeof value === 'string' && key === 'priority') {
            const label = getPriorityLabel(value, t);
            return label || value;
        }
        return asText(value);
    };

    const getEventAuthorInfo = (ev: TaskEvent) => {
        const detailAuthorId =
            ev.details && typeof ev.details.authorId === 'string' ? ev.details.authorId : undefined;
        const detailAuthorName =
            ev.details && typeof ev.details.authorName === 'string' ? ev.details.authorName : undefined;
        return {
            id: ev.authorId || detailAuthorId,
            name: ev.author || detailAuthorName || '—',
        };
    };

    const renderEventDetails = (ev: TaskEvent): React.ReactNode => {
        const d: TaskEventDetails = ev.details || {};

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
        } else if (ev.action === 'status_changed_assigned') {
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
        } else if (ev.action === 'updated') {
            if (!isManager) {
                return (
                    <Typography variant="caption" display="block">
                        {t('task.history.detailsManagerOnly', 'Детали изменений доступны менеджеру')}
                    </Typography>
                );
            }
            // твоя логика updated как была
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
                            {getDetailLabel('executorName')}: —
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

        // fallback
        return Object.entries(d).map(([key, value]) => (
            <Typography key={key} variant="caption" display="block">
                {getDetailLabel(key)}: {formatEventValue(key, value)}
            </Typography>
        ));
    };

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
                            <TableCell>{t('task.workItems.type', 'Вид работ')}</TableCell>
                            <TableCell>{t('task.workItems.quantity', 'Кол-во')}</TableCell>
                            <TableCell>{t('task.workItems.unit', 'Ед.')}</TableCell>
                            <TableCell>{t('task.workItems.note', 'Примечание')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {task.workItems?.map((item, idx) => (
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
                    initialComments={currentTask.comments}
                    onTaskUpdated={(updatedTask) =>
                        setTask((prev) =>
                            prev ? { ...prev, ...(updatedTask as Partial<Task>) } : prev
                        )
                    }
                />
            </Box>
        );
    };


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
            {/* Header */}
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
                                    {task?.taskName || t('task.title.fallback', 'Задача')}
                                </Typography>
                                {task?.bsNumber && (
                                    <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
                                        {task.bsNumber}
                                    </Typography>
                                )}

                                {task?.taskId && (
                                    <Chip
                                        label={task.taskId}
                                        size="small"
                                        variant="outlined"
                                        sx={{ mt: 0.5 }}
                                    />
                                )}
                                {task?.status && (
                                    <Chip
                                        label={getStatusLabel(task.status, t)}
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
                                {isModerationPending && (
                                    <Chip
                                        label={t('task.publish.moderationPending', 'На модерации')}
                                        size="small"
                                        color="warning"
                                        variant="outlined"
                                    />
                                )}
                                {isModerationRejected && (
                                    <Chip
                                        label={t('task.publish.rejected', 'Публикация отклонена')}
                                        size="small"
                                        color="error"
                                        variant="outlined"
                                    />
                                )}
                            </Stack>

                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0 }}
                            >
                                {t('org.label', 'Организация')}: {' '}
                                <Link
                                    href={`/org/${encodeURIComponent(org)}`}
                                    underline="hover"
                                    color="inherit"
                                >
                                    {orgName || org}
                                </Link>
                                • {t('project.label', 'Проект')}: {' '}
                                <Link
                                    href={`/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                                        projectKey || project
                                    )}/tasks`}
                                    underline="hover"
                                    color="inherit"
                                >
                                    {projectKey || task?.projectKey || project}
                                </Link>
                            </Typography>
                            {isModerationRejected && task?.publicModerationComment && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
                                    {t('task.publish.moderationComment', 'Комментарий модератора')}: {task.publicModerationComment}
                                </Typography>
                            )}
                        </Box>
                    </Stack>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        alignItems={{ xs: 'stretch', sm: 'center' }}
                        useFlexGap
                        sx={{ width: { xs: '100%', md: 'auto' } }}
                    >
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{
                                flexWrap: 'nowrap',
                                overflowX: { xs: 'auto', sm: 'visible' },
                                pb: { xs: 0.25, sm: 0 },
                                scrollbarWidth: 'none',
                                '&::-webkit-scrollbar': { display: 'none' },
                            }}
                        >
                            {task && !executorAssigned && (
                                <Tooltip
                                    title={
                                        isModerationPending
                                            ? t('task.publish.moderationPending', 'Задача на модерации')
                                            : task.visibility === 'public'
                                                ? t('task.publish.unpublish', 'Снять с публикации')
                                                : t('task.publish.publish', 'Опубликовать на бирже')
                                    }
                                >
                                    <span>
                                        <IconButton
                                            onClick={() =>
                                                task.visibility === 'public'
                                                    ? void handlePublishToggle(false)
                                                    : openPublishDialog()
                                            }
                                            disabled={publishLoading || isModerationPending}
                                            sx={getIconButtonSx({
                                                active: task.visibility === 'public',
                                                activeColor: '#ffffff',
                                                activeBg: theme.palette.primary.main,
                                                disabled: publishLoading || isModerationPending,
                                            })}
                                        >
                                            <CampaignOutlinedIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            )}
                            <Tooltip title={t('common.configure', 'Настроить')}>
                                <IconButton
                                    onClick={() => setSectionDialogOpen(true)}
                                    sx={getIconButtonSx({
                                        active: hasCustomVisibility,
                                        activeColor: theme.palette.primary.main,
                                    })}
                                >
                                    <GridViewOutlinedIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.refresh', 'Обновить')}>
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
                            <Tooltip title={t('common.edit', 'Редактировать')}>
                                <span>
                                    <IconButton
                                        onClick={() => task && setEditOpen(true)}
                                        disabled={loading || !task}
                                        sx={getIconButtonSx({ disabled: loading || !task })}
                                    >
                                        <EditNoteIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Tooltip title={t('common.delete', 'Удалить')}>
                                <span>
                                    <IconButton
                                        onClick={() => {
                                            if (!task) return;
                                            setDeleteReports(true);
                                            setDeleteOpen(true);
                                        }}
                                        disabled={loading || !task}
                                        sx={getIconButtonSx({ disabled: loading || !task })}
                                    >
                                        <DeleteOutlineIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Stack>
                    </Stack>
                </Stack>
            </Box>

            {/* Content */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Paper sx={{ ...cardBaseSx, p: cardPadding }}>
                    <Typography color="error" sx={{ mb: 1 }}>
                        {error}
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={() => void load()}
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {t('common.retry', 'Повторить')}
                    </Button>
                </Paper>
            ) : !task ? (
                <Paper sx={{ ...cardBaseSx, p: cardPadding }}>
                    <Typography>{t('task.error.notFound', 'Задача не найдена.')}</Typography>
                </Paper>
            ) : (
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
                        {/* Info */}
                        {isSectionVisible('info') && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    gutterBottom
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <InfoOutlinedIcon fontSize="small" />
                                    {t('task.sections.info', 'Информация')}
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />

                                <Stack spacing={1}>
                                    {/* БС */}
                                    <Typography variant="body1">
                                        <strong>{t('task.fields.bsNumber', 'Базовая станция')}:</strong>{' '}
                                        {task.bsNumber || '—'}
                                    </Typography>

                                    {/* Адрес */}
                                    <Typography variant="body1">
                                        <strong>{t('task.fields.address', 'Адрес')}:</strong>{' '}
                                        {task.bsAddress || t('task.fields.addressMissing', 'Адрес не указан')}
                                    </Typography>

                                    <Typography variant="body1">
                                        <strong>{t('task.fields.dueDate', 'Срок')}:</strong>{' '}
                                        {task.dueDate ? formatDate(task.dueDate) : '—'}
                                    </Typography>
                                    {task.workCompletionDate && (
                                        <Typography variant="body1">
                                            <strong>{t('task.fields.workCompletionDate', 'Дата завершения')}:</strong>{' '}
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
                                        <strong>{t('task.fields.priority', 'Приоритет')}:</strong>
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
                                            <span>{getPriorityLabel(task.priority, t) || '—'}</span>
                                        </Box>
                                    </Typography>

                                    <Typography variant="body1">
                                        <strong>{t('task.fields.totalCost', 'Стоимость')}:</strong>{' '}
                                        {formatPrice(task.totalCost)}
                                    </Typography>
                                    <Typography variant="body1">
                                        <strong>{t('task.fields.budget', 'Плановый бюджет')}:</strong>{' '}
                                        {formatPrice(task.budget)}
                                    </Typography>
                                    <Typography variant="body1">
                                        <strong>{t('task.fields.contractorPayment', 'Утвержденная оплата подрядчику')}:</strong>{' '}
                                        {formatPrice(task.contractorPayment)}
                                    </Typography>
                                    <Typography variant="body1">
                                        <strong>{t('task.fields.taskType', 'Тип задачи')}:</strong>{' '}
                                        {task.taskType || '—'}
                                    </Typography>

                                    {(task.authorName || task.authorEmail) &&
                                        (!task.authorId || task.authorId !== currentUserId) && (
                                        <Typography variant="body1">
                                            <strong>{t('task.fields.authorName', 'Автор')}:</strong>{' '}
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
                                                    {task.authorName && task.authorEmail
                                                        ? `${task.authorName} (${task.authorEmail})`
                                                        : task.authorName || task.authorEmail}
                                                </Button>
                                            ) : (
                                                task.authorName && task.authorEmail
                                                    ? `${task.authorName} (${task.authorEmail})`
                                                    : task.authorName || task.authorEmail
                                            )}
                                        </Typography>
                                    )}

                                    {/* Исполнитель (если есть) */}
                                    {(task.executorName || task.executorEmail) && (
                                        <Typography variant="body1">
                                            <strong>{t('task.fields.executorName', 'Исполнитель')}:</strong>{' '}
                                            {task.executorId ? (
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    onClick={() => openProfileDialog(task.executorId)}
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
                                                    {task.executorName || task.executorEmail}
                                                </Button>
                                            ) : (
                                                task.executorName || task.executorEmail
                                            )}
                                        </Typography>
                                    )}
                                    {(task.initiatorName || task.initiatorEmail) && (
                                        <Typography variant="body1">
                                            <strong>{t('task.fields.initiatorName', 'Инициатор')}:</strong>{' '}
                                            {task.initiatorName && task.initiatorEmail
                                                ? `${task.initiatorName} (${task.initiatorEmail})`
                                                : task.initiatorName || task.initiatorEmail}
                                        </Typography>
                                    )}
                                    {task.publicDescription && (
                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                            <strong>{t('task.fields.publicDescription', 'Информация для подрядчика')}:</strong>{' '}
                                            {task.publicDescription}
                                        </Typography>
                                    )}

                                    {/* Создана + обновлена */}
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
                                            <strong>{t('task.fields.createdAt', 'Создана')}:</strong>{' '}
                                            {task.createdAt ? formatDate(task.createdAt) : '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>{t('task.fields.updatedAt', 'Обновлена')}:</strong>{' '}
                                            {task.updatedAt ? formatDateTime(task.updatedAt) : '—'}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </CardItem>
                        )}

                        {isSectionVisible('applications') && task.visibility === 'public' && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                        mb: 1,
                                    }}
                                >
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={600}
                                        gutterBottom
                                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                    >
                                        <GroupsIcon fontSize="small" />
                                        {t('task.sections.applications', 'Отклики')}
                                    </Typography>
                                    <Tooltip title={t('task.applications.refresh', 'Обновить список откликов')}>
                                        <span>
                                            <IconButton
                                                size="small"
                                                onClick={() => void fetchApplications()}
                                                disabled={applicationsLoading}
                                            >
                                                <RefreshIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Box>
                                <Divider sx={{ mb: 1.5 }} />
                                {applicationsLoading ? (
                                    <Stack alignItems="center" spacing={1}>
                                        <CircularProgress size={24} />
                                        <Typography variant="body2" color="text.secondary">
                                            {t('task.applications.loading', 'Загружаем отклики…')}
                                        </Typography>
                                    </Stack>
                                ) : applicationsError ? (
                                    <Alert
                                        severity="error"
                                        action={
                                            <Button
                                                color="inherit"
                                                size="small"
                                                onClick={() => void fetchApplications()}
                                            >
                                                {t('common.retry', 'Повторить')}
                                            </Button>
                                        }
                                    >
                                        {applicationsError}
                                    </Alert>
                                ) : applications.length === 0 ? (
                                    <Typography color="text.secondary">
                                        {t('task.applications.empty', 'Пока нет откликов на задачу')}
                                    </Typography>
                                ) : (
                                    <Stack spacing={1.5}>
                                        {applications.map((app) => {
                                            const appId = app._id ? String(app._id) : '';
                                            const statusLabelMap: Record<string, string> = {
                                                submitted: t('task.applications.status.submitted', 'На рассмотрении'),
                                                shortlisted: t('task.applications.status.shortlisted', 'В шорт-листе'),
                                                accepted: t('task.applications.status.accepted', 'Назначен'),
                                                rejected: t('task.applications.status.rejected', 'Отклонён'),
                                                withdrawn: t('task.applications.status.withdrawn', 'Отозван'),
                                            };
                                            const statusLabel =
                                                statusLabelMap[app.status] || app.status;
                                            const isAccepted = app.status === 'accepted';
                                            const actionInProgress =
                                                applicationActionLoading === appId;

                                            return (
                                                <Paper
                                                    key={appId || app.contractorEmail || app.contractorId}
                                                    variant="outlined"
                                                    sx={{
                                                        p: 1.5,
                                                        borderRadius: UI_RADIUS.item,
                                                        borderColor: cardBorder,
                                                        backgroundColor:
                                                            theme.palette.mode === 'dark'
                                                                ? 'rgba(12,16,26,0.7)'
                                                                : 'rgba(255,255,255,0.75)',
                                                    }}
                                                >
                                                    <Stack
                                                        direction="row"
                                                        alignItems="flex-start"
                                                        justifyContent="space-between"
                                                        spacing={1}
                                                    >
                                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                                            <Stack
                                                                direction="row"
                                                                alignItems="center"
                                                                spacing={1}
                                                                sx={{ flexWrap: 'wrap', mb: 0.5 }}
                                                            >
                                                                <Link
                                                                    variant="subtitle2"
                                                                    underline={
                                                                        app.contractorClerkUserId
                                                                            ? 'hover'
                                                                            : 'none'
                                                                    }
                                                                    color="inherit"
                                                                    component={
                                                                        app.contractorClerkUserId
                                                                            ? 'button'
                                                                            : 'span'
                                                                    }
                                                                    type={
                                                                        app.contractorClerkUserId
                                                                            ? 'button'
                                                                            : undefined
                                                                    }
                                                                    onClick={
                                                                        app.contractorClerkUserId
                                                                            ? () =>
                                                                                openProfileDialog(
                                                                                    app.contractorClerkUserId
                                                                                )
                                                                            : undefined
                                                                    }
                                                                    sx={{
                                                                        wordBreak: 'break-word',
                                                                        textAlign: 'left',
                                                                        p: 0,
                                                                        m: 0,
                                                                        border: 'none',
                                                                        background: 'none',
                                                                        cursor: app.contractorClerkUserId
                                                                            ? 'pointer'
                                                                            : 'default',
                                                                        color: app.contractorClerkUserId
                                                                            ? 'primary.main'
                                                                            : 'inherit',
                                                                        fontWeight: 600,
                                                                    }}
                                                                >
                                                                    {app.contractorName ||
                                                                        app.contractorEmail ||
                                                                        t('task.applications.contractor', 'Подрядчик')}
                                                                </Link>
                                                                <Chip
                                                                    label={statusLabel}
                                                                    size="small"
                                                                    variant="outlined"
                                                                />
                                                            </Stack>
                                                            {app.contractorEmail && (
                                                                <Typography
                                                                    variant="body2"
                                                                    color="text.secondary"
                                                                    sx={{ wordBreak: 'break-all' }}
                                                                >
                                                                    {app.contractorEmail}
                                                                </Typography>
                                                            )}
                                                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                                                {t('task.applications.bid', 'Ставка')}: {formatPrice(app.proposedBudget)}
                                                            </Typography>
                                                            {typeof app.etaDays === 'number' && (
                                                                <Typography variant="body2">
                                                                    {t('task.applications.eta', 'Срок')}: {app.etaDays} {t('common.daysShort', 'дн.')}
                                                                </Typography>
                                                            )}
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                                sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}
                                                            >
                                                                {app.coverMessage}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                            {(!isAccepted || canUnassignExecutor) && (
                                                                <Button
                                                                    variant={isAccepted ? 'outlined' : 'contained'}
                                                                    color={isAccepted ? 'error' : 'primary'}
                                                                    size="small"
                                                                    onClick={() =>
                                                                        setApplicationConfirm({
                                                                            open: true,
                                                                            applicationId: appId,
                                                                            action: isAccepted ? 'unassign' : 'assign',
                                                                            contractorName:
                                                                                app.contractorName || app.contractorEmail || null,
                                                                        })
                                                                    }
                                                                    disabled={
                                                                        !appId ||
                                                                        applicationActionLoading === appId
                                                                    }
                                                                    startIcon={
                                                                        actionInProgress ? (
                                                                            <CircularProgress size={16} color="inherit" />
                                                                        ) : undefined
                                                                    }
                                                                    sx={{ borderRadius: UI_RADIUS.button }}
                                                                >
                                                                    {isAccepted
                                                                        ? t('task.applications.unassign', 'Снять')
                                                                        : t('task.applications.assign', 'Назначить')}
                                                                </Button>
                                                            )}
                                                        </Box>
                                                    </Stack>
                                                </Paper>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </CardItem>
                        )}

                        {isSectionVisible('related') && relatedTasks.length > 0 && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Accordion
                                    defaultExpanded
                                    disableGutters
                                    elevation={0}
                                    sx={accordionSx}
                                >
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
                                        <Typography
                                            variant="subtitle1"
                                            fontWeight={600}
                                            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                        >
                                            <LinkOutlinedIcon fontSize="small" />
                                            {t('task.sections.related', 'Связанные задачи')}
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={accordionDetailsSx}>
                                        <Divider sx={{ mb: 1.5 }} />
                                        <Stack spacing={1}>
                                            {relatedTasks.map((related) => {
                                                const detailLabel = related.bsNumber ? `BS ${related.bsNumber}` : null;
                                                const statusLabel = related.status
                                                    ? getStatusLabel(normalizeStatusTitle(related.status), t)
                                                    : undefined;
                                                const href = `/org/${encodeURIComponent(
                                                    org || ''
                                                )}/projects/${encodeURIComponent(
                                                    projectKey || project || ''
                                                )}/tasks/${encodeURIComponent(
                                                    related.taskId || related._id
                                                )}`;
                                                return (
                                                    <Link
                                                        key={related._id}
                                                        href={href}
                                                        color="inherit"
                                                        underline="hover"
                                                        sx={{
                                                            display: 'block',
                                                            borderRadius: UI_RADIUS.item,
                                                            p: 1,
                                                            '&:hover': {
                                                                backgroundColor: 'rgba(59,130,246,0.04)',
                                                            },
                                                        }}
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
                                                                <Chip label={statusLabel} size="small" sx={{ fontWeight: 500 }} />
                                                            )}
                                                        </Stack>
                                                    </Link>
                                                );
                                            })}
                                        </Stack>
                                    </AccordionDetails>
                                </Accordion>
                            </CardItem>
                        )}

                        {isSectionVisible('description') && task.taskDescription && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="body1"
                                    fontWeight={600}
                                    gutterBottom
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <DescriptionOutlinedIcon fontSize="small" />
                                    {t('task.sections.description', 'Описание')}
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                                    {task.taskDescription}
                                </Typography>
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

                        {task?.taskType === 'document' && normalizedStatus === 'Pending' && (
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
                                                    : t(
                                                          'task.document.agreed.archiveDownload',
                                                          'Скачать архивом'
                                                      )}
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
                                                    <Typography
                                                        variant="body2"
                                                        sx={{ wordBreak: 'break-all' }}
                                                    >
                                                        {extractFileNameFromUrl(
                                                            fileUrl,
                                                            t(
                                                                'task.documents.documentNumber',
                                                                'Документ {index}',
                                                                { index: index + 1 }
                                                            )
                                                        )}
                                                    </Typography>
                                                    <Stack direction="row" spacing={1}>
                                                        <Button
                                                            component="a"
                                                            href={buildDocumentReviewFileUrl(fileUrl)}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            size="small"
                                                        >
                                                            {t('common.open', 'Открыть')}
                                                        </Button>
                                                        <Button
                                                            component="a"
                                                            href={buildDocumentReviewFileUrl(fileUrl, true)}
                                                            size="small"
                                                        >
                                                            {t('common.download', 'Скачать')}
                                                        </Button>
                                                    </Stack>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </Stack>
                                )}
                            </CardItem>
                        )}

                        {/* Geo */}
                        {isSectionVisible('geo') && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <TaskGeoLocation locations={task.bsLocation} />
                            </CardItem>
                        )}

                        {/* Work items */}
                        {task.taskType !== 'document' &&
                            isSectionVisible('work') &&
                            (hasWorkItems || Array.isArray(task.workItems)) && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Accordion
                                    defaultExpanded
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
                                                <TocOutlinedIcon fontSize="small" />
                                                {t('task.sections.work', 'Состав работ')}
                                            </Typography>

                                            <Tooltip title={t('common.fullscreen', 'Развернуть на весь экран')}>
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

                        {isSectionVisible('attachments') && hasAttachments && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    gutterBottom
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <AttachFileOutlinedIcon fontSize="small" />
                                    {t('task.sections.attachments', 'Вложения')}
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                <Stack gap={1}>
                                    {task.files?.map((file, idx) => (
                                        <Link
                                            key={`file-${idx}`}
                                            href={file.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            underline="hover"
                                        >
                                            {file.name || t('common.fileNumber', 'Файл {index}', { index: idx + 1 })}
                                        </Link>
                                    ))}
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
                                                t('task.attachments.fallback', 'Вложение {index}', {
                                                    index: idx + 1,
                                                })
                                            )}
                                        </Link>
                                    ))}
                                </Stack>
                            </CardItem>
                        )}

                        {task.taskType !== 'document' &&
                            isSectionVisible('photoReports') &&
                            hasPhotoReports &&
                            task.taskId && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    gutterBottom
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <PhotoLibraryOutlinedIcon fontSize="small" />
                                    {t('task.sections.photoReports', 'Фотоотчеты')}
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                <Stack spacing={1.5}>
                                    {photoReportItems.map((report) => {
                                        const statusLabel = getStatusLabel(report.status, t);
                                        const statusColor = getStatusColor(
                                            normalizeStatusTitle(report.status)
                                        );
                                        return (
                                            <Stack
                                                key={`photo-report-${report.baseId}`}
                                                direction="row"
                                                alignItems="center"
                                                justifyContent="space-between"
                                                gap={1}
                                                flexWrap="wrap"
                                            >
                                                <Stack spacing={0.5}>
                                                    <Link
                                                        href={`/reports/${encodeURIComponent(
                                                            task.taskId.toLowerCase()
                                                        )}/${encodeURIComponent(report.baseId)}`}
                                                        underline="hover"
                                                        sx={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 0.75,
                                                        }}
                                                    >
                                                        <FolderOutlinedIcon fontSize="small" />
                                                        {t('task.fields.bsNumberShort', 'БС')} {report.baseId}
                                                    </Link>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {t('reports.gallery.main', 'Основные фото')}: {report.filesCount} ·{' '}
                                                        {t('reports.gallery.fixed', 'Исправления')}: {report.fixedCount}
                                                    </Typography>
                                                </Stack>
                                                <Chip
                                                    label={statusLabel}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: statusColor,
                                                        color: '#fff',
                                                        fontWeight: 500,
                                                    }}
                                                />
                                            </Stack>
                                        );
                                    })}
                                </Stack>
                            </CardItem>
                        )}

                        {/* Документы */}
                        {isSectionVisible('documents') && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    gutterBottom
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <CasesOutlinedIcon fontSize="small" />
                                    {t('task.sections.documents', 'Документы')}
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                {hasDocuments ? (
                                    <Stack gap={1}>
                                        {documentItems.map((doc) => {
                                            const isSpecial =
                                                doc.type === 'estimate' ||
                                                doc.type === 'order' ||
                                                doc.type === 'ncw';
                                            const isCurrentDeleting =
                                                documentDeleting && documentToDelete === doc.url;
                                            const deleteTitle =
                                                doc.type === 'order'
                                                    ? t('task.documents.deleteOrder', 'Удалить заказ')
                                                    : doc.type === 'ncw'
                                                        ? t('task.documents.deleteNotice', 'Удалить уведомление')
                                                        : t('task.documents.deleteEstimate', 'Удалить смету');

                                            return (
                                                <Box
                                                    key={doc.url}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        flexWrap: 'wrap',
                                                    }}
                                                >
                                                    {isSpecial && (
                                                        <Tooltip title={deleteTitle}>
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() =>
                                                                        openDeleteDocumentDialog(
                                                                            doc.url,
                                                                            doc.type
                                                                        )
                                                                    }
                                                                    disabled={isCurrentDeleting}
                                                                >
                                                                    {isCurrentDeleting ? (
                                                                        <CircularProgress size={18} />
                                                                    ) : (
                                                                        <DeleteOutlineIcon fontSize="small" />
                                                                    )}
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    )}
                                                    <Link
                                                        href={doc.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        underline="hover"
                                                    >
                                                        {doc.label}
                                                    </Link>
                                                </Box>
                                            );
                                        })}
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'flex-end',
                                                pt: 0.5,
                                            }}
                                        >
                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                variant="outlined"
                                                onClick={openAddDocumentDialog}
                                                sx={{ borderRadius: UI_RADIUS.button }}
                                            >
                                                {t('common.add', 'Добавить')}
                                            </Button>
                                        </Box>
                                    </Stack>
                                ) : (
                                    <Stack gap={1}>
                                        <Typography color="text.secondary">
                                            {t('task.documents.empty', 'Документы отсутствуют')}
                                        </Typography>
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                variant="outlined"
                                                onClick={openAddDocumentDialog}
                                                sx={{ borderRadius: UI_RADIUS.button }}
                                            >
                                                {t('common.add', 'Добавить')}
                                            </Button>
                                        </Box>
                                    </Stack>
                                )}
                            </CardItem>
                        )}

                        {isSectionVisible('order') &&
                            (task.orderNumber ||
                                task.orderUrl ||
                                task.orderDate ||
                                task.orderSignDate) && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    gutterBottom
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <ArticleOutlinedIcon fontSize="small" />
                                    {t('task.sections.order', 'Заказ')}
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                <Stack gap={0.5}>
                                    {task.orderNumber && (
                                        <Typography>
                                            {t('task.order.number', 'Номер')}: {task.orderNumber}
                                        </Typography>
                                    )}
                                    {task.orderDate && (
                                        <Typography>
                                            {t('task.order.date', 'Дата заказа')}: {' '}
                                            {formatDate(task.orderDate)}
                                        </Typography>
                                    )}
                                    {task.orderSignDate && (
                                        <Typography>
                                            {t('task.order.signDate', 'Дата подписания')}: {' '}
                                            {formatDate(task.orderSignDate)}
                                        </Typography>
                                    )}
                                    {orderCompletionDate && (
                                        <Typography>
                                            {t('task.order.completionDate', 'Срок выполнения')}: {' '}
                                            {formatDate(orderCompletionDate)}
                                        </Typography>
                                    )}
                                    {task.orderUrl && (
                                        <Button
                                            href={task.orderUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                        variant="text"
                                        sx={{ alignSelf: 'flex-start', borderRadius: UI_RADIUS.button }}
                                    >
                                            {t('task.order.open', 'Открыть заказ')}
                                        </Button>
                                    )}
                                </Stack>
                            </CardItem>
                        )}

                        {/* Comments */}
                        {isSectionVisible('comments') && (
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
                                                {t('task.sections.comments', 'Комментарии')}
                                            </Typography>

                                            <Tooltip title={t('common.fullscreen', 'Развернуть на весь экран')}>
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
                        )}

                        {/* History */}
                        {isSectionVisible('history') && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Accordion
                                    disableGutters
                                    elevation={0}
                                    sx={accordionSx}
                                >
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
                                            {t('task.sections.history', 'История')}
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={accordionDetailsSx}>
                                        <Divider sx={{ mb: 1.5 }} />
                                        {sortedEvents.length === 0 ? (
                                            <Typography
                                                color="text.secondary"
                                                sx={{ pb: 1 }}
                                            >
                                                {t('task.history.empty', 'История пуста')}
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
                                                    <TimelineItem key={idx}>
                                                        <TimelineOppositeContent sx={{ pr: 1 }}>
                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                            >
                                                                {formatDateTime(ev.date)}
                                                            </Typography>
                                                        </TimelineOppositeContent>
                                                        <TimelineSeparator>
                                                            <TimelineDot
                                                                color={
                                                                    ev.action === 'created'
                                                                        ? 'primary'
                                                                        : 'success'
                                                                }
                                                            />
                                                            {idx <
                                                                sortedEvents.length - 1 && (
                                                                    <TimelineConnector />
                                                                )}
                                                        </TimelineSeparator>
                                                        <TimelineContent
                                                            sx={{ py: 1, minWidth: 0 }}
                                                        >
                                                            <Typography
                                                                variant="body2"
                                                                fontWeight={600}
                                                            >
                                                                {getEventTitle(ev.action, ev)}
                                                            </Typography>
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                            >
                                                                {t('task.history.author', 'Автор')}:{' '}
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
                                                            <Box sx={{ mt: 0.5 }}>
                                                                {renderEventDetails(ev)}
                                                            </Box>
                                                        </TimelineContent>
                                                    </TimelineItem>
                                                ))}
                                            </Timeline>
                                        )}
                                    </AccordionDetails>
                                </Accordion>
                            </CardItem>
                        )}
                    </Masonry>
                </Box>
            </Box>
            )}


            {task && (
                <WorkspaceTaskDialog
                    open={editOpen}
                    org={org}
                    project={project}
                    onCloseAction={() => setEditOpen(false)}
                    onCreatedAction={() => {
                        setEditOpen(false);
                        void load();
                    }}
                    mode="edit"
                    initialTask={task ? toEditShape(task) : null}
                />
            )}

            <ProfileDialog
                open={profileDialogOpen}
                onClose={closeProfileDialog}
                clerkUserId={profileClerkUserId}
            />

            <Dialog
                open={sectionDialogOpen}
                onClose={() => setSectionDialogOpen(false)}
                fullWidth
                maxWidth="xs"
            >
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
                        {t('task.sections.selectTitle', 'Выбор блоков')}
                    </Typography>
                    <IconButton onClick={() => setSectionDialogOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {allowedSections.map((section) => (
                        <FormControlLabel
                            key={section}
                            control={
                                <Checkbox
                                    checked={isSectionVisible(section)}
                                    onChange={() => handleSectionToggle(section)}
                                />
                            }
                            label={taskSectionLabels[section]}
                        />
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleSelectAllSections}
                        startIcon={<CheckBoxIcon />}
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {t('common.selectAll', 'Выбрать все')}
                    </Button>
                    <Button
                        onClick={handleClearSections}
                        startIcon={<CheckBoxOutlineBlankIcon />}
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {t('common.clear', 'Очистить')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={publishDialogOpen}
                onClose={closePublishDialog}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{t('task.publish.title', 'Публикация задачи')}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t(
                            'task.publish.description',
                            'Добавьте плановый бюджет (по умолчанию попадёт в ставку отклика) и дайте более подробную информацию о задаче. Эти данные увидят подрядчики перед откликом, но смогут скорректировать ставку.'
                        )}
                    </Typography>
                    <TextField
                        label={t('task.publish.budget.label', 'Планируемый бюджет')}
                        type="number"
                        value={publishBudgetInput}
                        onChange={(e) => setPublishBudgetInput(e.target.value)}
                        placeholder={t('task.publish.budget.placeholder', 'Например, 120000')}
                        helperText={t('task.publish.budget.helper', 'Можно оставить пустым')}
                        fullWidth
                        slotProps={{ htmlInput: { min: 0 } }}
                    />
                    <TextField
                        label={t('task.publish.info.label', 'Информация о задаче')}
                        placeholder={t('task.publish.info.placeholder', 'Подробнее опишите задачу для публикации')}
                        value={publishInfoInput}
                        onChange={(e) => setPublishInfoInput(e.target.value)}
                        helperText={t('task.publish.info.helper', 'Эта информация будет показана подрядчикам')}
                        fullWidth
                        multiline
                        minRows={3}
                    />
                    {publishDialogError && (
                        <Alert severity="error">{publishDialogError}</Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={closePublishDialog}
                        disabled={publishLoading}
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {t('common.cancel', 'Отмена')}
                    </Button>
                    <Button
                        onClick={() => void handlePublishSubmit()}
                        variant="contained"
                        disabled={publishLoading}
                        startIcon={
                            publishLoading ? <CircularProgress size={18} color="inherit" /> : undefined
                        }
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {t('task.publish.action', 'Опубликовать')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={documentDialogOpen}
                onClose={closeAddDocumentDialog}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>{t('task.documents.addTitle', 'Добавить документ')}</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {!selectedDocumentType ? (
                        <Stack spacing={2}>
                            <Typography variant="body2" color="text.secondary">
                                {t('task.documents.chooseType', 'Выберите тип документа для добавления.')}
                            </Typography>
                            <Button
                                variant="outlined"
                                onClick={handleSelectOrderDocument}
                                startIcon={<ArticleOutlinedIcon />}
                                sx={{ alignSelf: 'flex-start', borderRadius: UI_RADIUS.button }}
                            >
                                {t('task.documents.orderType', 'Заказ на выполнение работ')}
                            </Button>
                            {canCreateNcw && (
                                <Button
                                    variant="outlined"
                                    onClick={openNcwCreator}
                                    startIcon={<DescriptionOutlinedIcon />}
                                    sx={{ alignSelf: 'flex-start', borderRadius: UI_RADIUS.button }}
                                >
                                    {t('task.documents.createNotice', 'Создать уведомление')}
                                </Button>
                            )}
                        </Stack>
                    ) : (
                        <Stack spacing={2}>
                            <Typography variant="body2">
                                {t('task.documents.orderInstructions', 'Заполните данные и прикрепите файл заказа.')}
                            </Typography>
                            <TextField
                                label={t('task.order.number', 'Номер заказа')}
                                value={orderNumberInput}
                                onChange={(e) => setOrderNumberInput(e.target.value)}
                                size="small"
                                fullWidth
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <TextField
                                    label={t('task.order.date', 'Дата заказа')}
                                    type="date"
                                    value={orderDateInput}
                                    onChange={(e) => setOrderDateInput(e.target.value)}
                                    size="small"
                                    fullWidth
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                                <TextField
                                    label={t('task.order.signDate', 'Дата подписания')}
                                    type="date"
                                    value={orderSignDateInput}
                                    onChange={(e) => setOrderSignDateInput(e.target.value)}
                                    size="small"
                                    fullWidth
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                            </Stack>
                            <Box
                                onDragOver={onOrderDragOver}
                                onDragLeave={onOrderDragLeave}
                                onDrop={onOrderDrop}
                                sx={(theme) => ({
                                    border: '1px dashed',
                                    borderColor: orderDragActive
                                        ? theme.palette.primary.main
                                        : theme.palette.divider,
                                    borderRadius: UI_RADIUS.subtle,
                                    p: 2,
                                    textAlign: 'center',
                                    backgroundColor: orderDragActive
                                        ? theme.palette.action.hover
                                        : 'transparent',
                                    cursor: 'pointer',
                                })}
                                onClick={() => orderFileInputRef.current?.click()}
                            >
                                <input
                                    ref={orderFileInputRef}
                                    type="file"
                                    hidden
                                    accept=".pdf,image/*"
                                    onChange={(e) => {
                                        handleOrderFileChange(e.target.files);
                                        if (e.target) e.target.value = '';
                                    }}
                                />
                                <Stack spacing={1} alignItems="center">
                                    <CloudUploadOutlinedIcon />
                                    <Typography variant="body2" color="text.secondary">
                                        {t('task.documents.dragDrop', 'Перетащите файл сюда или нажмите, чтобы выбрать')}
                                    </Typography>
                                    {orderFile && (
                                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                            {t('task.documents.selectedFile', 'Выбран файл')}: {orderFile.name}
                                        </Typography>
                                    )}
                                </Stack>
                            </Box>
                            {orderFormError && (
                                <Typography variant="body2" color="error">
                                    {orderFormError}
                                </Typography>
                            )}
                        </Stack>
                    )}
                </DialogContent>
                {selectedDocumentType === 'order' && (
                    <DialogActions>
                        <Button
                            onClick={closeAddDocumentDialog}
                            disabled={orderUploading}
                            sx={{ borderRadius: UI_RADIUS.button }}
                        >
                            {t('common.cancel', 'Отмена')}
                        </Button>
                        <Button
                            onClick={handleOrderSubmit}
                            variant="contained"
                            disabled={orderUploading}
                            startIcon={
                                orderUploading ? <CircularProgress size={18} color="inherit" /> : null
                            }
                            sx={{ borderRadius: UI_RADIUS.button }}
                        >
                            {t('common.upload', 'Загрузить')}
                        </Button>
                    </DialogActions>
                )}
            </Dialog>

            <Dialog
                fullScreen
                open={ncwDialogOpen}
                onClose={closeNcwDialog}
                scroll="paper"
            >
                <DialogTitle
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <Typography variant="h6" fontWeight={600}>
                        {t('task.documents.noticeTitle', 'Создание уведомления о завершении работ')}
                    </Typography>
                    <IconButton onClick={closeNcwDialog}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {task && (
                        <T2NcwGenerator
                            taskId={task.taskId}
                            orgSlug={org || undefined}
                            projectKey={project || undefined}
                            initialOrderNumber={ncwDefaults?.orderNumber ?? task.orderNumber ?? undefined}
                            initialOrderDate={ncwDefaults?.orderDate ?? task.orderDate ?? undefined}
                            initialOrderSignDate={
                                ncwDefaults?.orderSignDate ?? task.orderSignDate ?? undefined
                            }
                            initialCompletionDate={
                                ncwDefaults?.completionDate ?? doneStatusChangeDate ?? undefined
                            }
                            initialBsNumber={ncwDefaults?.bsNumber ?? task.bsNumber ?? undefined}
                            initialAddress={ncwDefaults?.address ?? task.bsAddress ?? undefined}
                            open={ncwDialogOpen}
                            onSaved={handleNcwSaved}
                            onClose={closeNcwDialog}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {task?.taskType !== 'document' && (
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
                            {t('task.sections.work', 'Состав работ')}
                        </Typography>
                        <IconButton onClick={() => setWorkItemsFullScreen(false)}>
                            <CloseFullscreenIcon />
                        </IconButton>
                    </Box>

                    <Box sx={{ p: 2 }}>
                        {renderWorkItemsTable('calc(100vh - 80px)')}
                    </Box>
                </Dialog>
            )}

            <Dialog
                fullScreen
                open={commentsFullScreen}
                onClose={() => setCommentsFullScreen(false)}
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
                        {t('task.sections.comments', 'Комментарии')}
                    </Typography>
                    <IconButton onClick={() => setCommentsFullScreen(false)}>
                        <CloseFullscreenIcon />
                    </IconButton>
                </Box>

                <Box sx={{ p: 2 }}>
                    {renderCommentsSection('calc(100vh - 80px)')}
                </Box>
            </Dialog>

            <Dialog
                open={deleteDocumentOpen}
                onClose={closeDeleteDocumentDialog}
            >
                <DialogTitle>
                    {documentToDeleteType === 'order'
                        ? t('task.documents.deleteOrderTitle', 'Удалить заказ?')
                        : documentToDeleteType === 'estimate'
                            ? t('task.documents.deleteEstimateTitle', 'Удалить смету?')
                            : t('task.documents.deleteDocumentTitle', 'Удалить документ?')}
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        {documentToDeleteType === 'order'
                            ? t('task.documents.deleteOrderText', 'Файл заказа и данные о заказе будут удалены из задачи.')
                            : documentToDeleteType === 'estimate'
                                ? t('task.documents.deleteEstimateText', 'Файл сметы будет удалён из задачи.')
                                : t('task.documents.deleteDocumentText', 'Файл будет удалён из задачи.')}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={closeDeleteDocumentDialog}
                        disabled={documentDeleting}
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {t('common.cancel', 'Отмена')}
                    </Button>
                    <Button
                        onClick={confirmDeleteDocument}
                        color="error"
                        variant="contained"
                        disabled={documentDeleting}
                        startIcon={
                            documentDeleting ? <CircularProgress size={18} color="inherit" /> : null
                        }
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {t('common.delete', 'Удалить')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)}>
                <DialogTitle>{t('task.delete.title', 'Удалить задачу?')}</DialogTitle>
                <DialogContent>
                    <Typography>
                        {t('task.delete.description', 'Это действие нельзя будет отменить. Задача будет удалена из проекта.')}
                    </Typography>
                    <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                            <Checkbox
                                checked={deleteReports}
                                onChange={(event) => setDeleteReports(event.target.checked)}
                                disabled={deleting}
                            />
                        }
                        label={t('task.delete.reports', 'Удалить связанные с задачей фотоотчеты')}
                    />
                    {task?.taskType === 'document' && (
                        <FormControlLabel
                            sx={{ mt: 1 }}
                            control={
                                <Checkbox
                                    checked={deleteDocuments}
                                    onChange={(event) => setDeleteDocuments(event.target.checked)}
                                    disabled={deleting}
                                />
                            }
                            label={t(
                                'task.delete.documents',
                                'Удалить всю документацию и согласования'
                            )}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeleteOpen(false)}
                        disabled={deleting}
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {t('common.cancel', 'Отмена')}
                    </Button>
                    <Button
                        onClick={handleDelete}
                        color="error"
                        variant="contained"
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={18} color="inherit" /> : null}
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {t('common.delete', 'Удалить')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={applicationConfirm.open}
                onClose={closeApplicationConfirm}
            >
                <DialogTitle>{t('common.confirmAction', 'Подтвердите действие')}</DialogTitle>
                <DialogContent>
                    <Typography>
                        {applicationConfirm.action === 'assign'
                            ? t('task.applications.confirmAssign', 'Назначить исполнителя {name} на задачу?', {
                                name: applicationConfirm.contractorName ? ` ${applicationConfirm.contractorName}` : '',
                            })
                            : t('task.applications.confirmUnassign', 'Снять исполнителя {name} с задачи?', {
                                name: applicationConfirm.contractorName ? ` ${applicationConfirm.contractorName}` : '',
                            })}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={closeApplicationConfirm}
                        disabled={!!applicationActionLoading}
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {t('common.cancel', 'Отмена')}
                    </Button>
                    <Button
                        onClick={() => void confirmApplicationAction()}
                        color={applicationConfirm.action === 'assign' ? 'primary' : 'error'}
                        variant="contained"
                        disabled={!!applicationActionLoading}
                        startIcon={
                            applicationActionLoading === applicationConfirm.applicationId ? (
                                <CircularProgress size={18} color="inherit" />
                            ) : null
                        }
                        sx={{ borderRadius: UI_RADIUS.button }}
                    >
                        {applicationConfirm.action === 'assign'
                            ? t('task.applications.assign', 'Назначить')
                            : t('task.applications.unassign', 'Снять')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={!!documentSnackbar}
                autoHideDuration={3000}
                onClose={handleDocumentSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {documentSnackbar ? (
                    <Alert
                        onClose={handleDocumentSnackbarClose}
                        severity={documentSnackbar.type}
                        variant="filled"
                        sx={{ width: '100%' }}
                    >
                        {documentSnackbar.message}
                    </Alert>
                ) : (
                    <Alert severity="info" sx={{ visibility: 'hidden' }}>
                        placeholder
                    </Alert>
                )}
            </Snackbar>
            <Snackbar
                open={applicationSnack.open}
                autoHideDuration={3000}
                onClose={() => setApplicationSnack((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setApplicationSnack((prev) => ({ ...prev, open: false }))}
                    severity={applicationSnack.sev}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {applicationSnack.message}
                </Alert>
            </Snackbar>
            <Snackbar
                open={publishSnack.open}
                autoHideDuration={3000}
                onClose={() => setPublishSnack((prev) => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setPublishSnack((prev) => ({ ...prev, open: false }))}
                    severity={publishSnack.sev}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {publishSnack.message}
                </Alert>
            </Snackbar>
        </Container>
    );
}
