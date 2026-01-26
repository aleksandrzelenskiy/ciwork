// src/app/workspace/components/WorkspaceTaskDialog.tsx
'use client';

import * as React from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Avatar,
    ListItemText,
    Chip,
    IconButton,
    Typography,
    LinearProgress,
    Tooltip,
    Snackbar,
    Alert,
    Drawer,
    Divider,
    Collapse,
    Link,
    Slider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import TableRowsIcon from '@mui/icons-material/TableRows';
import { YMaps, Map, Placemark } from '@pbe/react-yandex-maps';
import T2EstimateParser, {
    ParsedEstimateResult,
    ParsedWorkItem,
} from '@/app/workspace/components/T2/T2EstimateParser';
import BeIdParser, {
    ParsedBeIdResult,
} from '@/app/workspace/components/Be/BeIdParser';
import {
    extractBsNumbersFromString,
    DEFAULT_BS_PREFIXES,
} from '@/app/workspace/components/T2/t2EstimateHelpers';
import { isDocumentUrl } from '@/utils/taskFiles';
import { normalizeRelatedTasks } from '@/app/utils/relatedTasks';
import type { RelatedTaskRef } from '@/app/types/taskTypes';
import WorkItemsEditorDialog from '@/app/workspace/components/WorkItemsEditorDialog';
import { UI_RADIUS } from '@/config/uiTokens';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';



type Priority = 'urgent' | 'high' | 'medium' | 'low';

type MemberOption = {
    id: string;
    name: string;
    email: string;
    profilePic?: string;
    clerkId?: string;
    profileType?: 'employer' | 'contractor';
    specializations?: Array<'installation' | 'document'>;
};

type MembersApi = {
    members: Array<{
        _id: string;
        userName?: string;
        userEmail: string;
        profilePic?: string;
        clerkId?: string;
        profileType?: 'employer' | 'contractor';
        specializations?: Array<'installation' | 'document'>;
    }>;
    error?: string;
};

type RelatedTaskOption = {
    id: string;
    taskId?: string;
    taskName: string;
    bsNumber?: string;
};

type InitiatorOption = {
    name: string;
    email: string;
};

export type TaskForEdit = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: string;
    dueDate?: string;
    bsNumber?: string;
    bsAddress?: string;
    taskDescription?: string;
    documentInputNotes?: string;
    documentInputLinks?: string[];
    documentInputPhotos?: string[];
    documentStages?: string[];
    documentReviewFiles?: string[];
    documentFinalFiles?: string[];
    documentFinalFormats?: string[];
    bsLatitude?: number;
    bsLongitude?: number;
    totalCost?: number;
    contractorPayment?: number;
    priority?: Priority | string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
    initiatorName?: string;
    initiatorEmail?: string;
    files?: Array<{ name?: string; url?: string; size?: number }>;
    attachments?: string[];
    bsLocation?: Array<{ name: string; coordinates: string; address?: string }>;
    workItems?: ParsedWorkItem[];
    relatedTasks?: (string | RelatedTaskRef)[];
};

type Props = {
    open: boolean;
    org: string;
    project: string;
    onCloseAction: () => void;
    onCreatedAction: () => void;
    mode?: 'create' | 'edit';
    initialTask?: TaskForEdit | null;
};

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genId(len = 5) {
    let s = '';
    for (let i = 0; i < len; i++) s += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
    return s;
}

const normalizeSpecializations = (value?: string[] | null): Array<'installation' | 'document'> => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (item === 'construction' ? 'installation' : item))
        .filter((item): item is 'installation' | 'document' => item === 'installation' || item === 'document');
};

function extractErrorMessage(payload: unknown, fallback: string): string {
    const err = (payload as { error?: unknown })?.error;
    return typeof err === 'string' && err.trim() ? err : fallback;
}

type BsOption = {
    id: string;
    name: string;
    address?: string;
    lat?: number | null;
    lon?: number | null;
};

type BsFormEntry = {
    id: string;
    bsNumber: string;
    bsInput: string;
    bsAddress: string;
    bsLatitude: string;
    bsLongitude: string;
    selectedBsOption: BsOption | null;
};

function getDisplayBsName(raw: string): string {
    const trimmed = raw.trim();
    if (/^IR\d+/i.test(trimmed)) {
        const firstPart = trimmed.split(',')[0]?.trim();
        return firstPart || trimmed;
    }
    return trimmed;
}

function normalizeAddressFromDb(bsNumber: string, raw?: string): string {
    let addr = (raw ?? '').trim();
    if (addr.startsWith('-')) {
        addr = addr.slice(1).trim();
    }
    const hasIrPrefix = /^IR\d+/i.test(bsNumber.trim());
    if (hasIrPrefix) {
        if (!addr.toLowerCase().startsWith('иркутская область')) {
            addr = `Иркутская область, ${addr}`;
        }
    }
    return addr;
}

const defaultFilter = createFilterOptions<BsOption>();

function getFileNameFromUrl(url?: string): string {
    if (!url) return 'file';
    try {
        const parts = url.split('/');
        return parts[parts.length - 1] || url;
    } catch {
        return url;
    }
}

const YMAPS_API_KEY =
    process.env.NEXT_PUBLIC_YANDEX_MAPS_APIKEY ??
    process.env.NEXT_PUBLIC_YMAPS_API_KEY ??
    '';

function isLatValueValid(v: string): boolean {
    const trimmed = v.trim();
    if (!trimmed) return true;
    const n = Number(trimmed.replace(',', '.'));
    return Number.isFinite(n) && n >= -90 && n <= 90;
}

function isLngValueValid(v: string): boolean {
    const trimmed = v.trim();
    if (!trimmed) return true;
    const n = Number(trimmed.replace(',', '.'));
    return Number.isFinite(n) && n >= -180 && n <= 180;
}

function parseDmsToDecimal(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const hasDmsMarkers = /[°'"]/.test(trimmed) || /[NSEW]/i.test(trimmed);
    if (!hasDmsMarkers) return null;

    const directionMatch = trimmed.match(/[NSEW]/i);
    let sign = 1;
    if (directionMatch && /[SW]/i.test(directionMatch[0])) {
        sign = -1;
    }
    if (trimmed.startsWith('-')) {
        sign = -1;
    }

    const parts = trimmed
        .replace(/[NSEW]/gi, '')
        .replace(/[^\d,.\-]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) return null;

    const deg = Number(parts[0].replace(',', '.'));
    const min = parts.length > 1 ? Number(parts[1].replace(',', '.')) : 0;
    const sec = parts.length > 2 ? Number(parts[2].replace(',', '.')) : 0;

    if (![deg, min, sec].every((n) => Number.isFinite(n))) return null;
    if (Math.abs(min) >= 60 || Math.abs(sec) >= 60) return null;

    const absDeg = Math.abs(deg);
    const decimal = absDeg + Math.abs(min) / 60 + Math.abs(sec) / 3600;
    return sign * decimal;
}

function formatDecimalCoord(value: number): string {
    return value.toFixed(6).replace(/\.?0+$/, '');
}

function parseLatLonFromCoordinates(coord?: string | null): { lat: string; lon: string } {
    if (!coord) return { lat: '', lon: '' };
    const parts = coord.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return { lat: parts[0], lon: parts[1] };
    }
    return { lat: '', lon: '' };
}

function parseNumberOrUndefined(v: string): number | undefined {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
}

function getTaskBsNumber(entries: BsFormEntry[]): string {
    return entries
        .map((e: BsFormEntry) => e.bsNumber.trim())
        .filter(Boolean)
        .join('-');
}

function getPrimaryAddress(entries: BsFormEntry[]): string {
    const addresses = entries
        .map((e: BsFormEntry) => e.bsAddress.trim())
        .filter(Boolean);
    if (addresses.length > 1) {
        return addresses.join('; ');
    }
    return addresses[0] ?? '';
}

function splitAddresses(raw?: string | null): string[] {
    if (!raw) return [];
    return raw
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
}

function sanitizeWorkItemsInput(value: unknown): ParsedWorkItem[] {
    if (!Array.isArray(value)) return [];
    const parsed: ParsedWorkItem[] = [];
    value.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const raw = item as Partial<ParsedWorkItem>;
        const workType = typeof raw.workType === 'string' ? raw.workType.trim() : '';
        const unit = typeof raw.unit === 'string' ? raw.unit.trim() : '';
        const qtyRaw = raw.quantity;
        const quantity = typeof qtyRaw === 'number' ? qtyRaw : Number(qtyRaw);
        if (!workType || !unit || !Number.isFinite(quantity)) return;
        const note = typeof raw.note === 'string' && raw.note.trim() ? raw.note.trim() : undefined;
        parsed.push({ workType, unit, quantity, note });
    });
    return parsed;
}

function formatRelatedTaskLabel(opt: RelatedTaskOption): string {
    const parts: string[] = [];
    if (opt.taskId) parts.push(`#${opt.taskId}`);
    parts.push(opt.taskName);
    if (opt.bsNumber) parts.push(`BS ${opt.bsNumber}`);
    return parts.filter(Boolean).join(' · ');
}

function mapTaskToRelatedOption(raw: unknown): RelatedTaskOption | null {
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;
    const idRaw = obj._id ?? obj.id;
    if (!idRaw) return null;
    const taskName =
        typeof obj.taskName === 'string' && obj.taskName.trim()
            ? obj.taskName.trim()
            : typeof obj.taskId === 'string'
                ? obj.taskId
                : '';
    if (!taskName) return null;
    const taskId = typeof obj.taskId === 'string' ? obj.taskId : undefined;
    const bsNumber = typeof obj.bsNumber === 'string' ? obj.bsNumber : undefined;
    return {
        id: String(idRaw),
        taskId,
        taskName,
        bsNumber,
    };
}

function dedupeRelatedOptions(list: RelatedTaskOption[], excludeId?: string | null): RelatedTaskOption[] {
    const seen = new Set<string>();
    const res: RelatedTaskOption[] = [];
    list.forEach((opt) => {
        if (!opt || !opt.id) return;
        if (excludeId && opt.id === excludeId) return;
        if (seen.has(opt.id)) return;
        seen.add(opt.id);
        res.push(opt);
    });
    return res;
}


export default function WorkspaceTaskDialog({
                                                open,
                                                org,
                                                project,
                                                onCloseAction,
                                                onCreatedAction,
                                                mode = 'create',
                                                initialTask = null,
                                            }: Props) {
    const { t } = useI18n();
    const isEdit = mode === 'edit';
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const drawerBg = isDarkMode
        ? 'linear-gradient(180deg, rgba(10,14,24,0.95), rgba(8,11,19,0.96))'
        : 'linear-gradient(180deg, rgba(250,252,255,0.9), rgba(240,244,252,0.92))';
    const drawerBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.3)';
    const drawerShadow = isDarkMode ? '-35px 0 80px rgba(0,0,0,0.7)' : '-35px 0 80px rgba(15,23,42,0.35)';
    const headerBg = isDarkMode
        ? 'linear-gradient(120deg, rgba(18,26,42,0.95), rgba(14,20,35,0.9))'
        : 'linear-gradient(120deg, rgba(255,255,255,0.95), rgba(240,248,255,0.9))';
    const headerDivider = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.25)';
    const cardBg = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)';
    const cardBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.3)';
    const mapBorder = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(148,163,184,0.35)';
    const percentBg = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(241,245,249,0.5)';
    const percentBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(148,163,184,0.35)';
    const dropBg = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)';
    const dropHoverBg = isDarkMode ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)';
    const dropBorder = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(148,163,184,0.5)';
    const dividerColor = headerDivider;
    const alertInfoBg = isDarkMode ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.06)';
    const actionsBg = isDarkMode ? 'rgba(10,13,22,0.95)' : 'rgba(255,255,255,0.9)';
    const glassInputSx = React.useMemo(
        () => ({
            '& .MuiOutlinedInput-root': {
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
                borderRadius: UI_RADIUS.tooltip,
                '& fieldset': {
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.6)',
                },
                '&:hover fieldset': {
                    borderColor: isDarkMode ? 'rgba(125,211,252,0.6)' : 'rgba(147,197,253,0.9)',
                },
                '&.Mui-focused fieldset': { borderColor: 'rgba(59,130,246,0.8)' },
            },
        }),
        [isDarkMode]
    );

    const orgSlug = React.useMemo(() => org?.trim(), [org]);
    const projectRef = React.useMemo(() => project?.trim(), [project]);
    const excludeCurrentTaskId = React.useMemo(
        () => (initialTask?._id ? String(initialTask._id) : null),
        [initialTask?._id]
    );
    const apiPath = React.useCallback(
        (path: string) => {
            if (!orgSlug) throw new Error('org is required');
            return `/api/org/${encodeURIComponent(orgSlug)}${path}`;
        },
        [orgSlug]
    );

    const [estimateDialogOpen, setEstimateDialogOpen] = React.useState(false);
    const [beIdDialogOpen, setBeIdDialogOpen] = React.useState(false);

    const [saving, setSaving] = React.useState(false);

    const [taskName, setTaskName] = React.useState('');
    const [bsEntries, setBsEntries] = React.useState<BsFormEntry[]>([
        {
            id: 'bs-main',
            bsNumber: '',
            bsInput: '',
            bsAddress: '',
            bsLatitude: '',
            bsLongitude: '',
            selectedBsOption: null,
        },
    ]);
    const [taskDescription, setTaskDescription] = React.useState('');
    const [priority, setPriority] = React.useState<Priority>('medium');
    const [dueDate, setDueDate] = React.useState<Date | null>(new Date());

    // новое поле: стоимость
    const [totalCost, setTotalCost] = React.useState<string>('');
    const [workItems, setWorkItems] = React.useState<ParsedWorkItem[]>([]);
    const [contractorPayment, setContractorPayment] = React.useState<string>('');
    const [percentEditorOpen, setPercentEditorOpen] = React.useState(false);
    const [workItemsDialogOpen, setWorkItemsDialogOpen] = React.useState(false);

    const [projectMeta, setProjectMeta] = React.useState<{ regionCode?: string; operator?: string; projectType?: 'installation' | 'document' } | null>(null);
    const isT2Operator = React.useMemo(() => projectMeta?.operator === '250020', [projectMeta?.operator]);
    const isBeelineOperator = React.useMemo(() => projectMeta?.operator === '250099', [projectMeta?.operator]);
    const isDocumentProject = projectMeta?.projectType === 'document';

    const [members, setMembers] = React.useState<MemberOption[]>([]);
    const [membersLoading, setMembersLoading] = React.useState(false);
    const [membersError, setMembersError] = React.useState<string | null>(null);
    const [selectedExecutor, setSelectedExecutor] = React.useState<MemberOption | null>(null);

    const requiredSpecialization: 'installation' | 'document' = isDocumentProject ? 'document' : 'installation';
    const eligibleMembers = React.useMemo(
        () =>
            members.filter((member) =>
                Array.isArray(member.specializations)
                    ? member.specializations.includes(requiredSpecialization)
                    : false
            ),
        [members, requiredSpecialization]
    );
    const selectedExecutorMismatch = React.useMemo(() => {
        if (!selectedExecutor) return false;
        return !eligibleMembers.some((member) => member.id === selectedExecutor.id);
    }, [eligibleMembers, selectedExecutor]);
    const executorOptions = React.useMemo(() => {
        if (!selectedExecutorMismatch || !selectedExecutor) return eligibleMembers;
        return [selectedExecutor, ...eligibleMembers];
    }, [eligibleMembers, selectedExecutor, selectedExecutorMismatch]);

    const [initiatorName, setInitiatorName] = React.useState('');
    const [initiatorEmail, setInitiatorEmail] = React.useState('');
    const [showInitiatorFields, setShowInitiatorFields] = React.useState(false);
    const [initiatorOptions, setInitiatorOptions] = React.useState<InitiatorOption[]>([]);
    const [initiatorOptionsLoading, setInitiatorOptionsLoading] = React.useState(false);

    const [existingAttachments, setExistingAttachments] = React.useState<
        Array<{ key: string; name: string; url?: string; size?: number }>
    >([]);
    const [attachments, setAttachments] = React.useState<File[]>([]);
    const [estimateFile, setEstimateFile] = React.useState<File | null>(null);
    const [dragActive, setDragActive] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState<number>(0);

    const [bsOptions, setBsOptions] = React.useState<BsOption[]>([]);
    const [bsOptionsLoading, setBsOptionsLoading] = React.useState(false);
    const [bsOptionsError, setBsOptionsError] = React.useState<string | null>(null);

    const [relatedTasksOptions, setRelatedTasksOptions] = React.useState<RelatedTaskOption[]>([]);
    const [relatedTasksSelected, setRelatedTasksSelected] = React.useState<RelatedTaskOption[]>([]);
    const [relatedTasksLoading, setRelatedTasksLoading] = React.useState(false);
    const [relatedTasksError, setRelatedTasksError] = React.useState<string | null>(null);
    const [relatedInput, setRelatedInput] = React.useState('');

    // диалог удаления существующего файла
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [attachmentToDelete, setAttachmentToDelete] = React.useState<{
        key: string;
        name: string;
        url?: string;
    } | null>(null);
    const [deletingExisting, setDeletingExisting] = React.useState(false);

    const [snackbarOpen, setSnackbarOpen] = React.useState(false);
    const [snackbarMsg, setSnackbarMsg] = React.useState('');
    const [snackbarSeverity, setSnackbarSeverity] = React.useState<'success' | 'error'>('success');

    const loadProjectMeta = React.useCallback(async () => {
        if (!projectRef) return;
        try {
            const res = await fetch(apiPath(`/projects/${encodeURIComponent(projectRef)}`), {
                method: 'GET',
                cache: 'no-store',
            });
            const body = await res.json();
            if (!res.ok || !body?.ok) {
                setProjectMeta(null);
                console.error('Failed to load project info:', extractErrorMessage(body, res.statusText));
                return;
            }
            const normalizedProjectType =
                body.project?.projectType === 'construction'
                    ? 'installation'
                    : body.project?.projectType === 'documents'
                        ? 'document'
                        : body.project?.projectType;
            setProjectMeta({
                regionCode: body.project?.regionCode,
                operator: body.project?.operator,
                projectType: normalizedProjectType,
            });
        } catch (e: unknown) {
            setProjectMeta(null);
            console.error(e);
        }
    }, [apiPath, projectRef]);

    React.useEffect(() => {
        if (!projectRef) return;
        void loadProjectMeta();
    }, [projectRef, loadProjectMeta]);

    React.useEffect(() => {
        if (!isT2Operator && estimateDialogOpen) {
            setEstimateDialogOpen(false);
        }
    }, [isT2Operator, estimateDialogOpen]);

    React.useEffect(() => {
        if (!isBeelineOperator && beIdDialogOpen) {
            setBeIdDialogOpen(false);
        }
    }, [isBeelineOperator, beIdDialogOpen]);

    const fetchBsOptions = React.useCallback(
        async (term: string): Promise<BsOption[]> => {
            const normalized = term.trim();
            if (!normalized) return [];
            try {
                const qs = new URLSearchParams();
                qs.set('q', normalized);
                if (projectMeta?.regionCode) qs.set('region', projectMeta.regionCode);
                if (projectMeta?.operator) qs.set('operator', projectMeta.operator);
                const query = qs.toString();
                const url = `/api/objects${query ? `?${query}` : ''}`;
                const res = await fetch(url, { method: 'GET', cache: 'no-store' });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) return [];
                return (body?.objects ?? []) as BsOption[];
            } catch {
                return [];
            }
        },
        [projectMeta?.regionCode, projectMeta?.operator]
    );

    const loadBsOptions = React.useCallback(
        async (term: string) => {
            setBsOptionsLoading(true);
            setBsOptionsError(null);
            try {
                const arr = await fetchBsOptions(term);
                setBsOptions(arr);
            } catch (e: unknown) {
                setBsOptionsError(e instanceof Error ? e.message : 'Failed to load objects');
                setBsOptions([]);
            } finally {
                setBsOptionsLoading(false);
            }
        },
        [fetchBsOptions]
    );

    const autoFillBsEntry = React.useCallback(
        async (index: number, rawNumber: string) => {
            const normalizedNumber = rawNumber.trim();
            if (!normalizedNumber) return;
            const options = await fetchBsOptions(normalizedNumber);
            if (!options.length) return;

            const target = getDisplayBsName(normalizedNumber).toLowerCase();
            const exact = options.find(
                (opt) => getDisplayBsName(opt.name).toLowerCase() === target
            );
            const chosen = exact || (options.length === 1 ? options[0] : null);
            if (!chosen) return;

            setBsEntries((prev) => {
                const entry = prev[index];
                if (!entry || entry.selectedBsOption) return prev;
                const currentTarget = getDisplayBsName(entry.bsNumber || '').toLowerCase();
                if (!currentTarget || currentTarget !== target) return prev;

                const displayName = getDisplayBsName(chosen.name);
                const lat = typeof chosen.lat === 'number' ? String(chosen.lat).replace(',', '.') : '';
                const lon = typeof chosen.lon === 'number' ? String(chosen.lon).replace(',', '.') : '';
                const normalizedAddress = normalizeAddressFromDb(displayName, chosen.address);

                return prev.map((item, idx) => {
                    if (idx !== index) return item;
                    return {
                        ...item,
                        bsNumber: displayName,
                        bsInput: displayName,
                        selectedBsOption: chosen,
                        bsAddress: item.bsAddress.trim() ? item.bsAddress : normalizedAddress,
                        bsLatitude: item.bsLatitude.trim() ? item.bsLatitude : lat,
                        bsLongitude: item.bsLongitude.trim() ? item.bsLongitude : lon,
                    };
                });
            });
        },
        [fetchBsOptions]
    );

    const autoFillParsedBsNumbers = React.useCallback(
        async (numbers: string[]) => {
            for (const [index, number] of numbers.entries()) {
                await autoFillBsEntry(index, number);
            }
        },
        [autoFillBsEntry]
    );

    const loadRelatedTasks = React.useCallback(
        async (term: string) => {
            if (!orgSlug || !projectRef) return;
            setRelatedTasksLoading(true);
            setRelatedTasksError(null);
            try {
                const qs = new URLSearchParams();
                if (term.trim()) qs.set('q', term.trim());
                qs.set('limit', '20');
                const query = qs.toString();
                const res = await fetch(
                    apiPath(
                        `/projects/${encodeURIComponent(projectRef)}/tasks${query ? `?${query}` : ''}`
                    ),
                    { method: 'GET', cache: 'no-store' }
                );
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                    setRelatedTasksError(extractErrorMessage(body, res.statusText));
                    setRelatedTasksOptions([]);
                    return;
                }
                const list = Array.isArray((body as { items?: unknown[] }).items)
                    ? ((body as { items?: unknown[] }).items as unknown[])
                    : [];
                const mapped = dedupeRelatedOptions(
                    list
                        .map((item) => mapTaskToRelatedOption(item))
                        .filter(Boolean) as RelatedTaskOption[],
                    excludeCurrentTaskId
                );
                setRelatedTasksOptions(mapped);
            } catch (e: unknown) {
                setRelatedTasksError(e instanceof Error ? e.message : 'Не удалось загрузить задачи');
                setRelatedTasksOptions([]);
            } finally {
                setRelatedTasksLoading(false);
            }
        },
        [apiPath, excludeCurrentTaskId, orgSlug, projectRef]
    );

    // helper to update one BS entry
    const updateBsEntry = (index: number, patch: Partial<BsFormEntry>) => {
        setBsEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
    };

    const addBsEntry = () => {
        setBsEntries((prev) => [
            ...prev,
            {
                id: `bs-${prev.length}-${genId(3)}`,
                bsNumber: '',
                bsInput: '',
                bsAddress: '',
                bsLatitude: '',
                bsLongitude: '',
                selectedBsOption: null,
            },
        ]);
    };

    const removeBsEntry = (index: number) => {
        // первую БС не даём удалять
        setBsEntries((prev) => {
            if (prev.length <= 1) return prev;
            if (index === 0) return prev;
            const next = prev.filter((_, i) => i !== index);
            return next.length ? next : prev;
        });
    };

    React.useEffect(() => {
        if (!open) return;
        if (!isEdit || !initialTask) return;

        setTaskName(initialTask.taskName ?? '');
        const pr = (initialTask.priority || 'medium').toString().toLowerCase() as Priority;
        setPriority(['urgent', 'high', 'medium', 'low'].includes(pr) ? pr : 'medium');
        setDueDate(initialTask.dueDate ? new Date(initialTask.dueDate) : null);
        setTaskDescription(initialTask.taskDescription ?? '');
        setInitiatorName(initialTask.initiatorName ?? '');
        setInitiatorEmail(initialTask.initiatorEmail ?? '');
        setShowInitiatorFields(Boolean(initialTask.initiatorName || initialTask.initiatorEmail));

        // стоимость
        setTotalCost(
            typeof initialTask.totalCost === 'number' && !Number.isNaN(initialTask.totalCost)
                ? String(initialTask.totalCost)
                : ''
        );
        setWorkItems(sanitizeWorkItemsInput(initialTask.workItems));
        setContractorPayment(
            typeof initialTask.contractorPayment === 'number' && !Number.isNaN(initialTask.contractorPayment)
                ? String(initialTask.contractorPayment)
                : ''
        );

        const entries: BsFormEntry[] = [];

        if (Array.isArray(initialTask.bsLocation) && initialTask.bsLocation.length > 0) {
            const hasMultiple = initialTask.bsLocation.length > 1;
            const bsAddresses = splitAddresses(initialTask.bsAddress);
            initialTask.bsLocation.forEach((loc, idx) => {
                const { lat, lon } = parseLatLonFromCoordinates(loc.coordinates);
                const addrFromLoc = (loc.address ?? '').trim();
                const addr =
                    addrFromLoc ||
                    bsAddresses[idx] ||
                    (!hasMultiple ? bsAddresses[0] : '');
                const name = loc.name || '';
                entries.push({
                    id: `edit-bs-${idx}`,
                    bsNumber: name,
                    bsInput: name,
                    bsAddress: addr,
                    bsLatitude: lat,
                    bsLongitude: lon,
                    selectedBsOption: null,
                });
            });
        } else {
            let latStr =
                typeof initialTask.bsLatitude === 'number'
                    ? String(initialTask.bsLatitude).replace(',', '.')
                    : '';
            let lonStr =
                typeof initialTask.bsLongitude === 'number'
                    ? String(initialTask.bsLongitude).replace(',', '.')
                    : '';

            if (
                (!latStr || !lonStr) &&
                Array.isArray(initialTask.bsLocation) &&
                initialTask.bsLocation.length > 0
            ) {
                const coord = initialTask.bsLocation[0]?.coordinates || '';
                const parts = coord.split(/\s+/).filter(Boolean);
                if (parts.length >= 2) {
                    latStr = latStr || parts[0];
                    lonStr = lonStr || parts[1];
                }
            }

            const initialBs = initialTask.bsNumber ? getDisplayBsName(initialTask.bsNumber) : '';

            entries.push({
                id: 'edit-bs-main',
                bsNumber: initialBs,
                bsInput: initialBs,
                bsAddress: initialTask.bsAddress ?? '',
                bsLatitude: latStr,
                bsLongitude: lonStr,
                selectedBsOption: null,
            });
        }

        setBsEntries(entries.length ? entries : [
            {
                id: 'bs-main',
                bsNumber: '',
                bsInput: '',
                bsAddress: '',
                bsLatitude: '',
                bsLongitude: '',
                selectedBsOption: null,
            },
        ]);

        if (entries[0]?.bsNumber) {
            void loadBsOptions(entries[0].bsNumber);
        }

        if (initialTask.executorEmail || initialTask.executorName || initialTask.executorId) {
            setSelectedExecutor({
                id: initialTask.executorId || 'unknown',
                name: initialTask.executorName || initialTask.executorEmail || 'Executor',
                email: initialTask.executorEmail || '',
            });
        } else {
            setSelectedExecutor(null);
        }

        const filesFromTask = initialTask.files ?? [];
        const attachmentsFromTask = Array.isArray(initialTask.attachments)
            ? initialTask.attachments.filter((url) => !isDocumentUrl(url))
            : [];

        const merged = [
            ...filesFromTask
                .filter(Boolean)
                .map((f, i) => ({
                    key: `${f?.name ?? 'file'}:${f?.size ?? i}`,
                    name: f?.name ?? `file-${i + 1}`,
                    url: f?.url,
                    size: f?.size,
                })),
            ...attachmentsFromTask.map((url, i) => ({
                key: `att-${i}`,
                name: getFileNameFromUrl(url),
                url,
            })),
        ];

        setExistingAttachments(merged);

        setAttachments([]);
        setEstimateFile(null);
        setUploadProgress(0);
        setUploading(false);
    }, [open, isEdit, initialTask, loadBsOptions]);

    React.useEffect(() => {
        if (!open || !orgSlug) return;
        let aborted = false;

        async function loadMembers(): Promise<void> {
            setMembersLoading(true);
            setMembersError(null);
            try {
                const res = await fetch(apiPath(`/members?status=active`), {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    cache: 'no-store',
                });

                let body: unknown = null;
                try {
                    body = await res.json();
                } catch {
                    /* ignore */
                }

                if (!res.ok) {
                    if (!aborted) setMembersError(extractErrorMessage(body, res.statusText));
                    return;
                }

                const list = (body as MembersApi)?.members ?? [];

                const opts: MemberOption[] = list.map((m) => ({
                    id: m.clerkId ? m.clerkId : String(m._id),
                    clerkId: m.clerkId ?? undefined,
                    name: m.userName || m.userEmail,
                    email: m.userEmail,
                    profilePic: m.profilePic,
                    profileType: m.profileType,
                    specializations: normalizeSpecializations(m.specializations),
                }));

                if (!aborted) setMembers(opts);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Failed to load members';
                if (!aborted) setMembersError(msg);
            } finally {
                if (!aborted) setMembersLoading(false);
            }
        }

        void loadMembers();
        return () => {
            aborted = true;
        };
    }, [open, orgSlug, apiPath]);

    React.useEffect(() => {
        if (!open || !orgSlug || !projectRef) return;
        let aborted = false;

        async function loadInitiators(): Promise<void> {
            setInitiatorOptionsLoading(true);
            try {
                const res = await fetch(
                    apiPath(`/projects/${encodeURIComponent(projectRef)}/tasks?limit=100&sort=-createdAt`),
                    { method: 'GET', cache: 'no-store' }
                );
                const body = await res.json().catch(() => ({}));
                if (!res.ok || !body?.items) {
                    if (!aborted) setInitiatorOptions([]);
                    return;
                }

                const items = Array.isArray(body.items) ? body.items : [];
                const map = new globalThis.Map<string, InitiatorOption>();

                items.forEach((item: { initiatorName?: string; initiatorEmail?: string }) => {
                    const name = (item?.initiatorName ?? '').trim();
                    const email = (item?.initiatorEmail ?? '').trim();
                    if (!name && !email) return;
                    const key = (email || name).toLowerCase();
                    if (!map.has(key)) {
                        map.set(key, { name: name || email, email });
                    }
                });

                if (!aborted) {
                    setInitiatorOptions(Array.from(map.values()));
                }
            } catch {
                if (!aborted) setInitiatorOptions([]);
            } finally {
                if (!aborted) setInitiatorOptionsLoading(false);
            }
        }

        void loadInitiators();
        return () => {
            aborted = true;
        };
    }, [open, orgSlug, projectRef, apiPath]);

    React.useEffect(() => {
        const currentName = initiatorName.trim();
        const currentEmail = initiatorEmail.trim();
        if (!currentName && !currentEmail) return;
        setInitiatorOptions((prev) => {
            const key = (currentEmail || currentName).toLowerCase();
            if (prev.some((opt) => (opt.email || opt.name).toLowerCase() === key)) return prev;
            return [...prev, { name: currentName || currentEmail, email: currentEmail }];
        });
    }, [initiatorName, initiatorEmail]);

    const selectedInitiator = React.useMemo(() => {
        const email = initiatorEmail.trim().toLowerCase();
        const name = initiatorName.trim().toLowerCase();
        if (!email && !name) return null;
        return (
            initiatorOptions.find((opt) => opt.email.toLowerCase() === email && email) ||
            initiatorOptions.find((opt) => opt.name.toLowerCase() === name && name) ||
            null
        );
    }, [initiatorOptions, initiatorEmail, initiatorName]);

    React.useEffect(() => {
        if (!open) return;
        setRelatedInput('');
        void loadRelatedTasks('');
    }, [open, loadRelatedTasks]);

    React.useEffect(() => {
        if (!open) return;
        if (!isEdit || !initialTask || !projectRef) {
            setRelatedTasksSelected([]);
            setRelatedTasksLoading(false);
            setRelatedTasksError(null);
            return;
        }

        const ids = normalizeRelatedTasks(initialTask.relatedTasks)
            .map((entry) => entry._id)
            .filter(Boolean);
        if (!ids.length) {
            setRelatedTasksSelected([]);
            setRelatedTasksLoading(false);
            setRelatedTasksError(null);
            return;
        }

        let aborted = false;
        setRelatedTasksLoading(true);
        setRelatedTasksError(null);

        const load = async () => {
            const collected: RelatedTaskOption[] = [];
            for (const id of ids) {
                try {
                    const res = await fetch(
                        apiPath(
                            `/projects/${encodeURIComponent(projectRef)}/tasks/${encodeURIComponent(id)}`
                        ),
                        { method: 'GET', cache: 'no-store' }
                    );
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        console.error('Failed to load related task', id, body);
                        continue;
                    }
                    const taskData = (body as { task?: unknown })?.task ?? body;
                    const opt = mapTaskToRelatedOption(taskData);
                    if (opt) collected.push(opt);
                } catch (e) {
                    console.error('Failed to fetch related task', e);
                }
            }

            if (!aborted) {
                const deduped = dedupeRelatedOptions(collected, excludeCurrentTaskId);
                setRelatedTasksSelected(deduped);
                setRelatedTasksOptions((prev) =>
                    dedupeRelatedOptions([...deduped, ...prev], excludeCurrentTaskId)
                );
            }
        };

        void load().finally(() => {
            if (!aborted) setRelatedTasksLoading(false);
        });

        return () => {
            aborted = true;
        };
    }, [open, isEdit, initialTask, projectRef, apiPath, excludeCurrentTaskId]);

    const hasInvalidCoords = React.useMemo(
        () =>
            bsEntries.some(
                (e) => !isLatValueValid(e.bsLatitude) || !isLngValueValid(e.bsLongitude)
            ),
        [bsEntries]
    );

    const bsSearchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const relatedSearchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    React.useEffect(() => {
        return () => {
            if (bsSearchTimeout.current) clearTimeout(bsSearchTimeout.current);
            if (relatedSearchTimeout.current) clearTimeout(relatedSearchTimeout.current);
        };
    }, []);

    const handleOpenEstimateDialog = React.useCallback(() => {
        if (isT2Operator) {
            setEstimateDialogOpen(true);
            return;
        }
        if (isBeelineOperator) {
            setBeIdDialogOpen(true);
        }
    }, [isT2Operator, isBeelineOperator]);

    const handleEstimateApply = React.useCallback(
        (data: ParsedEstimateResult) => {
            const { bsNumber, bsAddress, totalCost, sourceFile, workItems } = data;

            // 0) парсим номера БС из строки сметы
            const parsedNumbers = extractBsNumbersFromString(bsNumber, {
                prefixes: [...DEFAULT_BS_PREFIXES],
                dedupe: true,
            });

            const numbersToUse =
                parsedNumbers.length > 0
                    ? parsedNumbers
                    : bsNumber
                        ? [bsNumber.trim()]
                        : [];

            // 1) обновляем БС в форме
            if (numbersToUse.length > 1) {
                // несколько БС → создаём несколько записей
                setBsEntries(
                    numbersToUse.map((num, idx) => ({
                        id: `bs-estimate-${idx}`,
                        bsNumber: num,
                        bsInput: num,
                        bsAddress: idx === 0 ? bsAddress || '' : '',
                        bsLatitude: '',
                        bsLongitude: '',
                        selectedBsOption: null,
                    }))
                );

                // подгружаем объекты по первой БС
                void loadBsOptions(numbersToUse[0]);
                void autoFillParsedBsNumbers(numbersToUse);
            } else {
                // одна БС → старая логика, но с нормализованным номером
                const single = numbersToUse[0] ?? '';

                setBsEntries((prev) => {
                    if (!prev.length) {
                        return [
                            {
                                id: 'bs-main',
                                bsNumber: single,
                                bsInput: single,
                                bsAddress: bsAddress || '',
                                bsLatitude: '',
                                bsLongitude: '',
                                selectedBsOption: null,
                            },
                        ];
                    }

                    const next = [...prev];
                    const first = next[0];

                    next[0] = {
                        ...first,
                        bsNumber: single || first.bsNumber,
                        bsInput: single || first.bsInput,
                        bsAddress: bsAddress || first.bsAddress,
                    };

                    return next;
                });

                if (single) {
                    void loadBsOptions(single);
                    void autoFillParsedBsNumbers([single]);
                }
            }

            // 2) стоимость
            if (typeof totalCost === 'number') {
                setTotalCost(String(totalCost));
            }

            // 2.1) состав работ
            setWorkItems(sanitizeWorkItemsInput(workItems));

            // 3) подставить имя задачи, если пустое
            if (!taskName && numbersToUse.length) {
                setTaskName(`Работы по заказу T2`);
            }

            // 4) сохранить файл сметы отдельно, чтобы загрузить его как документ при сохранении задачи
            if (sourceFile) {
                setEstimateFile((prev) => {
                    const sameFile = prev && prev.name === sourceFile.name && prev.size === sourceFile.size;
                    return sameFile ? prev : sourceFile;
                });
            } else {
                setEstimateFile(null);
            }
        },
        [taskName, loadBsOptions, autoFillParsedBsNumbers]
    );

    const handleBeIdApply = React.useCallback(
        (data: ParsedBeIdResult) => {
            const { bsNumber, bsAddress, bsLatitude, bsLongitude, taskDescription, sourceFile } = data;

            const latValue =
                typeof bsLatitude === 'number' ? formatDecimalCoord(bsLatitude) : '';
            const lonValue =
                typeof bsLongitude === 'number' ? formatDecimalCoord(bsLongitude) : '';

            if (bsNumber || bsAddress || latValue || lonValue) {
                setBsEntries((prev) => {
                    if (!prev.length) {
                        return [
                            {
                                id: 'bs-main',
                                bsNumber: bsNumber || '',
                                bsInput: bsNumber || '',
                                bsAddress: bsAddress || '',
                                bsLatitude: latValue,
                                bsLongitude: lonValue,
                                selectedBsOption: null,
                            },
                        ];
                    }

                    const next = [...prev];
                    const first = next[0];

                    next[0] = {
                        ...first,
                        bsNumber: bsNumber || first.bsNumber,
                        bsInput: bsNumber || first.bsInput,
                        bsAddress: bsAddress || first.bsAddress,
                        bsLatitude: latValue || first.bsLatitude,
                        bsLongitude: lonValue || first.bsLongitude,
                    };

                    return next;
                });

                if (bsNumber) {
                    void loadBsOptions(bsNumber);
                    void autoFillParsedBsNumbers([bsNumber]);
                }
            }

            if (taskDescription) {
                setTaskDescription(taskDescription);
            }

            if (sourceFile) {
                setAttachments((prev) => {
                    const key = `${sourceFile.name}:${sourceFile.size}`;
                    const existing = new Set(prev.map((f) => `${f.name}:${f.size}`));
                    return existing.has(key) ? prev : [...prev, sourceFile];
                });
            }
        },
        [loadBsOptions, autoFillParsedBsNumbers]
    );



    const handleSelectBsOption = (index: number, opt: BsOption | null) => {
        if (!opt) {
            updateBsEntry(index, {
                selectedBsOption: null,
            });
            return;
        }
        const displayName = getDisplayBsName(opt.name);
        const lat =
            typeof opt.lat === 'number' ? String(opt.lat).replace(',', '.') : '';
        const lon =
            typeof opt.lon === 'number' ? String(opt.lon).replace(',', '.') : '';
        const normalized = normalizeAddressFromDb(displayName, opt.address);
        updateBsEntry(index, {
            bsNumber: displayName,
            bsInput: displayName,
            selectedBsOption: opt,
            bsAddress: normalized,
            bsLatitude: lat,
            bsLongitude: lon,
        });
    };

    const handleBsInputChange = (_e: React.SyntheticEvent, value: string, index: number) => {
        updateBsEntry(index, {
            bsInput: value,
            bsNumber: value,
            selectedBsOption: null,
        });
        if (bsSearchTimeout.current) clearTimeout(bsSearchTimeout.current);
        if (!value.trim()) {
            setBsOptions([]);
            return;
        }
        bsSearchTimeout.current = setTimeout(() => {
            void loadBsOptions(value);
        }, 300);
    };

    const getMapCoords = (entry: BsFormEntry): [number, number] | null => {
        const latRaw = entry.bsLatitude.trim();
        const lonRaw = entry.bsLongitude.trim();
        if (!latRaw || !lonRaw) return null;
        if (!isLatValueValid(entry.bsLatitude) || !isLngValueValid(entry.bsLongitude)) return null;
        const lat = Number(latRaw.replace(',', '.'));
        const lon = Number(lonRaw.replace(',', '.'));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return [lat, lon];
    };

    const reset = () => {
        setTaskName('');
        setTaskDescription('');
        setPriority('medium');
        setDueDate(new Date());
        setSelectedExecutor(null);
        setInitiatorName('');
        setInitiatorEmail('');
        setShowInitiatorFields(false);
        setExistingAttachments([]);
        setAttachments([]);
        setEstimateFile(null);
        setUploadProgress(0);
        setUploading(false);
        setTotalCost('');
        setWorkItems([]);
        setRelatedTasksSelected([]);
        setRelatedTasksOptions([]);
        setRelatedTasksError(null);
        setRelatedInput('');
        setContractorPayment('');
        setBsEntries([
            {
                id: 'bs-main',
                bsNumber: '',
                bsInput: '',
                bsAddress: '',
                bsLatitude: '',
                bsLongitude: '',
                selectedBsOption: null,
            },
        ]);
        setWorkItemsDialogOpen(false);
    };

    const handleSnackbarClose = () => setSnackbarOpen(false);

    const handleClose = () => {
        if (saving || uploading) return;
        setWorkItemsDialogOpen(false);
        if (!isEdit) reset();
        onCloseAction();
    };

    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };
    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };
    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (!files.length) return;
        addFiles(files);
    };

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const openFileDialog = () => inputRef.current?.click();

    const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        addFiles(files);
        e.currentTarget.value = '';
    };

    const addFiles = (files: File[]) => {
        const existing = new Set(attachments.map((f) => `${f.name}:${f.size}`));
        const toAdd = files.filter((f) => !existing.has(`${f.name}:${f.size}`));
        setAttachments((prev) => [...prev, ...toAdd]);
    };

    const removeFile = (name: string, size: number) => {
        setAttachments((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
    };

    async function uploadEstimateDocument(taskShortId: string): Promise<void> {
        if (isBeelineOperator) return;
        if (!estimateFile) return;
        try {
        const fd = new FormData();
        fd.append('file', estimateFile, estimateFile.name);
        fd.append('taskId', taskShortId);
        fd.append('subfolder', 'documents');
        fd.append('orgSlug', orgSlug || '');
        fd.append('projectKey', projectRef || '');

        const res = await fetch(withBasePath('/api/upload'), { method: 'POST', body: fd });
        if (!res.ok) {
            let body: unknown = null;
            try {
                    body = await res.json();
                } catch {
                    /* ignore */
                }
                console.error('Estimate upload failed:', extractErrorMessage(body, res.statusText));
            } else {
                setEstimateFile(null);
            }
        } catch (err) {
            console.error('Estimate upload error:', err);
        }
    }

    async function uploadAttachments(taskShortId: string): Promise<void> {
        if (!attachments.length) return;
        setUploading(true);
        setUploadProgress(0);

        for (let i = 0; i < attachments.length; i++) {
            const file = attachments[i];
        const fd = new FormData();
        fd.append('file', file, file.name);
        fd.append('taskId', taskShortId);
        fd.append('subfolder', 'attachments');
        fd.append('orgSlug', orgSlug || '');

            const res = await fetch(withBasePath('/api/upload'), { method: 'POST', body: fd });

            if (!res.ok) {
                let body: unknown = null;
                try {
                    body = await res.json();
                } catch {
                    /* ignore */
                }
                const errText = extractErrorMessage(body, res.statusText);
                console.error('File upload failed:', errText);
            }
            setUploadProgress(Math.round(((i + 1) / attachments.length) * 100));
        }

        setUploading(false);
    }

    function buildBsLocation(): Array<{ name: string; coordinates: string; address?: string }> {
        const result: Array<{ name: string; coordinates: string; address?: string }> = [];
        for (const entry of bsEntries) {
            const name = entry.bsNumber.trim();
            const lat = entry.bsLatitude.trim();
            const lon = entry.bsLongitude.trim();
            if (!name || !lat || !lon) continue;
            result.push({
                name,
                coordinates: `${lat.replace(',', '.')} ${lon.replace(',', '.')}`,
                address: entry.bsAddress.trim() || undefined,
            });
        }
        return result;
    }

    function getPrimaryCoords(): { lat?: number; lon?: number } {
        if (!bsEntries.length) return {};
        const e = bsEntries[0];
        const lat = parseNumberOrUndefined(e.bsLatitude);
        const lon = parseNumberOrUndefined(e.bsLongitude);
        return { lat, lon };
    }

    const taskBsNumber = React.useMemo(
        () => getTaskBsNumber(bsEntries),
        [bsEntries]
    );

    const taskBsAddress = React.useMemo(
        () => getPrimaryAddress(bsEntries),
        [bsEntries]
    );

    const relatedOptions = React.useMemo(
        () => dedupeRelatedOptions([...relatedTasksSelected, ...relatedTasksOptions], excludeCurrentTaskId),
        [relatedTasksOptions, relatedTasksSelected, excludeCurrentTaskId]
    );

    const totalCostNumber = React.useMemo(
        () => parseNumberOrUndefined(totalCost) ?? 0,
        [totalCost]
    );

    const contractorPaymentNumber = React.useMemo(
        () => parseNumberOrUndefined(contractorPayment) ?? 0,
        [contractorPayment]
    );

    const contractorPercent = React.useMemo(() => {
        if (totalCostNumber <= 0 || contractorPaymentNumber < 0) return 0;
        const percent = (contractorPaymentNumber / totalCostNumber) * 100;
        return Number.isFinite(percent) ? percent : 0;
    }, [contractorPaymentNumber, totalCostNumber]);

    const handlePercentUpdate = React.useCallback(
        (nextPercent: number) => {
            if (totalCostNumber <= 0) return;
            const safePercent = Math.max(0, nextPercent);
            const nextPayment = (totalCostNumber * safePercent) / 100;
            setContractorPayment(nextPayment ? nextPayment.toFixed(2) : '0');
        },
        [totalCostNumber]
    );

    const handlePercentInputChange = React.useCallback(
        (raw: string) => {
            const trimmed = raw.trim();
            if (!trimmed) {
                setContractorPayment('');
                return;
            }
            const parsed = Number(trimmed.replace(',', '.'));
            if (!Number.isFinite(parsed)) return;
            handlePercentUpdate(parsed);
        },
        [handlePercentUpdate]
    );

    const openWorkItemsDialog = React.useCallback(() => setWorkItemsDialogOpen(true), []);
    const closeWorkItemsDialog = React.useCallback(() => setWorkItemsDialogOpen(false), []);
    const handleWorkItemsSave = React.useCallback((items: ParsedWorkItem[]) => {
        setWorkItems(items);
        setWorkItemsDialogOpen(false);
    }, []);

    React.useEffect(() => {
        if (!isDocumentProject) return;
        if (workItems.length > 0) {
            setWorkItems([]);
        }
        if (workItemsDialogOpen) {
            setWorkItemsDialogOpen(false);
        }
    }, [isDocumentProject, workItems.length, workItemsDialogOpen]);

    const hasAtLeastOneBsNumber = !!taskBsNumber;

    async function handleCreate() {
        if (!taskName || !hasAtLeastOneBsNumber) return;
        if (!orgSlug || !projectRef) return;
        if (hasInvalidCoords) return;
        if (!taskBsAddress) return;
        if (selectedExecutorMismatch) {
            setSnackbarMsg(
                t(
                    'tasks.executor.specializationMismatch',
                    'Выбранный исполнитель не подходит по специализации'
                )
            );
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }
        setSaving(true);
        const newTaskId = genId();
        const bsLocation = buildBsLocation();
        const primaryCoords = getPrimaryCoords();
        const initiatorNameValue = initiatorName.trim();
        const initiatorEmailValue = initiatorEmail.trim();

        try {
            const payload = {
                taskId: newTaskId,
                taskName,
                bsNumber: taskBsNumber,
                bsAddress: taskBsAddress,
                taskDescription: taskDescription?.trim() || undefined,
                taskType: projectMeta?.projectType,
                documentInputNotes: undefined,
                documentInputLinks: undefined,
                documentInputPhotos: undefined,
                documentStages: undefined,
                documentReviewFiles: undefined,
                documentFinalFiles: undefined,
                documentFinalFormats: undefined,
                status: 'To do',
                priority,
                dueDate: dueDate ? dueDate.toISOString() : undefined,
                bsLatitude: typeof primaryCoords.lat === 'number' ? primaryCoords.lat : undefined,
                bsLongitude: typeof primaryCoords.lon === 'number' ? primaryCoords.lon : undefined,
                bsLocation,
                executorId: selectedExecutor ? selectedExecutor.id : null,
                executorName: selectedExecutor ? selectedExecutor.name : null,
                executorEmail: selectedExecutor ? selectedExecutor.email : null,
                initiatorName: initiatorNameValue || undefined,
                initiatorEmail: initiatorEmailValue || undefined,
                totalCost: totalCost.trim() ? Number(totalCost.trim()) : undefined,
                contractorPayment: contractorPayment.trim() ? Number(contractorPayment.trim()) : undefined,
                workItems: isDocumentProject ? [] : workItems,
                relatedTasks: relatedTasksSelected.map((t) => t.id),
            };

            const res = await fetch(apiPath(`/projects/${encodeURIComponent(projectRef)}/tasks`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                let body: unknown = null;
                try {
                    body = await res.json();
                } catch {
                    /* ignore */
                }
                console.error('Failed to create task:', extractErrorMessage(body, res.statusText));
                return;
            }

            await uploadEstimateDocument(newTaskId);
            await uploadAttachments(newTaskId);
            reset();
            onCreatedAction();
        } catch (e: unknown) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdate() {
        if (!initialTask) return;
        if (!taskName || !hasAtLeastOneBsNumber) return;
        if (!orgSlug || !projectRef) return;
        if (hasInvalidCoords) return;
        if (!taskBsAddress) return;
        if (selectedExecutorMismatch) {
            setSnackbarMsg(
                t(
                    'tasks.executor.specializationMismatch',
                    'Выбранный исполнитель не подходит по специализации'
                )
            );
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }
        setSaving(true);
        const bsLocation = buildBsLocation();
        const primaryCoords = getPrimaryCoords();
        const initiatorNameValue = initiatorName.trim();
        const initiatorEmailValue = initiatorEmail.trim();

        try {
            const payload = {
                taskName,
                bsNumber: taskBsNumber,
                bsAddress: taskBsAddress,
                taskDescription: taskDescription?.trim() || undefined,
                taskType: projectMeta?.projectType,
                documentInputNotes: undefined,
                documentInputLinks: undefined,
                documentInputPhotos: undefined,
                documentStages: undefined,
                documentReviewFiles: undefined,
                documentFinalFiles: undefined,
                documentFinalFormats: undefined,
                priority,
                dueDate: dueDate ? dueDate.toISOString() : undefined,
                bsLatitude: typeof primaryCoords.lat === 'number' ? primaryCoords.lat : undefined,
                bsLongitude: typeof primaryCoords.lon === 'number' ? primaryCoords.lon : undefined,
                bsLocation,
                executorId: selectedExecutor ? selectedExecutor.id : null,
                executorName: selectedExecutor ? selectedExecutor.name : null,
                executorEmail: selectedExecutor ? selectedExecutor.email : null,
                initiatorName: initiatorNameValue || undefined,
                initiatorEmail: initiatorEmailValue || undefined,
                totalCost: totalCost.trim() ? Number(totalCost.trim()) : undefined,
                contractorPayment: contractorPayment.trim() ? Number(contractorPayment.trim()) : undefined,
                workItems: isDocumentProject ? [] : workItems,
                relatedTasks: relatedTasksSelected.map((t) => t.id),
            };

            const res = await fetch(
                apiPath(
                    `/projects/${encodeURIComponent(projectRef)}/tasks/${encodeURIComponent(
                        initialTask._id
                    )}`
                ),
                { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
            );

            if (!res.ok) {
                let body: unknown = null;
                try {
                    body = await res.json();
                } catch {
                    /* ignore */
                }
                console.error('Failed to update task:', extractErrorMessage(body, res.statusText));
                return;
            }

            await uploadEstimateDocument(initialTask.taskId);
            if (attachments.length) {
                await uploadAttachments(initialTask.taskId);
            }

            onCreatedAction();
        } catch (e: unknown) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    }

    // запрашиваем удаление существующего файла
    const requestDeleteExisting = (file: { key: string; name: string; url?: string }) => {
        setAttachmentToDelete(file);
        setDeleteDialogOpen(true);
    };

    const confirmDeleteExisting = async () => {
        if (!attachmentToDelete) return;

        if (isEdit && initialTask?.taskId && attachmentToDelete.url) {
            setDeletingExisting(true);
            try {
                const q = new URLSearchParams({
                    taskId: initialTask.taskId,
                    url: attachmentToDelete.url,
                });
                const res = await fetch(`/api/upload?${q.toString()}`, {
                    method: 'DELETE',
                });
                const body = await res.json().catch(() => ({}));

                if (!res.ok) {
                    const msg = extractErrorMessage(body, res.statusText);
                    setSnackbarMsg(`Ошибка удаления: ${msg}`);
                    setSnackbarSeverity('error');
                    setSnackbarOpen(true);
                } else {
                    setExistingAttachments((prev) => prev.filter((x) => x.key !== attachmentToDelete.key));
                    setSnackbarMsg('Вложение удалено');
                    setSnackbarSeverity('success');
                    setSnackbarOpen(true);
                }
            } catch (e) {
                console.error(e);
                setSnackbarMsg('Ошибка удаления');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            } finally {
                setDeletingExisting(false);
            }
        } else {
            setExistingAttachments((prev) => prev.filter((x) => x.key !== attachmentToDelete.key));
            setSnackbarMsg('Вложение удалено');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
        }

        setDeleteDialogOpen(false);
        setAttachmentToDelete(null);
    };

    const cancelDeleteExisting = () => {
        setDeleteDialogOpen(false);
        setAttachmentToDelete(null);
    };

    const saveDisabled =
        saving ||
        uploading ||
        !taskName ||
        !hasAtLeastOneBsNumber ||
        !taskBsAddress ||
        hasInvalidCoords ||
        selectedExecutorMismatch;

    const savingIndicator = (saving || uploading) ? (
        <CircularProgress
            color="inherit"
            size={18}
            sx={{ ml: 1 }}
        />
    ) : null;

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Drawer
                anchor="right"
                open={open}
                onClose={handleClose}
                ModalProps={{ keepMounted: true }}
                PaperProps={{
                    sx: {
                        width: { xs: '100%', sm: 520 },
                        maxWidth: '100%',
                        background: drawerBg,
                        borderLeft: `1px solid ${drawerBorder}`,
                        boxShadow: drawerShadow,
                        backdropFilter: 'blur(24px)',
                        color: 'text.primary',
                    },
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Box
                        sx={{
                            px: 3,
                            py: 2.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: `1px solid ${headerDivider}`,
                            background: headerBg,
                        }}
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box
                                sx={{
                                    width: 50,
                                    height: 50,
                                    borderRadius: UI_RADIUS.overlay,
                                    background:
                                        'linear-gradient(135deg, rgba(59,130,246,0.95), rgba(14,165,233,0.85))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    boxShadow: '0 18px 35px rgba(59,130,246,0.35)',
                                }}
                            >
                                <TaskAltIcon />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight={700}>
                                    {isEdit ? 'Редактировать задачу' : 'Создать задачу'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Заполните данные и сохраните задачу в проекте
                                </Typography>
                            </Box>
                        </Stack>
                        <IconButton onClick={handleClose} sx={{ color: 'text.secondary' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
                        <Stack spacing={2.5}>
                            <Stack spacing={1.5}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle2">Основная информация</Typography>
                                    {(isT2Operator || isBeelineOperator) && (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={handleOpenEstimateDialog}
                                            disabled={saving || uploading}
                                        >
                                            {isBeelineOperator ? 'Заполнить по ID' : 'Заполнить по смете'}
                                        </Button>
                                    )}
                                </Stack>

                                <TextField
                                    label="Task Name"
                                    value={taskName}
                                    onChange={(e) => setTaskName(e.target.value)}
                                    required
                                    fullWidth
                                    sx={glassInputSx}
                                />
                            </Stack>


                            {/* Блок базовых станций */}
                            <Box>
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    sx={{ mb: 1 }}
                                >
                                    <Typography variant="subtitle2">Базовая станция</Typography>
                                    <Tooltip title="Добавить БС">
                                        <span>
                                            <IconButton
                                                size="small"
                                                onClick={addBsEntry}
                                                disabled={saving || uploading}
                                            >
                                                <AddIcon fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>

                                <Stack spacing={2}>
                                    {bsEntries.map((entry, index) => {
                                        const mapCoords = getMapCoords(entry);
                                        const latValid = isLatValueValid(entry.bsLatitude);
                                        const lngValid = isLngValueValid(entry.bsLongitude);

                                        return (
                                            <Box
                                                key={entry.id}
                                                sx={{
                                                    borderRadius: UI_RADIUS.tooltip,
                                                    border: `1px solid ${cardBorder}`,
                                                    p: 1.5,
                                                    backgroundColor: cardBg,
                                                }}
                                            >
                                                {bsEntries.length > 1 && (
                                                    <Stack
                                                        direction="row"
                                                        alignItems="center"
                                                        justifyContent="space-between"
                                                        sx={{ mb: 1 }}
                                                    >
                                                        <Typography variant="subtitle2">
                                                            {`БС #${index + 1}`}
                                                        </Typography>

                                                        {index > 0 && (
                                                            <Tooltip title="Удалить БС из задачи">
                <span>
                    <IconButton
                        size="small"
                        onClick={() => removeBsEntry(index)}
                        disabled={saving || uploading}
                    >
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                </span>
                                                            </Tooltip>
                                                        )}
                                                    </Stack>
                                                )}


                                                <Autocomplete<BsOption, false, false, true>
                                                    freeSolo
                                                    options={bsOptions}
                                                    loading={bsOptionsLoading}
                                                    value={entry.bsNumber}
                                                    inputValue={entry.bsInput}
                                                    onChange={(_e, val) => {
                                                        if (typeof val === 'string') {
                                                            updateBsEntry(index, {
                                                                bsNumber: val,
                                                                bsInput: val,
                                                                selectedBsOption: null,
                                                            });
                                                            return;
                                                        }
                                                        if (val) {
                                                            handleSelectBsOption(index, val);
                                                        } else {
                                                            updateBsEntry(index, {
                                                                bsNumber: '',
                                                                bsInput: '',
                                                                selectedBsOption: null,
                                                            });
                                                        }
                                                    }}
                                                    onInputChange={(e, value) =>
                                                        handleBsInputChange(e, value, index)
                                                    }
                                                    getOptionLabel={(opt) =>
                                                        typeof opt === 'string'
                                                            ? opt
                                                            : getDisplayBsName(opt.name)
                                                    }
                                                    filterOptions={(opts, params) => {
                                                        if (!params.inputValue.trim()) {
                                                            return [];
                                                        }
                                                        return defaultFilter(opts, params);
                                                    }}
                                                    isOptionEqualToValue={(option, value) =>
                                                        option.id === (value as BsOption).id
                                                    }
                                                    noOptionsText={
                                                        bsOptionsError ? `Ошибка: ${bsOptionsError}` : 'Не найдено'
                                                    }
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label="BS Number"
                                                            required={index === 0}
                                                            fullWidth
                                                            sx={glassInputSx}
                                                            InputProps={{
                                                                ...params.InputProps,
                                                                endAdornment: (
                                                                    <>
                                                                        {bsOptionsLoading ? (
                                                                            <CircularProgress
                                                                                size={18}
                                                                                sx={{ mr: 1 }}
                                                                            />
                                                                        ) : null}
                                                                        {params.InputProps.endAdornment}
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                    )}
                                                    renderOption={(props, option) => (
                                                        <li {...props} key={option.id}>
                                                            <Box>
                                                                <Typography variant="body2">
                                                                    {getDisplayBsName(option.name)}
                                                                </Typography>
                                                                {option.address ? (
                                                                    <Typography
                                                                        variant="caption"
                                                                        color="text.secondary"
                                                                    >
                                                                        {option.address}
                                                                    </Typography>
                                                                ) : null}
                                                            </Box>
                                                        </li>
                                                    )}
                                                />

                                                <TextField
                                                    label="BS Address"
                                                    value={entry.bsAddress}
                                                    onChange={(e) =>
                                                        updateBsEntry(index, { bsAddress: e.target.value })
                                                    }
                                                    fullWidth
                                                    required={index === 0}
                                                    sx={{ ...glassInputSx, mt: 1.5 }}
                                                />

                                                <Stack
                                                    direction={{ xs: 'column', sm: 'row' }}
                                                    spacing={2}
                                                    sx={{ mt: 1.5 }}
                                                >
                                                    <TextField
                                                        label="Latitude (Широта)"
                                                        type="text"
                                                        value={entry.bsLatitude}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            const dmsValue = parseDmsToDecimal(raw);
                                                            const nextValue = dmsValue !== null
                                                                ? formatDecimalCoord(dmsValue)
                                                                : raw.replace(',', '.');
                                                            updateBsEntry(index, { bsLatitude: nextValue });
                                                        }}
                                                        error={!latValid}
                                                        placeholder="52.219319"
                                                        helperText={
                                                            !latValid
                                                                ? 'Широта должна быть в диапазоне −90…90'
                                                                : 'WGS-84, десятичные градусы'
                                                        }
                                                        fullWidth
                                                        inputProps={{ inputMode: 'decimal' }}
                                                        sx={glassInputSx}
                                                    />
                                                    <TextField
                                                        label="Longitude (Долгота)"
                                                        type="text"
                                                        value={entry.bsLongitude}
                                                        onChange={(e) => {
                                                            const raw = e.target.value;
                                                            const dmsValue = parseDmsToDecimal(raw);
                                                            const nextValue = dmsValue !== null
                                                                ? formatDecimalCoord(dmsValue)
                                                                : raw.replace(',', '.');
                                                            updateBsEntry(index, { bsLongitude: nextValue });
                                                        }}
                                                        error={!lngValid}
                                                        placeholder="104.26913"
                                                        helperText={
                                                            !lngValid
                                                                ? 'Долгота должна быть в диапазоне −180…180'
                                                                : 'WGS-84, десятичные градусы'
                                                        }
                                                        fullWidth
                                                        inputProps={{ inputMode: 'decimal' }}
                                                        sx={glassInputSx}
                                                    />
                                                </Stack>

                                                {mapCoords && (
                                                    <Box sx={{ mt: 1.5 }}>
                                                        <Alert severity="warning" sx={{ mb: 1 }}>
                                                            Проверьте корректность координат этой БС перед сохранением
                                                            задачи!
                                                        </Alert>
                                                        <Box
                                                            sx={{
                                                                borderRadius: UI_RADIUS.tooltip,
                                                                overflow: 'hidden',
                                                                height: 220,
                                                                boxShadow: isDarkMode
                                                                    ? '0 30px 65px rgba(0,0,0,0.35)'
                                                                    : '0 30px 65px rgba(15,23,42,0.18)',
                                                                border: `1px solid ${mapBorder}`,
                                                            }}
                                                        >
                                                            <YMaps
                                                                query={{
                                                                    apikey: YMAPS_API_KEY,
                                                                    lang: 'ru_RU',
                                                                }}
                                                            >
                                                                <Map
                                                                    state={{
                                                                        center: mapCoords,
                                                                        zoom: 14,
                                                                        type: 'yandex#hybrid',
                                                                    }}
                                                                    width="100%"
                                                                    height="100%"
                                                                >
                                                                    <Placemark
                                                                        geometry={mapCoords}
                                                                        options={{
                                                                            preset: 'islands#redIcon',
                                                                            iconColor: '#ef4444',
                                                                        }}
                                                                    />
                                                                </Map>
                                                            </YMaps>
                                                        </Box>
                                                    </Box>
                                                )}
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            </Box>

                            <TextField
                                label="Описание задачи"
                                value={taskDescription}
                                onChange={(e) => setTaskDescription(e.target.value)}
                                multiline
                                minRows={3}
                                maxRows={10}
                                placeholder="Что сделать, детали, ссылки и пр."
                                fullWidth
                                sx={glassInputSx}
                            />

                            {isDocumentProject && (
                                <Alert severity="info" sx={{ bgcolor: alertInfoBg }}>
                                    Для документальных задач укажите информацию необходимую исполнителю в описании и приложите файл
                                    ТЗ во вложения.
                                </Alert>
                            )}

                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1.5}
                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                            >
                                <Button
                                    variant="outlined"
                                    startIcon={<TableRowsIcon />}
                                    onClick={openWorkItemsDialog}
                                    disabled={saving || uploading || isDocumentProject}
                                    sx={{ borderRadius: UI_RADIUS.item }}
                                >
                                    Состав работ
                                </Button>
                                <Typography variant="body2" color="text.secondary">
                                    {isDocumentProject
                                        ? t('task.workItems.disabledForDocument', 'Недоступно для документальных задач')
                                        : workItems.length > 0
                                        ? `${workItems.length} поз. добавлено`
                                        : 'Заполните таблицу в отдельном окне'}
                                </Typography>
                            </Stack>

                            <TextField
                                label="Стоимость, ₽"
                                type="number"
                                value={totalCost}
                                onChange={(e) => setTotalCost(e.target.value)}
                                fullWidth
                                inputProps={{ min: 0, step: '0.01' }}
                                sx={glassInputSx}
                            />

                            <Box>
                                <TextField
                                    label="Оплата подрядчику, ₽"
                                    type="number"
                                    value={contractorPayment}
                                    onChange={(e) => setContractorPayment(e.target.value)}
                                    fullWidth
                                    inputProps={{ min: 0, step: '0.01' }}
                                    helperText="Сумма выплаты исполнителю за задачу"
                                    sx={glassInputSx}
                                />
                                <Typography variant="body2" sx={{ mt: 0.5 }}>
                                    Процент:{' '}
                                    {totalCostNumber > 0 ? (
                                        <Link
                                            component="button"
                                            type="button"
                                            underline="hover"
                                            onClick={() => setPercentEditorOpen((prev) => !prev)}
                                            sx={{ fontWeight: 600 }}
                                        >
                                            {contractorPercent.toFixed(1)}%
                                        </Link>
                                    ) : (
                                        'Введите стоимость, чтобы рассчитать процент'
                                    )}
                                </Typography>
                                <Collapse in={percentEditorOpen}>
                                    <Box
                                        sx={{
                                            mt: 1,
                                            p: 2,
                                            borderRadius: UI_RADIUS.item,
                                            border: `1px solid ${percentBorder}`,
                                            backgroundColor: percentBg,
                                        }}
                                    >
                                        <Stack spacing={1.5}>
                                            <TextField
                                                label="Процент оплаты"
                                                type="number"
                                                value={totalCostNumber > 0 ? contractorPercent.toFixed(2) : ''}
                                                onChange={(e) => handlePercentInputChange(e.target.value)}
                                                fullWidth
                                                inputProps={{ min: 0, max: 100, step: '0.1' }}
                                                disabled={totalCostNumber <= 0}
                                            />
                                            <Slider
                                                value={
                                                    totalCostNumber > 0
                                                        ? Math.min(Math.max(contractorPercent, 0), 100)
                                                        : 0
                                                }
                                                onChange={(_e, value) =>
                                                    handlePercentUpdate(
                                                        Array.isArray(value) ? value[0] ?? 0 : value ?? 0
                                                    )
                                                }
                                                min={0}
                                                max={100}
                                                step={1}
                                                disabled={totalCostNumber <= 0}
                                                valueLabelDisplay="auto"
                                            />
                                            <Typography variant="caption" color="text.secondary">
                                                Измените процент, чтобы автоматически пересчитать оплату от поля
                                                «Стоимость».
                                            </Typography>
                                        </Stack>
                                    </Box>
                                </Collapse>
                            </Box>

                            {!showInitiatorFields ? (
                                <Link
                                    component="button"
                                    onClick={() => setShowInitiatorFields(true)}
                                    sx={{ alignSelf: 'flex-start' }}
                                >
                                    Указать инициатора задачи
                                </Link>
                            ) : (
                                <Stack spacing={1.5}>
                                    <Autocomplete<InitiatorOption>
                                        options={initiatorOptions}
                                        value={selectedInitiator}
                                        onChange={(_e, val, reason) => {
                                            if (reason === 'clear') {
                                                setInitiatorName('');
                                                setInitiatorEmail('');
                                                return;
                                            }
                                            if (!val) return;
                                            setInitiatorName(val.name || '');
                                            setInitiatorEmail(val.email || '');
                                        }}
                                        getOptionLabel={(opt) => {
                                            if (!opt) return '';
                                            return opt.email
                                                ? `${opt.name || opt.email} (${opt.email})`
                                                : opt.name;
                                        }}
                                        loading={initiatorOptionsLoading}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Инициатор (подсказка)"
                                                placeholder="Выберите ранее указанного инициатора"
                                                fullWidth
                                                sx={glassInputSx}
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (
                                                        <>
                                                            {initiatorOptionsLoading ? (
                                                                <CircularProgress size={18} sx={{ mr: 1 }} />
                                                            ) : null}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    ),
                                                }}
                                            />
                                        )}
                                        renderOption={(props, option) => {
                                            const { key, ...optionProps } = props;
                                            return (
                                                <li {...optionProps} key={key}>
                                                    <ListItemText
                                                        primary={option.name || option.email}
                                                        secondary={option.email || undefined}
                                                    />
                                                </li>
                                            );
                                        }}
                                        isOptionEqualToValue={(opt, val) =>
                                            opt.email === val.email && opt.name === val.name
                                        }
                                    />
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                        <TextField
                                            label="Инициатор (имя)"
                                            value={initiatorName}
                                            onChange={(e) => setInitiatorName(e.target.value)}
                                            fullWidth
                                            sx={glassInputSx}
                                        />
                                        <TextField
                                            label="Инициатор (email)"
                                            value={initiatorEmail}
                                            onChange={(e) => setInitiatorEmail(e.target.value)}
                                            fullWidth
                                            sx={glassInputSx}
                                        />
                                    </Stack>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <Button
                                            size="small"
                                            variant="text"
                                            onClick={() => setShowInitiatorFields(false)}
                                            sx={{ px: 0 }}
                                        >
                                            Скрыть поля
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => {
                                                setInitiatorName('');
                                                setInitiatorEmail('');
                                            }}
                                        >
                                            Очистить инициатора
                                        </Button>
                                    </Stack>
                                </Stack>
                            )}

                            <Autocomplete<MemberOption>
                                options={executorOptions}
                                value={selectedExecutor}
                                onChange={(_e, val) => setSelectedExecutor(val)}
                                getOptionLabel={(opt) => opt?.name || opt?.email || ''}
                                loading={membersLoading}
                                noOptionsText={
                                    membersError ? `Ошибка: ${membersError}` : 'Нет подходящих участников'
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Исполнитель (участники организации)"
                                        placeholder={
                                            membersLoading ? 'Загрузка...' : 'Начните вводить имя или email'
                                        }
                                        fullWidth
                                        sx={glassInputSx}
                                        helperText={
                                            selectedExecutorMismatch
                                                ? t(
                                                    'tasks.executor.specializationMismatch',
                                                    'Выбранный исполнитель не подходит по специализации'
                                                )
                                                : undefined
                                        }
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {membersLoading ? (
                                                        <CircularProgress size={18} sx={{ mr: 1 }} />
                                                    ) : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                                renderOption={(props, option) => {
                                    const { key, ...optionProps } = props;
                                    return (
                                        <li {...optionProps} key={key}>
                                            <Avatar
                                                src={option.profilePic}
                                                alt={option.name}
                                                sx={{ width: 24, height: 24, mr: 1 }}
                                            >
                                                {(option.name || option.email)?.[0]?.toUpperCase() ?? 'U'}
                                            </Avatar>
                                            <ListItemText primary={option.name} secondary={option.email} />
                                        </li>
                                    );
                                }}
                                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                            />

                            <Autocomplete<RelatedTaskOption, true, false, false>
                                multiple
                                options={relatedOptions}
                                value={relatedTasksSelected}
                                inputValue={relatedInput}
                                onInputChange={(_e, value) => {
                                    setRelatedInput(value);
                                    if (relatedSearchTimeout.current) clearTimeout(relatedSearchTimeout.current);
                                    relatedSearchTimeout.current = setTimeout(() => {
                                        void loadRelatedTasks(value);
                                    }, 300);
                                }}
                                onChange={(_e, value) => setRelatedTasksSelected(value)}
                                loading={relatedTasksLoading}
                                filterOptions={(opts) => {
                                    if (!relatedTasksSelected.length) return opts;
                                    const selectedIds = new Set(relatedTasksSelected.map((t) => t.id));
                                    return opts.filter((opt) => !selectedIds.has(opt.id));
                                }}
                                getOptionLabel={(opt) => formatRelatedTaskLabel(opt)}
                                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                noOptionsText={
                                    relatedTasksError
                                        ? `Ошибка: ${relatedTasksError}`
                                        : 'Задачи не найдены'
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Связанные задачи"
                                        placeholder="Поиск по названию, ID или BS"
                                        fullWidth
                                        sx={glassInputSx}
                                        helperText="Задачи, связанные по зависимостям или макро-задаче"
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {relatedTasksLoading ? (
                                                        <CircularProgress size={18} sx={{ mr: 1 }} />
                                                    ) : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                                renderOption={(props, option) => {
                                    const { key, ...optionProps } = props;
                                    return (
                                        <li {...optionProps} key={key}>
                                            <ListItemText
                                                primary={formatRelatedTaskLabel(option)}
                                                secondary={
                                                    option.bsNumber ? `BS: ${option.bsNumber}` : undefined
                                                }
                                            />
                                        </li>
                                    );
                                }}
                            />

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <FormControl fullWidth sx={glassInputSx}>
                                    <InputLabel>Priority</InputLabel>
                                    <Select
                                        label="Priority"
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value as Priority)}
                                    >
                                        <MenuItem value="urgent">Urgent</MenuItem>
                                        <MenuItem value="high">High</MenuItem>
                                        <MenuItem value="medium">Medium</MenuItem>
                                        <MenuItem value="low">Low</MenuItem>
                                    </Select>
                                </FormControl>

                                <DatePicker
                                    label="Due Date"
                                    value={dueDate}
                                    onChange={(d) => setDueDate(d)}
                                    format="dd.MM.yyyy"
                                    slotProps={{ textField: { fullWidth: true, sx: glassInputSx } }}
                                />
                            </Stack>

                            {!!existingAttachments.length && (
                                <Box>
                                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                        Уже прикреплено: {existingAttachments.length}
                                    </Typography>
                                    <Stack direction="row" flexWrap="wrap" gap={1}>
                                        {existingAttachments.map((f) => (
                                            <Box
                                                key={f.key}
                                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                                            >
                                                <Chip
                                                    label={f.name}
                                                    component={f.url ? 'a' : 'div'}
                                                    href={f.url}
                                                    clickable={Boolean(f.url)}
                                                    target={f.url ? '_blank' : undefined}
                                                    rel={f.url ? 'noopener noreferrer' : undefined}
                                                    sx={{ maxWidth: '100%' }}
                                                />
                                                <Tooltip title="Удалить">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            requestDeleteExisting(f);
                                                        }}
                                                    >
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        ))}
                                    </Stack>
                                </Box>
                            )}

                            {!!attachments.length && (
                                <Box>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        spacing={1}
                                        sx={{ mb: 1 }}
                                    >
                                        <Typography variant="subtitle2">
                                            Вложения к загрузке: {attachments.length}
                                        </Typography>
                                        {uploading && (
                                            <>
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={uploadProgress}
                                                    sx={{ flex: 1 }}
                                                />
                                                <Typography
                                                    variant="caption"
                                                    sx={{ minWidth: 36, textAlign: 'right' }}
                                                >
                                                    {uploadProgress}%
                                                </Typography>
                                            </>
                                        )}
                                    </Stack>

                                    <Stack direction="row" flexWrap="wrap" gap={1}>
                                        {attachments.map((f) => (
                                            <Chip
                                                key={`${f.name}:${f.size}`}
                                                label={`${f.name} (${Math.round(f.size / 1024)} KB)`}
                                                onDelete={
                                                    !saving && !uploading
                                                        ? () => removeFile(f.name, f.size)
                                                        : undefined
                                                }
                                                deleteIcon={
                                                    <Tooltip title="Удалить">
                                                        <IconButton size="small" edge="end">
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                }
                                                sx={{ maxWidth: '100%' }}
                                            />
                                        ))}
                                    </Stack>
                                </Box>
                            )}

                            {estimateFile && (
                                <Alert severity="info" sx={{ bgcolor: alertInfoBg }}>
                                    Файл «{estimateFile.name}» будет сохранён в документы задачи и
                                    не попадёт в вложения.
                                </Alert>
                            )}

                            <Alert severity="info" sx={{ bgcolor: alertInfoBg }}>
                                {isBeelineOperator
                                    ? 'Для Билайн файл ТЗ берётся из ID и будет добавлен во вложения. Добавьте сюда остальные файлы.'
                                    : 'Загрузите ТЗ и исходные материалы во вложения задачи.'}
                            </Alert>

                            <Box
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                                sx={{
                                    border: '1.5px dashed',
                                    borderColor: dragActive
                                        ? 'rgba(59,130,246,0.8)'
                                        : dropBorder,
                                    borderRadius: UI_RADIUS.tooltip,
                                    p: 3,
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    backgroundColor: dragActive
                                        ? dropHoverBg
                                        : dropBg,
                                    transition: 'all 180ms ease',
                                    boxShadow: dragActive
                                        ? isDarkMode
                                            ? '0 20px 45px rgba(0,0,0,0.35)'
                                            : '0 20px 45px rgba(15,23,42,0.15)'
                                        : 'none',
                                }}
                                onClick={openFileDialog}
                            >
                                <CloudUploadIcon
                                    sx={{ fontSize: 36, mb: 1, color: 'primary.main' }}
                                />
                                <Typography variant="body1">
                                    Перетащите файлы или нажмите, чтобы выбрать
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Вложения сохраняются как <b>attachments</b> этой задачи
                                </Typography>
                                {isBeelineOperator && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        Файл ТЗ из ID для Билайн будет добавлен сюда автоматически.
                                    </Typography>
                                )}
                                <input
                                    ref={inputRef}
                                    type="file"
                                    multiple
                                    hidden
                                    onChange={onFileInputChange}
                                />
                            </Box>
                        </Stack>
                    </Box>

                    <Divider sx={{ borderColor: dividerColor }} />

                    <Box
                        sx={{
                            px: 3,
                            py: 2.5,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 1.5,
                            backgroundColor: actionsBg,
                            borderTop: `1px solid ${headerDivider}`,
                        }}
                    >
                        <Button
                            onClick={handleClose}
                            disabled={saving || uploading}
                            sx={{ borderRadius: UI_RADIUS.pill, px: 3 }}
                        >
                            Отмена
                        </Button>
                        {isEdit ? (
                            <Button
                                onClick={handleUpdate}
                                variant="contained"
                                disabled={saveDisabled}
                                sx={{
                                    borderRadius: UI_RADIUS.pill,
                                    px: 3,
                                    textTransform: 'none',
                                    boxShadow:
                                        '0 20px 45px rgba(59,130,246,0.45)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                }}
                            >
                                Сохранить
                                {savingIndicator}
                            </Button>
                        ) : (
                            <Button
                                onClick={handleCreate}
                                variant="contained"
                                disabled={saveDisabled}
                                sx={{
                                    borderRadius: UI_RADIUS.pill,
                                    px: 3,
                                    textTransform: 'none',
                                    boxShadow:
                                        '0 20px 45px rgba(59,130,246,0.45)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                }}
                            >
                                Создать
                                {savingIndicator}
                            </Button>
                        )}
                    </Box>
                </Box>

                {/* диалог подтверждения удаления существующего файла */}
                <Dialog open={deleteDialogOpen} onClose={cancelDeleteExisting}>
                    <DialogTitle>Удалить вложение?</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2">
                            {attachmentToDelete?.name
                                ? `Удалить "${attachmentToDelete.name}"?`
                                : 'Удалить вложение?'}{' '}
                            Файл будет удалён и с сервера.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={cancelDeleteExisting} disabled={deletingExisting}>
                            Отмена
                        </Button>
                        <Button
                            onClick={confirmDeleteExisting}
                            color="error"
                            variant="contained"
                            disabled={deletingExisting}
                        >
                            Удалить
                        </Button>
                    </DialogActions>
                </Dialog>

                <Snackbar
                    open={snackbarOpen}
                    autoHideDuration={3000}
                    onClose={handleSnackbarClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        onClose={handleSnackbarClose}
                        severity={snackbarSeverity}
                        variant="filled"
                        sx={{ width: '100%' }}
                    >
                        {snackbarMsg}
                    </Alert>
                </Snackbar>

                {isT2Operator && (
                    <T2EstimateParser
                        open={estimateDialogOpen}
                        onClose={() => setEstimateDialogOpen(false)}
                        onApply={handleEstimateApply}
                        operatorLabel="Т2"
                    />
                )}

                {isBeelineOperator && (
                    <BeIdParser
                        open={beIdDialogOpen}
                        onClose={() => setBeIdDialogOpen(false)}
                        onApply={handleBeIdApply}
                        operatorLabel="Билайн"
                    />
                )}

                {!isDocumentProject && (
                    <WorkItemsEditorDialog
                        open={workItemsDialogOpen}
                        initialItems={workItems}
                        onClose={closeWorkItemsDialog}
                        onSave={handleWorkItemsSave}
                    />
                )}

            </Drawer>
        </LocalizationProvider>
    );
}
