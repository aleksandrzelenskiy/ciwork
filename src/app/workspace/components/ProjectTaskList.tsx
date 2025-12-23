// src/app/workspace/components/ProjectTaskList.tsx
'use client';

import React, {
    useMemo,
    useState,
    useEffect,
    forwardRef,
    useImperativeHandle,
    useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Tooltip,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Checkbox,
    Pagination,
    Alert,
    Avatar,
    Stack,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Menu,
    MenuItem as MMenuItem,
    Divider,
    ListItemIcon as MListItemIcon,
    ListItemText as MListItemText,
    IconButton,
    FormControlLabel,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import CloseIcon from '@mui/icons-material/Close';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';

import { useTheme } from '@mui/material/styles';
import { getStatusColor } from '@/utils/statusColors';
import { getPriorityIcon, getPriorityLabelRu, normalizePriority, type Priority as Pri } from '@/utils/priorityIcons';
import { STATUS_ORDER, getStatusLabel, normalizeStatusTitle } from '@/utils/statusLabels';
import type { CurrentStatus } from '@/app/types/taskTypes';


import WorkspaceTaskDialog, { TaskForEdit } from '@/app/workspace/components/WorkspaceTaskDialog';

/* ───────────── типы ───────────── */
type StatusTitle = CurrentStatus;

type Priority = 'urgent' | 'high' | 'medium' | 'low';

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: string;
    dueDate?: string;
    createdAt?: string;
    bsNumber?: string;
    totalCost?: number;
    priority?: Priority | string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
    bsAddress?: string;
    taskDescription?: string;
    bsLatitude?: number;
    bsLongitude?: number;
    workItems?: Array<{
        workType?: string;
        quantity?: number;
        unit?: string;
        note?: string;
    }>;
    files?: Array<{ name?: string; url?: string; size?: number }>;
    attachments?: string[];
    bsLocation?: Array<{ name: string; coordinates: string }>;
    relatedTasks?: string[];
    orderUrl?: string;
    orderNumber?: string;
    orderDate?: string;
};

type TaskWithStatus = Task & { _statusTitle: StatusTitle };

/* ───────────── утилиты ───────────── */
const formatDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU');
};

const getInitials = (s?: string) =>
    (s ?? '')
        .split('@')[0]
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('') || '•';

const COLUMN_KEYS = ['taskId', 'task', 'status', 'priority', 'executor', 'due', 'order'] as const;
type ColumnKey = (typeof COLUMN_KEYS)[number];

const COLUMN_LABELS: Record<ColumnKey, string> = {
    taskId: 'ID',
    task: 'Задача',
    status: 'Статус',
    priority: 'Приоритет',
    executor: 'Исполнитель',
    due: 'Срок',
    order: 'Заказ',
};

const DEFAULT_COLUMN_VISIBILITY: Record<ColumnKey, boolean> = {
    taskId: true,
    task: true,
    status: true,
    priority: true,
    executor: true,
    due: true,
    order: true,
};

const COLUMN_STORAGE_PREFIX = 'project-task-columns';

export interface ProjectTaskListHandle {
    openColumns: () => void;
    closeColumns: () => void;
    hasCustomColumns: () => boolean;
}

type UserProfile = {
    name?: string;
    profilePic?: string;
};

type ProjectTaskListProps = {
    items: Task[];
    loading: boolean;
    error: string | null;
    org: string;
    project: string;
    onReloadAction?: () => void;
    userProfiles: Record<string, UserProfile>;
    onColumnsCustomizationChange?: (custom: boolean) => void;
};

/* ───────────── компонент ───────────── */
const ProjectTaskListInner = (
    {
        items,
        loading,
        error,
        org,
        project,
        onReloadAction,
        userProfiles,
        onColumnsCustomizationChange,
    }: ProjectTaskListProps,
    ref: React.ForwardedRef<ProjectTaskListHandle>
) => {

    const router = useRouter();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const menuBg = isDarkMode ? 'rgba(16,21,32,0.92)' : 'rgba(255,255,255,0.92)';
    const menuBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const menuShadow = isDarkMode ? '0 30px 60px rgba(0,0,0,0.65)' : '0 30px 60px rgba(15,23,42,0.18)';
    const menuText = isDarkMode ? '#f8fafc' : '#0f172a';
    const menuIconBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const menuIconDangerBg = 'rgba(239,68,68,0.12)';
    const menuIconColor = menuText;
    const menuIconDangerColor = '#ef4444';
    const menuItemHover = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)';
    const rowHoverBg = isDarkMode ? 'rgba(255,255,255,0.08)' : '#fffde7';
    const tableBg = isDarkMode ? 'rgba(10,13,20,0.92)' : '#ffffff';
    const headBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(248,250,252,0.95)';
    const cellBorder = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const tableShadow = isDarkMode ? '0 25px 70px rgba(0,0,0,0.55)' : '0 20px 50px rgba(15,23,42,0.12)';

    const storageKey = useMemo(
        () => `${COLUMN_STORAGE_PREFIX}:${org || 'org'}:${project || 'project'}`,
        [org, project]
    );
    const [columnVisibility, setColumnVisibility] =
        useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMN_VISIBILITY);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                const next: Record<ColumnKey, boolean> = { ...DEFAULT_COLUMN_VISIBILITY };
                COLUMN_KEYS.forEach((key) => {
                    if (typeof parsed[key] === 'boolean') {
                        next[key] = parsed[key];
                    }
                });
                setColumnVisibility(next);
            }
        } catch {
            // ignore malformed storage
        }
    }, [storageKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(storageKey, JSON.stringify(columnVisibility));
    }, [columnVisibility, storageKey]);

    const hasCustomColumns = useMemo(
        () => COLUMN_KEYS.some((key) => columnVisibility[key] !== DEFAULT_COLUMN_VISIBILITY[key]),
        [columnVisibility]
    );

    useEffect(() => {
        onColumnsCustomizationChange?.(hasCustomColumns);
    }, [hasCustomColumns, onColumnsCustomizationChange]);

    const toggleColumn = (key: ColumnKey) =>
        setColumnVisibility((v) => ({ ...v, [key]: !v[key] }));

    const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
    const closeColumnsDialog = useCallback(() => setColumnsDialogOpen(false), []);
    const openColumnsDialog = useCallback(() => setColumnsDialogOpen(true), []);

    const handleSelectAllColumns = useCallback(() => {
        setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY });
    }, []);

    const handleResetColumns = useCallback(() => {
        const cleared = COLUMN_KEYS.reduce((acc, key) => {
            acc[key] = false;
            return acc;
        }, {} as Record<ColumnKey, boolean>);
        setColumnVisibility(cleared);
    }, []);

    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);

    const sortedTasks = useMemo(() => {
        const res: TaskWithStatus[] = items.map((t) => ({
            ...t,
            _statusTitle: normalizeStatusTitle(t.status),
        }));
        res.sort((a, b) => STATUS_ORDER.indexOf(a._statusTitle) - STATUS_ORDER.indexOf(b._statusTitle));
        return res;
    }, [items]);

    useEffect(() => {
        setPage(1);
    }, [sortedTasks.length]);

    const totalPages = rowsPerPage === -1 ? 1 : Math.max(1, Math.ceil(sortedTasks.length / rowsPerPage));
    const pageSlice: TaskWithStatus[] =
        rowsPerPage === -1
            ? sortedTasks
            : sortedTasks.slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage);

    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [selectedTask, setSelectedTask] = useState<TaskWithStatus | null>(null);

    const handleContextMenu = (e: React.MouseEvent, task: TaskWithStatus) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedTask(task);
        setMenuPos({ top: e.clientY - 4, left: e.clientX - 2 });
    };
    const handleCloseMenu = () => setMenuPos(null);

    const openTaskPage = (task: TaskWithStatus, target: '_self' | '_blank' = '_self') => {
        const slug = task.taskId;
        const href = `/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
            project
        )}/tasks/${encodeURIComponent(slug)}`;
        if (target === '_blank' && typeof window !== 'undefined') {
            window.open(href, '_blank', 'noopener,noreferrer');
            return;
        }
        router.push(href);
    };


    const [editOpen, setEditOpen] = useState(false);
    const handleEditTask = () => {
        if (selectedTask) setEditOpen(true);
    };
    const handleEdited = () => {
        setEditOpen(false);
        onReloadAction?.();
    };

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const askDelete = () => {
        setDeleteError(null);
        setDeleteOpen(true);
    };
    const handleCancelDelete = () => setDeleteOpen(false);
    const handleConfirmDelete = async () => {
        if (!selectedTask) return;
        try {
            setDeleteLoading(true);
            setDeleteError(null);
            const url = `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                project
            )}/tasks/${encodeURIComponent(selectedTask.taskId)}`;
            const res = await fetch(url, { method: 'DELETE' });
            if (!res.ok) {
                const data: unknown = await res.json().catch(() => ({}));
                const msg = (data as { error?: string })?.error || `Delete failed: ${res.status}`;
                setDeleteError(msg);
                return;
            }
            setDeleteOpen(false);
            onReloadAction?.();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка удаления';
            setDeleteError(msg);
        } finally {
            setDeleteLoading(false);
        }
    };

    useImperativeHandle(
        ref,
        () => ({
            openColumns: openColumnsDialog,
            closeColumns: closeColumnsDialog,
            hasCustomColumns: () => hasCustomColumns,
        }),
        [closeColumnsDialog, hasCustomColumns, openColumnsDialog]
    );

    const visibleColumnsCount = Math.max(
        1,
        Object.values(columnVisibility).filter(Boolean).length
    );

    if (loading) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">Загрузка…</Typography>
            </Box>
        );
    }
    if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;

    return (
        <Box>
            <TableContainer
                component={Box}
                sx={{
                    backgroundColor: tableBg,
                    borderRadius: 3,
                    border: `1px solid ${cellBorder}`,
                    boxShadow: tableShadow,
                    overflow: 'hidden',
                }}
            >
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: headBg }}>
                            {columnVisibility.taskId && (
                                <TableCell width={100} align="center" sx={{ borderColor: cellBorder }}>
                                    <strong>ID</strong>
                                </TableCell>
                            )}
                            {columnVisibility.task && (
                                <TableCell sx={{ minWidth: 280, width: '28%', borderColor: cellBorder }}>
                                    <strong>Задача</strong>
                                </TableCell>
                            )}
                            {columnVisibility.status && (
                                <TableCell width={200} align="center" sx={{ borderColor: cellBorder }}>
                                    <strong>Статус</strong>
                                </TableCell>
                            )}
                            {columnVisibility.priority && (
                                <TableCell width={180} align="center" sx={{ borderColor: cellBorder }}>
                                    <strong>Приоритет</strong>
                                </TableCell>
                            )}
                            {columnVisibility.executor && (
                                <TableCell width={320} sx={{ borderColor: cellBorder }}>
                                    <strong>Исполнитель</strong>
                                </TableCell>
                            )}
                            {columnVisibility.due && (
                                <TableCell width={220} align="center" sx={{ borderColor: cellBorder }}>
                                    <strong>Срок</strong>
                                </TableCell>
                            )}
                            {columnVisibility.order && (
                                <TableCell width={120} align="center" sx={{ borderColor: cellBorder }}>
                                    <strong>Заказ</strong>
                                </TableCell>
                            )}
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {pageSlice.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={visibleColumnsCount}>
                                    <Typography color="text.secondary">Пока нет задач.</Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {pageSlice.map((t) => {
                            const statusTitle = t._statusTitle;
                            const safePriority = (normalizePriority(t.priority as string) ?? 'medium') as Pri;
                            const execLabel = t.executorName || t.executorEmail || '';
                            const execSub = t.executorName && t.executorEmail ? t.executorEmail : '';
                            const execEmailKey = (t.executorEmail || '').trim().toLowerCase();
                            const execProfile = execEmailKey ? userProfiles[execEmailKey] : undefined;

                            return (
                                <TableRow
                                    key={t._id}
                                    data-task-id={t._id}
                                    onClick={(e) => {
                                        if (e.button !== 0) return;
                                        openTaskPage(t);
                                    }}
                                    onContextMenuCapture={(e) => handleContextMenu(e, t)}
                                    sx={{
                                        transition: 'background-color .15s ease',
                                        cursor: 'pointer', // теперь логичнее pointer
                                        borderColor: cellBorder,
                                        '& td': { borderColor: cellBorder },
                                        '&:hover': {
                                            backgroundColor: rowHoverBg,
                                            color: theme.palette.text.primary,
                                        },
                                    }}
                                >
                                    {columnVisibility.taskId && (
                                        <TableCell align="center">{t.taskId}</TableCell>
                                    )}

                                    {columnVisibility.task && (
                                        <TableCell>
                                            <Stack spacing={0.5}>
                                                <Typography>
                                                    {t.taskName}
                                                    {t.bsNumber ? ` ${t.bsNumber}` : ''}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Создана: {formatDate(t.createdAt)}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                    )}

                                    {columnVisibility.status && (
                                        <TableCell align="center">
                                            <Chip
                                                size="small"
                                                label={getStatusLabel(statusTitle)}
                                                variant="outlined"
                                                sx={{
                                                    backgroundColor: getStatusColor(statusTitle),
                                                    color: '#fff',
                                                    borderColor: 'transparent',
                                                }}
                                            />
                                        </TableCell>
                                    )}

                                    {columnVisibility.priority && (
                                        <TableCell align="center">
                                            {getPriorityIcon(safePriority) ? (
                                                <Tooltip title={getPriorityLabelRu(safePriority)}>
                                                    <Box
                                                        component="span"
                                                        sx={{ display: 'inline-flex', alignItems: 'center' }}
                                                    >
                                                        {getPriorityIcon(safePriority)}
                                                    </Box>
                                                </Tooltip>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    —
                                                </Typography>
                                            )}
                                        </TableCell>
                                    )}

                                    {columnVisibility.executor && (
                                        <TableCell>
                                            {execLabel ? (
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Avatar
                                                        src={execProfile?.profilePic}
                                                        sx={{ width: 32, height: 32 }}
                                                    >
                                                        {getInitials(t.executorName || t.executorEmail)}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="body2">{execLabel}</Typography>
                                                        {execSub && (
                                                            <Typography variant="caption" color="text.secondary">
                                                                {execSub}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Stack>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    —
                                                </Typography>
                                            )}
                                        </TableCell>
                                    )}

                                    {columnVisibility.due && (
                                        <TableCell align="center">{formatDate(t.dueDate)}</TableCell>
                                    )}
                                    {columnVisibility.order && (
                                        <TableCell align="center">
                                            {t.orderUrl ? (
                                                <Tooltip
                                                    title={`Заказ ${t.orderNumber || '—'} от ${formatDate(
                                                        t.orderDate
                                                    )}`}
                                                >
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (t.orderUrl && typeof window !== 'undefined') {
                                                                window.open(
                                                                    t.orderUrl,
                                                                    '_blank',
                                                                    'noopener,noreferrer'
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <DescriptionIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    —
                                                </Typography>
                                            )}
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

                {/* пагинация */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', p: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel id="rows-per-page-label">Items</InputLabel>
                        <Select
                            labelId="rows-per-page-label"
                            label="Items"
                            value={rowsPerPage}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                setRowsPerPage(v);
                                setPage(1);
                            }}
                        >
                            <MenuItem value={10}>10</MenuItem>
                            <MenuItem value={50}>50</MenuItem>
                            <MenuItem value={100}>100</MenuItem>
                            <MenuItem value={-1}>Все</MenuItem>
                        </Select>
                    </FormControl>

                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_, p) => setPage(p)}
                        color="primary"
                        showFirstButton
                        showLastButton
                    />
                </Box>


                <Dialog
                    open={columnsDialogOpen}
                    onClose={closeColumnsDialog}
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
                            Настройка колонок
                        </Typography>
                        <IconButton onClick={closeColumnsDialog}>
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {COLUMN_KEYS.map((key) => (
                            <FormControlLabel
                                key={key}
                                control={
                                    <Checkbox
                                        checked={columnVisibility[key]}
                                        onChange={() => toggleColumn(key)}
                                    />
                                }
                                label={COLUMN_LABELS[key]}
                            />
                        ))}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleSelectAllColumns} startIcon={<CheckBoxIcon />}>
                            Выбрать все
                        </Button>
                        <Button onClick={handleResetColumns} startIcon={<CheckBoxOutlineBlankIcon />}>
                            Очистить
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* контекстное меню */}
                <Menu
                    open={!!menuPos}
                    onClose={handleCloseMenu}
                    anchorReference="anchorPosition"
                    anchorPosition={menuPos ?? undefined}
                    slotProps={{
                        paper: {
                            sx: {
                                minWidth: 220,
                                borderRadius: 3,
                                backgroundColor: menuBg,
                                border: `1px solid ${menuBorder}`,
                                boxShadow: menuShadow,
                                backdropFilter: 'blur(18px)',
                                px: 1,
                                py: 0.5,
                            },
                        },
                    }}
                    MenuListProps={{ sx: { py: 0 } }}
                >
                    <MMenuItem
                        sx={{
                            borderRadius: 2,
                            color: menuText,
                            px: 1.5,
                            py: 1,
                            gap: 1.5,
                            transition: 'background-color 0.2s ease',
                            '&:hover': { backgroundColor: menuItemHover },
                        }}
                        onClick={() => {
                            if (selectedTask) {
                                openTaskPage(selectedTask);
                            }
                            handleCloseMenu();
                        }}
                    >

                    <MListItemIcon sx={{ minWidth: 0 }}>
                            <Box
                                sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 2,
                                    backgroundColor: menuIconBg,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: menuIconColor,
                                }}
                            >
                                <OpenInNewIcon fontSize="small" />
                            </Box>
                        </MListItemIcon>
                        <MListItemText primary="Открыть" />
                    </MMenuItem>

                    <MMenuItem
                        sx={{
                            borderRadius: 2,
                            color: menuText,
                            px: 1.5,
                            py: 1,
                            gap: 1.5,
                            transition: 'background-color 0.2s ease',
                            '&:hover': { backgroundColor: menuItemHover },
                        }}
                        onClick={() => {
                            handleEditTask();
                            handleCloseMenu();
                        }}
                    >
                        <MListItemIcon sx={{ minWidth: 0 }}>
                            <Box
                                sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 2,
                                    backgroundColor: menuIconBg,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: menuIconColor,
                                }}
                            >
                                <EditNoteOutlinedIcon fontSize="small" />
                            </Box>
                        </MListItemIcon>
                        <MListItemText primary="Редактировать" />
                    </MMenuItem>

                    <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)' }} />

                    <MMenuItem
                        sx={{
                            borderRadius: 2,
                            color: menuIconDangerColor,
                            px: 1.5,
                            py: 1,
                            gap: 1.5,
                            transition: 'background-color 0.2s ease',
                            '&:hover': { backgroundColor: menuIconDangerBg },
                        }}
                        onClick={() => {
                            askDelete();
                            handleCloseMenu();
                        }}
                    >
                        <MListItemIcon sx={{ minWidth: 0 }}>
                            <Box
                                sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 2,
                                    backgroundColor: menuIconDangerBg,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: menuIconDangerColor,
                                }}
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </Box>
                        </MListItemIcon>
                        <MListItemText primary="Удалить" />
                    </MMenuItem>
                </Menu>

                {/* диалог удаления */}
                <Dialog open={deleteOpen} onClose={deleteLoading ? undefined : handleCancelDelete}>
                    <DialogTitle>Удалить задачу?</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            Это действие нельзя отменить. Будет удалена задача
                            {selectedTask ? ` «${selectedTask.taskName}»` : ''}.
                        </DialogContentText>
                        {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCancelDelete} disabled={deleteLoading}>
                            Отмена
                        </Button>
                        <Button onClick={handleConfirmDelete} variant="contained" color="error" disabled={deleteLoading}>
                            {deleteLoading ? 'Удаляю…' : 'Удалить'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* диалог редактирования */}
                {selectedTask && (
                    <WorkspaceTaskDialog
                        open={editOpen}
                        org={org}
                        project={project}
                        mode="edit"
                        initialTask={{
                            _id: selectedTask._id,
                            taskId: selectedTask.taskId,
                            taskName: selectedTask.taskName,
                            status: selectedTask.status,
                            dueDate: selectedTask.dueDate,
                            bsNumber: selectedTask.bsNumber,
                            bsAddress: selectedTask.bsAddress,
                            taskDescription: selectedTask.taskDescription,
                            bsLatitude: selectedTask.bsLatitude,
                            bsLongitude: selectedTask.bsLongitude,
                            totalCost: selectedTask.totalCost,
                            priority: (normalizePriority(selectedTask.priority as string) ?? 'medium') as Pri,
                            executorId: selectedTask.executorId,
                            executorName: selectedTask.executorName,
                            executorEmail: selectedTask.executorEmail,
                            files: selectedTask.files,
                            attachments: selectedTask.attachments,
                            bsLocation: selectedTask.bsLocation,
                            workItems: selectedTask.workItems,
                            relatedTasks: selectedTask.relatedTasks,
                        } as TaskForEdit}
                        onCloseAction={() => setEditOpen(false)}
                        onCreatedAction={handleEdited}
                    />
                )}
        </Box>
    );
};

const ProjectTaskList = forwardRef<ProjectTaskListHandle, ProjectTaskListProps>(ProjectTaskListInner);

ProjectTaskList.displayName = 'ProjectTaskList';

export default ProjectTaskList;
