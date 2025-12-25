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
} from '@mui/material';
import { styled } from '@mui/material/styles';
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
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import WorkspaceTaskDialog from '@/app/workspace/components/WorkspaceTaskDialog';
import type { TaskForEdit } from '@/app/workspace/components/WorkspaceTaskDialog';
import TaskComments from '@/app/components/TaskComments';
import type { TaskComment } from '@/app/components/TaskComments';
import type { ParsedWorkItem } from '@/app/workspace/components/T2/T2EstimateParser';
import { T2NcwGenerator } from '@/app/workspace/components/T2/T2NcwGenerator';
import { getPriorityIcon, normalizePriority } from '@/utils/priorityIcons';
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
import { extractFileNameFromUrl, isDocumentUrl } from '@/utils/taskFiles';
import { normalizeRelatedTasks } from '@/app/utils/relatedTasks';
import type { RelatedTaskRef } from '@/app/types/taskTypes';
import { buildBsAddressFromLocations } from '@/utils/bsLocation';
import ProfilePageContent from '@/app/profile/ProfilePageContent';
import type { PhotoReport } from '@/app/types/taskTypes';

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
    status?: string;
    visibility?: 'public' | 'private';
    publicStatus?: 'open' | 'in_review' | 'assigned' | 'closed';
    bsNumber?: string;
    bsAddress?: string;
    bsLocation?: Array<{ name?: string; coordinates: string; address?: string | null }>;
    totalCost?: number;
    budget?: number | null;
    publicDescription?: string;
    currency?: string;
    skills?: string[];
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

// карточка с тенью как в примере MUI
const CardItem = styled(Paper)(({ theme }) => ({
    backgroundColor: '#fff',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[3],
    ...theme.applyStyles?.('dark', {
        backgroundColor: '#1A2027',
    }),
}));

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

const TASK_SECTION_LABELS: Record<TaskSectionKey, string> = {
    info: 'Информация',
    applications: 'Отклики',
    description: 'Описание',
    geo: 'Геолокация',
    work: 'Состав работ',
    attachments: 'Вложения',
    photoReports: 'Фотоотчеты',
    documents: 'Документы',
    order: 'Заказ',
    comments: 'Комментарии',
    history: 'История',
    related: 'Связанные задачи',
};

const TASK_SECTION_STORAGE_KEY = 'task-section-visibility';

export default function TaskDetailsPage() {
    const params = useParams<{ org: string; project: string; taskId: string }>() as {
        org: string;
        project: string;
        taskId: string;
    };

    const router = useRouter();

    const pageGutter = { xs: 1.5, sm: 2.5, md: 3, lg: 3.5, xl: 4 };
    const masonrySpacing = { xs: 1, sm: 1.5, md: 2 } as const;

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
    const [profileUserId, setProfileUserId] = React.useState<string | null>(null);

    const [orgName, setOrgName] = React.useState<string | null>(null);
    const [projectOperator, setProjectOperator] = React.useState<string | null>(null);
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
    const [publishSkills, setPublishSkills] = React.useState<string[]>([]);
    const [publishSkillsInput, setPublishSkillsInput] = React.useState('');
    const [publishBudgetInput, setPublishBudgetInput] = React.useState('');
    const [publishInfoInput, setPublishInfoInput] = React.useState('');
    const [publishDialogError, setPublishDialogError] = React.useState<string | null>(null);
    const [applications, setApplications] = React.useState<TaskApplication[]>([]);
    const [applicationsLoading, setApplicationsLoading] = React.useState(false);
    const [applicationsError, setApplicationsError] = React.useState<string | null>(null);
    const [applicationActionLoading, setApplicationActionLoading] = React.useState<string | null>(
        null
    );
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
    const skillsInputRef = React.useRef<HTMLInputElement | null>(null);
    const orderFileInputRef = React.useRef<HTMLInputElement | null>(null);

    const asText = (x: unknown): string => {
        if (x === null || typeof x === 'undefined') return '—';
        if (typeof x === 'string') {
            const d = new Date(x);
            if (!Number.isNaN(d.getTime())) return d.toLocaleString('ru-RU');
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
        return d.toLocaleString('ru-RU');
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
        return new Intl.NumberFormat('ru-RU').format(v) + ' ₽';
    };

    const normalizeSkillsInput = (raw: string): string[] => {
        return raw
            .split(/[,\n;]/)
            .map((s) => s.trim())
            .filter(Boolean);
    };

    const mergeSkillsUnique = (base: string[], additions: string[]): string[] => {
        const seen = new Set<string>();
        const result: string[] = [];
        const push = (skill: string) => {
            const normalized = skill.trim();
            if (!normalized) return;
            const key = normalized.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            result.push(normalized);
        };
        base.forEach(push);
        additions.forEach(push);
        return result;
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
    }, [org, project, taskId]);

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
            const data = (await res.json()) as { project?: { operator?: string } };
            setProjectOperator(data.project?.operator ?? null);
        } catch {
            setProjectOperator(null);
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
                setApplicationsError(data.error || 'Не удалось загрузить отклики');
                return;
            }
            setApplications(Array.isArray(data.applications) ? data.applications : []);
        } catch (e) {
            setApplications([]);
            setApplicationsError(e instanceof Error ? e.message : 'Ошибка загрузки откликов');
        } finally {
            setApplicationsLoading(false);
        }
    }, [taskMongoId]);

    const handlePublishToggle = React.useCallback(
        async (
            makePublic: boolean,
            payload?: { skills?: string[]; budget?: number | null; publicDescription?: string }
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
                                skills: payload?.skills,
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
                        message: data.error || 'Не удалось обновить публикацию',
                    });
                    return false;
                }
                setPublishSnack({
                    open: true,
                    sev: 'success',
                    message: makePublic ? 'Задача опубликована' : 'Публикация снята',
                });
                await load();
                return true;
            } catch (e) {
                setPublishSnack({
                    open: true,
                    sev: 'error',
                    message: e instanceof Error ? e.message : 'Ошибка сети',
                });
                return false;
            } finally {
                setPublishLoading(false);
            }
        },
        [taskId, load]
    );

    const openProfileDialog = (userId?: string | null) => {
        if (!userId) return;
        setProfileUserId(String(userId));
        setProfileDialogOpen(true);
    };

    const closeProfileDialog = () => {
        setProfileDialogOpen(false);
        setProfileUserId(null);
    };

    React.useEffect(() => {
        void load();
    }, [load]);

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
        setVisibleSections([...TASK_SECTION_KEYS]);
    };

    const handleClearSections = () => {
        setVisibleSections([]);
    };

    const isSectionVisible = React.useCallback(
        (section: TaskSectionKey) => visibleSections.includes(section),
        [visibleSections]
    );

    const hasCustomVisibility = React.useMemo(
        () => TASK_SECTION_KEYS.some((key) => !visibleSections.includes(key)),
        [visibleSections]
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
            const raw = extractFileNameFromUrl(
                url,
                task?.orderNumber ? `Уведомление_${task.orderNumber}` : 'Уведомление'
            );
            return raw
                .replace(/^Уведомление[_-]?/i, '')
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
                    ? 'Смета'
                    : type === 'order'
                        ? task?.orderNumber || 'Заказ'
                        : type === 'ncw'
                            ? 'Уведомление'
                            : `Документ ${idx + 1}`;
            items.push({
                url,
                type,
                label:
                    type === 'order'
                        ? `Заказ — ${task?.orderNumber || extractFileNameFromUrl(url, fallback)}`
                        : type === 'estimate'
                            ? `Смета — ${extractFileNameFromUrl(url, 'Смета')}`
                            : type === 'ncw'
                                ? `Уведомление — ${formatNcwFileName(url)}`
                                : extractFileNameFromUrl(url, fallback),
            });
            seen.add(url);
        });

        if (task?.orderUrl && !seen.has(task.orderUrl)) {
            items.push({
                url: task.orderUrl,
                type: 'order',
                label: `Заказ — ${task.orderNumber || 'файл заказа'}`,
            });
        }
        if (task?.ncwUrl && !seen.has(task.ncwUrl)) {
            items.push({
                url: task.ncwUrl,
                type: 'ncw',
                label: `Уведомление — ${formatNcwFileName(task.ncwUrl)}`,
            });
        }

        return items;
    }, [documentLinks, task?.ncwUrl, task?.orderNumber, task?.orderUrl]);

    const hasWorkItems = Array.isArray(task?.workItems) && task.workItems.length > 0;
    const hasDocuments = documentItems.length > 0;
    const hasAttachments =
        !!task &&
        ((Array.isArray(task.files) && task.files.length > 0) ||
            attachmentLinks.length > 0);
    const photoReportItems = React.useMemo(() => {
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
    }, [task?.photoReports]);
    const hasPhotoReports = photoReportItems.length > 0;

    const orderCompletionDate = React.useMemo(() => {
        if (!task?.orderSignDate) return null;
        return addDays(task.orderSignDate, 60);
    }, [task?.orderSignDate]);

    const relatedTasks = React.useMemo(
        () => normalizeRelatedTasks(task?.relatedTasks),
        [task?.relatedTasks]
    );

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

    const toEditShape = (t: Task): TaskForEdit => {
        return {
            _id: t._id,
            taskId: t.taskId,
            taskName: t.taskName,
            status: t.status,
            dueDate: t.dueDate,
            bsNumber: t.bsNumber,
            bsAddress: t.bsAddress,
            taskDescription: t.taskDescription,
            totalCost: t.totalCost,
            contractorPayment: t.contractorPayment,
            priority: t.priority,
            executorId: t.executorId,
            executorName: t.executorName,
            executorEmail: t.executorEmail,
            workItems: toEditWorkItems(t.workItems),
            files: t.files?.map((f) => ({ name: f.name, url: f.url, size: f.size })),
            attachments: Array.isArray(t.attachments)
                ? t.attachments.filter((url) => !isDocumentUrl(url))
                : t.attachments,
            bsLocation: t.bsLocation
                ? t.bsLocation.map((loc, idx) => ({
                    name: loc.name ?? `Точка ${idx + 1}`,
                    coordinates: loc.coordinates,
                }))
                : undefined,
            relatedTasks: t.relatedTasks,
        };
    };

    const handleDelete = async () => {
        if (!org || !project || !taskId) return;
        setDeleting(true);
        try {
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                    project
                )}/tasks/${encodeURIComponent(taskId)}`,
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

    const addSkillsFromInput = (raw: string) => {
        const additions = normalizeSkillsInput(raw);
        if (additions.length === 0) return;
        setPublishSkills((prev) => mergeSkillsUnique(prev, additions));
        setPublishSkillsInput('');
        setPublishDialogError(null);
    };

    const handleSkillDelete = (skill: string) => {
        setPublishSkills((prev) =>
            prev.filter((item) => item.trim().toLowerCase() !== skill.trim().toLowerCase())
        );
    };

    const handleSkillsInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSkillsFromInput(publishSkillsInput);
        }
    };

    const focusSkillsInput = () => {
        skillsInputRef.current?.focus();
    };

    const openPublishDialog = () => {
        if (!task) return;
        setPublishSkills(Array.isArray(task.skills) ? mergeSkillsUnique(task.skills, []) : []);
        setPublishSkillsInput('');
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
        const skills = mergeSkillsUnique(publishSkills, normalizeSkillsInput(publishSkillsInput));
        if (skills.length === 0) {
            setPublishDialogError('Добавьте хотя бы один навык');
            return;
        }
        setPublishSkills(skills);
        setPublishSkillsInput('');

        const budgetRaw = publishBudgetInput.trim();
        let budget: number | null | undefined;
        if (budgetRaw) {
            const num = Number(budgetRaw);
            if (Number.isNaN(num) || num < 0) {
                setPublishDialogError('Бюджет должен быть неотрицательным числом');
                return;
            }
            budget = num;
        } else {
            budget = null;
        }

        setPublishDialogError(null);
        const success = await handlePublishToggle(true, {
            skills,
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
    const normalizedStatus = normalizeStatusTitle(task?.status);
    const canUnassignExecutor = ![
        'Done',
        'Pending',
        'Issues',
        'Fixed',
        'Agreed',
    ].includes(normalizedStatus);

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
            return 'Поддерживаются PDF или изображения';
        }
        if (file.size > 20 * 1024 * 1024) {
            return 'Файл больше 20 МБ';
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
            setOrderFormError('Добавьте файл заказа');
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
                let errMsg = 'Не удалось загрузить заказ';
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
            setDocumentSnackbar({ type: 'success', message: 'Заказ загружен' });
            closeAddDocumentDialog();
        } catch (e) {
            console.error(e);
            setDocumentSnackbar({ type: 'error', message: 'Не удалось загрузить заказ' });
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
                    message: data.error || 'Не удалось назначить исполнителя',
                });
                return;
            }
            setApplicationSnack({
                open: true,
                sev: 'success',
                message: 'Исполнитель назначен из отклика',
            });
            await fetchApplications();
            await load();
        } catch (e) {
            setApplicationSnack({
                open: true,
                sev: 'error',
                message: e instanceof Error ? e.message : 'Ошибка назначения',
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
                    message: data.error || 'Не удалось снять исполнителя',
                });
                return;
            }
            setApplicationSnack({
                open: true,
                sev: 'success',
                message: 'Исполнитель снят с задачи',
            });
            await fetchApplications();
            await load();
        } catch (e) {
            setApplicationSnack({
                open: true,
                sev: 'error',
                message:
                    e instanceof Error ? e.message : 'Ошибка при снятии исполнителя',
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
        if (action === 'created') return 'Задача создана';
        if (action === 'status_changed_assigned') return 'Задача назначена исполнителю';
        if (action === 'updated' && ev && isExecutorRemovedEvent(ev)) {
            return 'Исполнитель снят с задачи';
        }
        if (action === 'updated') return 'Задача изменена';
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
                        Задача: {taskNameStr}
                    </Typography>
                    <Typography variant="caption" display="block">
                        BS: {bsNumberStr}
                    </Typography>
                    <Typography variant="caption" display="block">
                        Статус: {statusStr}
                    </Typography>
                    <Typography variant="caption" display="block">
                        Приоритет: {priorityStr}
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
                statusLine = `Статус: ${asText(st.from)} → ${asText(st.to)}`;
            }

            return (
                <>
                    <Typography variant="caption" display="block">
                        Исполнитель: {executorStr}
                    </Typography>
                    {executorEmailStr !== '—' && (
                        <Typography variant="caption" display="block">
                            Email: {executorEmailStr}
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
                    statusLine = `Статус: ${asText(ch.from)} → ${asText(ch.to)}`;
                }

                return (
                    <>
                        <Typography variant="caption" display="block">
                            Исполнитель: —
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
                            {key}: {asText(value.from)} → {asText(value.to)}
                        </Typography>
                    );
                }
                return (
                    <Typography key={key} variant="caption" display="block">
                        {key}: {asText(value)}
                    </Typography>
                );
            });
        }

        // fallback
        return Object.entries(d).map(([key, value]) => (
            <Typography key={key} variant="caption" display="block">
                {key}: {value === null || typeof value === 'undefined' ? '—' : String(value)}
            </Typography>
        ));
    };

    const getEventAuthorLine = (ev: TaskEvent): string => {
        const detailEmail =
            ev.details && typeof ev.details.authorEmail === 'string'
                ? ev.details.authorEmail
                : undefined;
        const email = ev.authorEmail || detailEmail;
        if (email && ev.author) return `${ev.author} (${email})`;
        if (email) return email;
        return ev.author;
    };

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
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <Tooltip title="Назад">
                        <IconButton onClick={() => router.back()}>
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>
                    <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
                                {task?.taskName || 'Задача'}
                            </Typography>
                            {task?.bsNumber && (
                                <Typography variant="h6">{task.bsNumber}</Typography>
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

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}
                        >
                            Организация:{' '}
                            <Link
                                href={`/org/${encodeURIComponent(org)}`}
                                underline="hover"
                                color="inherit"
                            >
                                {orgName || org}
                            </Link>
                            • Проект:{' '}
                            <Link
                                href={`/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                                    project
                                )}/tasks`}
                                underline="hover"
                                color="inherit"
                            >
                                {project}
                            </Link>
                        </Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                    {task && !executorAssigned && (
                        <Button
                            variant={task.visibility === 'public' ? 'outlined' : 'contained'}
                            color={task.visibility === 'public' ? 'inherit' : 'primary'}
                            size="small"
                            startIcon={<GroupsIcon />}
                            onClick={() =>
                                task.visibility === 'public'
                                    ? void handlePublishToggle(false)
                                    : openPublishDialog()
                            }
                            disabled={publishLoading}
                        >
                            {publishLoading
                                ? 'Сохраняем…'
                                : task.visibility === 'public'
                                    ? 'Снять с публикации'
                                    : 'Опубликовать'}
                        </Button>
                    )}
                    <Tooltip title="Настроить">
                        <IconButton
                            onClick={() => setSectionDialogOpen(true)}
                            color={hasCustomVisibility ? 'primary' : 'default'}
                        >
                            <GridViewOutlinedIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Обновить">
                        <span>
                            <IconButton onClick={() => void load()} disabled={loading}>
                                <RefreshIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Редактировать">
                        <span>
                            <IconButton
                                onClick={() => task && setEditOpen(true)}
                                disabled={loading || !task}
                            >
                                <EditNoteIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Удалить">
                        <span>
                            <IconButton
                                onClick={() => task && setDeleteOpen(true)}
                                disabled={loading || !task}
                            >
                                <DeleteOutlineIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>

            {/* Content */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography color="error" sx={{ mb: 1 }}>
                        {error}
                    </Typography>
                    <Button variant="outlined" onClick={() => void load()}>
                        Повторить
                    </Button>
                </Paper>
            ) : !task ? (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography>Задача не найдена.</Typography>
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
                        {/* Информация */}
                        {isSectionVisible('info') && (
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
                                    {/* БС */}
                                    <Typography variant="body1">
                                        <strong>Базовая станция:</strong> {task.bsNumber || '—'}
                                    </Typography>

                                    {/* Адрес */}
                                    <Typography variant="body1">
                                        <strong>Адрес:</strong> {task.bsAddress || 'Адрес не указан'}
                                    </Typography>

                                    <Typography variant="body1">
                                        <strong>Срок:</strong>{' '}
                                        {task.dueDate ? formatDate(task.dueDate) : '—'}
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
                                        <strong>Стоимость:</strong> {formatPrice(task.totalCost)}
                                    </Typography>
                                    <Typography variant="body1">
                                        <strong>Плановый бюджет:</strong> {formatPrice(task.budget)}
                                    </Typography>
                                    <Typography variant="body1">
                                        <strong>Утвержденная оплата подрядчику:</strong>{' '}
                                        {formatPrice(task.contractorPayment)}
                                    </Typography>
                                    <Typography variant="body1">
                                        <strong>Тип задачи:</strong> {task.taskType || '—'}
                                    </Typography>

                                    <Typography variant="body1">
                                        <strong>Навыки:</strong>{' '}
                                        {Array.isArray(task.skills) && task.skills.length > 0 ? (
                                            <Stack direction="row" spacing={0.5} component="span" sx={{ flexWrap: 'wrap' }}>
                                                {task.skills.map((skill) => (
                                                    <Chip
                                                        key={skill}
                                                        label={skill}
                                                        size="small"
                                                        sx={{ mr: 0.5, mb: 0.5 }}
                                                    />
                                                ))}
                                            </Stack>
                                        ) : (
                                            'Не указаны'
                                        )}
                                    </Typography>

                                    {/* Исполнитель (если есть) */}
                                    {(task.executorName || task.executorEmail) && (
                                        <Typography variant="body1">
                                            <strong>Исполнитель:</strong>{' '}
                                            {task.executorName || task.executorEmail}
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
                                    {task.publicDescription && (
                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                            <strong>Информация для подрядчика:</strong>{' '}
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
                                            <strong>Создана:</strong>{' '}
                                            {task.createdAt ? formatDate(task.createdAt) : '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Обновлена:</strong>{' '}
                                            {task.updatedAt ? formatDate(task.updatedAt) : '—'}
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
                                        Отклики
                                    </Typography>
                                    <Tooltip title="Обновить список откликов">
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
                                            Загружаем отклики…
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
                                                Повторить
                                            </Button>
                                        }
                                    >
                                        {applicationsError}
                                    </Alert>
                                ) : applications.length === 0 ? (
                                    <Typography color="text.secondary">
                                        Пока нет откликов на задачу
                                    </Typography>
                                ) : (
                                    <Stack spacing={1.5}>
                                        {applications.map((app) => {
                                            const appId = app._id ? String(app._id) : '';
                                            const statusLabelMap: Record<string, string> = {
                                                submitted: 'На рассмотрении',
                                                shortlisted: 'В шорт-листе',
                                                accepted: 'Назначен',
                                                rejected: 'Отклонён',
                                                withdrawn: 'Отозван',
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
                                                    sx={{ p: 1.5, borderRadius: 2 }}
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
                                                                        app.contractorId ? 'hover' : 'none'
                                                                    }
                                                                    color="inherit"
                                                                    component={
                                                                        app.contractorId ? 'button' : 'span'
                                                                    }
                                                                    type={
                                                                        app.contractorId ? 'button' : undefined
                                                                    }
                                                                    onClick={
                                                                        app.contractorId
                                                                            ? () => openProfileDialog(app.contractorId)
                                                                            : undefined
                                                                    }
                                                                    sx={{
                                                                        wordBreak: 'break-word',
                                                                        textAlign: 'left',
                                                                        p: 0,
                                                                        m: 0,
                                                                        border: 'none',
                                                                        background: 'none',
                                                                        cursor: app.contractorId ? 'pointer' : 'default',
                                                                        color: app.contractorId ? 'primary.main' : 'inherit',
                                                                        fontWeight: 600,
                                                                    }}
                                                                >
                                                                    {app.contractorName ||
                                                                        app.contractorEmail ||
                                                                        'Подрядчик'}
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
                                                                Ставка: {formatPrice(app.proposedBudget)}
                                                            </Typography>
                                                            {typeof app.etaDays === 'number' && (
                                                                <Typography variant="body2">
                                                                    Срок: {app.etaDays} дн.
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
                                                                >
                                                                    {isAccepted ? 'Снять' : 'Назначить'}
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
                                    sx={{ '&:before': { display: 'none' } }}
                                >
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography
                                            variant="subtitle1"
                                            fontWeight={600}
                                            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                        >
                                            <LinkOutlinedIcon fontSize="small" />
                                            Связанные задачи
                                        </Typography>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ pt: 0 }}>
                                        <Divider sx={{ mb: 1.5 }} />
                                        <Stack spacing={1}>
                                            {relatedTasks.map((related) => {
                                                const detailLabel = related.bsNumber ? `BS ${related.bsNumber}` : null;
                                                const statusLabel = related.status
                                                    ? getStatusLabel(normalizeStatusTitle(related.status))
                                                    : undefined;
                                                const href = `/org/${encodeURIComponent(
                                                    org || ''
                                                )}/projects/${encodeURIComponent(project || '')}/tasks/${encodeURIComponent(
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
                                                            borderRadius: 2,
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
                                    Описание
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                                    {task.taskDescription}
                                </Typography>
                            </CardItem>
                        )}

                        {/* Геолокация */}
                        {isSectionVisible('geo') && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <TaskGeoLocation locations={task.bsLocation} />
                            </CardItem>
                        )}

                        {/* Состав работ */}
                        {isSectionVisible('work') && (hasWorkItems || Array.isArray(task.workItems)) && (
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
                                    <AccordionDetails sx={{ pt: 0 }}>
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
                                    Вложения
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
                                            {file.name || `Файл ${idx + 1}`}
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
                                            {extractFileNameFromUrl(url, `Вложение ${idx + 1}`)}
                                        </Link>
                                    ))}
                                </Stack>
                            </CardItem>
                        )}

                        {isSectionVisible('photoReports') && hasPhotoReports && task.taskId && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    gutterBottom
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <ArticleOutlinedIcon fontSize="small" />
                                    Фотоотчеты
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                <Stack spacing={1.5}>
                                    {photoReportItems.map((report) => {
                                        const statusLabel = getStatusLabel(report.status);
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
                                                    >
                                                        Папка БС {report.baseId}
                                                    </Link>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Основные фото: {report.filesCount} · Исправления:{' '}
                                                        {report.fixedCount}
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
                                    Документы
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
                                                    ? 'Удалить заказ'
                                                    : doc.type === 'ncw'
                                                        ? 'Удалить уведомление'
                                                        : 'Удалить смету';

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
                                            >
                                                Добавить
                                            </Button>
                                        </Box>
                                    </Stack>
                                ) : (
                                    <Stack gap={1}>
                                        <Typography color="text.secondary">
                                            Документы отсутствуют
                                        </Typography>
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                variant="outlined"
                                                onClick={openAddDocumentDialog}
                                            >
                                                Добавить
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
                                    Заказ
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                <Stack gap={0.5}>
                                    {task.orderNumber && (
                                        <Typography>
                                            Номер: {task.orderNumber}
                                        </Typography>
                                    )}
                                    {task.orderDate && (
                                        <Typography>
                                            Дата заказа:{' '}
                                            {formatDate(task.orderDate)}
                                        </Typography>
                                    )}
                                    {task.orderSignDate && (
                                        <Typography>
                                            Дата подписания:{' '}
                                            {formatDate(task.orderSignDate)}
                                        </Typography>
                                    )}
                                    {orderCompletionDate && (
                                        <Typography>
                                            Срок выполнения:{' '}
                                            {formatDate(orderCompletionDate)}
                                        </Typography>
                                    )}
                                    {task.orderUrl && (
                                        <Button
                                            href={task.orderUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            variant="text"
                                            sx={{ alignSelf: 'flex-start' }}
                                        >
                                            Открыть заказ
                                        </Button>
                                    )}
                                </Stack>
                            </CardItem>
                        )}

                        {/* Комментарии */}
                        {isSectionVisible('comments') && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Accordion
                                    defaultExpanded={!!task?.comments?.length}
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
                                    <AccordionDetails sx={{ pt: 0 }}>
                                        <Divider sx={{ mb: 1.5 }} />
                                        {renderCommentsSection()}
                                    </AccordionDetails>
                                </Accordion>
                            </CardItem>
                        )}

                        {/* История */}
                        {isSectionVisible('history') && (
                            <CardItem sx={{ p: 0, minWidth: 0 }}>
                                <Accordion
                                    disableGutters
                                    elevation={0}
                                    sx={{ '&:before': { display: 'none' } }}
                                >
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
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
                                    <AccordionDetails sx={{ pt: 0 }}>
                                        <Divider sx={{ mb: 1.5 }} />
                                        {sortedEvents.length === 0 ? (
                                            <Typography
                                                color="text.secondary"
                                                sx={{ px: 2, pb: 1.5 }}
                                            >
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
                                                                Автор:{' '}
                                                                {getEventAuthorLine(ev)}
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

            <Dialog
                open={profileDialogOpen}
                onClose={closeProfileDialog}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>Профиль исполнителя</DialogTitle>
                <DialogContent dividers>
                    {profileUserId ? (
                        <ProfilePageContent mode="public" userId={profileUserId} />
                    ) : (
                        <Typography>Пользователь не указан</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeProfileDialog}>Закрыть</Button>
                </DialogActions>
            </Dialog>

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
                        Выбор блоков
                    </Typography>
                    <IconButton onClick={() => setSectionDialogOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {TASK_SECTION_KEYS.map((section) => (
                        <FormControlLabel
                            key={section}
                            control={
                                <Checkbox
                                    checked={isSectionVisible(section)}
                                    onChange={() => handleSectionToggle(section)}
                                />
                            }
                            label={TASK_SECTION_LABELS[section]}
                        />
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleSelectAllSections} startIcon={<CheckBoxIcon />}>
                        Выбрать все
                    </Button>
                    <Button onClick={handleClearSections} startIcon={<CheckBoxOutlineBlankIcon />}>
                        Очистить
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={publishDialogOpen}
                onClose={closePublishDialog}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Публикация задачи</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        Добавьте навыки, плановый бюджет (по умолчанию попадёт в ставку отклика) и
                        дайте более подробную информацию о задаче. Эти данные увидят подрядчики перед
                        откликом, но смогут скорректировать ставку.
                    </Typography>
                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2">Необходимые навыки</Typography>
                        <Box
                            sx={(theme) => ({
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 1,
                                p: 1,
                                minHeight: 56,
                                borderRadius: 1,
                                border: `1px solid ${theme.palette.divider}`,
                                cursor: 'text',
                            })}
                            onClick={focusSkillsInput}
                        >
                            {publishSkills.map((skill) => (
                                <Chip
                                    key={skill}
                                    label={skill}
                                    onDelete={() => handleSkillDelete(skill)}
                                    size="small"
                                />
                            ))}
                            <TextField
                                inputRef={skillsInputRef}
                                value={publishSkillsInput}
                                onChange={(e) => setPublishSkillsInput(e.target.value)}
                                onKeyDown={handleSkillsInputKeyDown}
                                placeholder="Введите навык и нажмите Enter"
                                variant="standard"
                                InputProps={{ disableUnderline: true }}
                                sx={{ minWidth: 160, flexGrow: 1 }}
                            />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                            Добавляйте навыки по одному, нажимая Enter. Теги можно удалить крестиком.
                        </Typography>
                    </Stack>
                    <TextField
                        label="Планируемый бюджет"
                        type="number"
                        value={publishBudgetInput}
                        onChange={(e) => setPublishBudgetInput(e.target.value)}
                        placeholder="Например, 120000"
                        helperText="Можно оставить пустым"
                        fullWidth
                        inputProps={{ min: 0 }}
                    />
                    <TextField
                        label="Информация о задаче"
                        placeholder="Подробнее опишите задачу для публикации"
                        value={publishInfoInput}
                        onChange={(e) => setPublishInfoInput(e.target.value)}
                        helperText="Эта информация будет показана подрядчикам"
                        fullWidth
                        multiline
                        minRows={3}
                    />
                    {publishDialogError && (
                        <Alert severity="error">{publishDialogError}</Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closePublishDialog} disabled={publishLoading}>
                        Отмена
                    </Button>
                    <Button
                        onClick={() => void handlePublishSubmit()}
                        variant="contained"
                        disabled={publishLoading}
                        startIcon={
                            publishLoading ? <CircularProgress size={18} color="inherit" /> : undefined
                        }
                    >
                        Опубликовать
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={documentDialogOpen}
                onClose={closeAddDocumentDialog}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Добавить документ</DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {!selectedDocumentType ? (
                        <Stack spacing={2}>
                            <Typography variant="body2" color="text.secondary">
                                Выберите тип документа для добавления.
                            </Typography>
                            <Button
                                variant="outlined"
                                onClick={handleSelectOrderDocument}
                                startIcon={<ArticleOutlinedIcon />}
                                sx={{ alignSelf: 'flex-start' }}
                            >
                                Заказ на выполнение работ
                            </Button>
                            {canCreateNcw && (
                                <Button
                                    variant="outlined"
                                    onClick={openNcwCreator}
                                    startIcon={<DescriptionOutlinedIcon />}
                                    sx={{ alignSelf: 'flex-start' }}
                                >
                                    Создать уведомление
                                </Button>
                            )}
                        </Stack>
                    ) : (
                        <Stack spacing={2}>
                            <Typography variant="body2">
                                Заполните данные и прикрепите файл заказа.
                            </Typography>
                            <TextField
                                label="Номер заказа"
                                value={orderNumberInput}
                                onChange={(e) => setOrderNumberInput(e.target.value)}
                                size="small"
                                fullWidth
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <TextField
                                    label="Дата заказа"
                                    type="date"
                                    value={orderDateInput}
                                    onChange={(e) => setOrderDateInput(e.target.value)}
                                    size="small"
                                    fullWidth
                                    slotProps={{ inputLabel: { shrink: true } }}
                                />
                                <TextField
                                    label="Дата подписания"
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
                                    borderRadius: 1.5,
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
                                        Перетащите файл сюда или нажмите, чтобы выбрать
                                    </Typography>
                                    {orderFile && (
                                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                            Выбран файл: {orderFile.name}
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
                        <Button onClick={closeAddDocumentDialog} disabled={orderUploading}>
                            Отмена
                        </Button>
                        <Button
                            onClick={handleOrderSubmit}
                            variant="contained"
                            disabled={orderUploading}
                            startIcon={
                                orderUploading ? <CircularProgress size={18} color="inherit" /> : null
                            }
                        >
                            Загрузить
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
                        Создание уведомления о завершении работ
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
                        Комментарии
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
                        ? 'Удалить заказ?'
                        : documentToDeleteType === 'estimate'
                            ? 'Удалить смету?'
                            : 'Удалить документ?'}
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        {documentToDeleteType === 'order'
                            ? 'Файл заказа и данные о заказе будут удалены из задачи.'
                            : documentToDeleteType === 'estimate'
                                ? 'Файл сметы будет удалён из задачи.'
                                : 'Файл будет удалён из задачи.'}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDocumentDialog} disabled={documentDeleting}>
                        Отмена
                    </Button>
                    <Button
                        onClick={confirmDeleteDocument}
                        color="error"
                        variant="contained"
                        disabled={documentDeleting}
                        startIcon={
                            documentDeleting ? <CircularProgress size={18} color="inherit" /> : null
                        }
                    >
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)}>
                <DialogTitle>Удалить задачу?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Это действие нельзя будет отменить. Задача будет удалена из проекта.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
                        Отмена
                    </Button>
                    <Button
                        onClick={handleDelete}
                        color="error"
                        variant="contained"
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={18} color="inherit" /> : null}
                    >
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={applicationConfirm.open}
                onClose={closeApplicationConfirm}
            >
                <DialogTitle>Подтвердите действие</DialogTitle>
                <DialogContent>
                    <Typography>
                        {applicationConfirm.action === 'assign'
                            ? `Назначить исполнителя${
                                applicationConfirm.contractorName ? ` ${applicationConfirm.contractorName}` : ''
                            } на задачу?`
                            : `Снять исполнителя${
                                applicationConfirm.contractorName ? ` ${applicationConfirm.contractorName}` : ''
                            } с задачи?`}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeApplicationConfirm} disabled={!!applicationActionLoading}>
                        Отмена
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
                    >
                        {applicationConfirm.action === 'assign' ? 'Назначить' : 'Снять'}
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
