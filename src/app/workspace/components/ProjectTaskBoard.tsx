// app/workspace/components/ProjectTaskBoard.tsx

'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    Alert,
} from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import TaskOutlinedIcon from '@mui/icons-material/TaskOutlined';
import { useTheme } from '@mui/material/styles';
import { getStatusColor } from '@/utils/statusColors';
import { getPriorityIcon, normalizePriority } from '@/utils/priorityIcons';
import { STATUS_ORDER, getStatusLabel, normalizeStatusTitle } from '@/utils/statusLabels';
import type { CurrentStatus } from '@/app/types/taskTypes';
import WorkspaceTaskDialog, { TaskForEdit } from '@/app/workspace/components/WorkspaceTaskDialog';
import TaskContextMenu from '@/app/workspace/components/TaskContextMenu';
import { UI_RADIUS } from '@/config/uiTokens';

type StatusTitle = CurrentStatus;

// тип задачи, приходящей в доску
type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    bsNumber?: string;
    projectKey?: string;
    createdAt?: string;
    dueDate?: string;
    status?: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low' | string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;

    // для диалога
    bsAddress?: string;
    taskDescription?: string;
    bsLatitude?: number;
    bsLongitude?: number;
    totalCost?: number;
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
};

const formatDateRU = (v?: string) => (v ? new Date(v).toLocaleDateString('ru-RU') : '—');

function TaskCard({
                      t,
                      statusTitle,
                      onClick,
                      onContextMenu,
                  }: {
    t: Task;
    statusTitle: StatusTitle;
    onClick?: (task: Task) => void;
    onContextMenu?: (e: React.MouseEvent, task: Task) => void;
}) {
    const p = normalizePriority(t.priority);
    const execLabel = t.executorName || t.executorEmail || '';
    const execTooltip =
        t.executorName && t.executorEmail ? `${t.executorName} • ${t.executorEmail}` : execLabel;
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const cardBg = isDark
        ? 'linear-gradient(175deg, rgba(15,18,28,0.92), rgba(20,28,45,0.9))'
        : 'linear-gradient(175deg, rgba(255,255,255,0.96), rgba(248,250,255,0.92))';
    const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const cardShadow = isDark ? '0 25px 60px rgba(0,0,0,0.55)' : '0 25px 60px rgba(15,23,42,0.15)';

    return (
        <Card
            data-task-id={t._id}
            sx={{
                mb: 2,
                boxShadow: cardShadow,
                position: 'relative',
                overflow: 'hidden',
                cursor: onClick ? 'pointer' : 'default',
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                '&:hover': onClick ? { transform: 'translateY(-1px)', transition: '150ms ease' } : undefined,
            }}
            onClick={onClick ? () => onClick(t) : undefined}
            onContextMenu={onContextMenu ? (e) => onContextMenu(e, t) : undefined}
        >
            <Box sx={{ mt: '5px', ml: '5px' }}>
                <Typography variant="caption" color="text.secondary">
                    <TaskOutlinedIcon sx={{ fontSize: 15, mb: 0.5, mr: 0.5 }} />
                    {t.taskId} {t.createdAt ? new Date(t.createdAt).toLocaleDateString('ru-RU') : ''}
                </Typography>
            </Box>

            <CardContent sx={{ pb: 6 }}>
                <Typography variant="subtitle1" gutterBottom>
                    {t.taskName}
                </Typography>

                <Typography variant="body2">BS: {t.bsNumber || '—'}</Typography>
                <Typography variant="caption" color="text.secondary">
                    Проект: {t.projectKey || '—'}
                </Typography>

                <Box sx={{ mt: 0.5, minHeight: 28 }}>
                    {execLabel ? (
                        <Tooltip title={execTooltip}>
                            <Chip size="small" label={execLabel} variant="outlined" sx={{ maxWidth: '100%' }} />
                        </Tooltip>
                    ) : (
                        <Typography variant="caption" color="text.secondary">
                            Исполнитель: —
                        </Typography>
                    )}
                </Box>

                <Typography variant="caption">Due date: {formatDateRU(t.dueDate)}</Typography>
            </CardContent>

            <Box
                sx={{
                    position: 'absolute',
                    left: 8,
                    right: 8,
                    bottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                }}
            >
                <Chip
                    label={getStatusLabel(statusTitle)}
                    size="small"
                    sx={{ bgcolor: getStatusColor(statusTitle), color: '#fff' }}
                />

                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
                    {p && (
                        <Tooltip title={p}>
                            <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                {getPriorityIcon(p, { fontSize: 20 })}
                            </Box>
                        </Tooltip>
                    )}
                </Box>
            </Box>
        </Card>
    );
}

export default function ProjectTaskBoard({
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
    org: string;
    project: string;
    onReloadAction?: () => void;
}) {

    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const columnBg = isDark ? 'rgba(10,13,20,0.9)' : 'rgba(255,255,255,0.94)';
    const columnBorder = isDark ? 'rgba(255,255,255,0.08)' : 'divider';
    const columnShadow = isDark ? '0 30px 70px rgba(0,0,0,0.55)' : '0 12px 30px rgba(15,23,42,0.12)';

    const router = useRouter();

    // группировка по статусу
    const grouped = useMemo(() => {
        const base: Record<StatusTitle, Task[]> = STATUS_ORDER.reduce((acc, status) => {
            acc[status] = [];
            return acc;
        }, {} as Record<StatusTitle, Task[]>);
        for (const t of items) {
            const s = normalizeStatusTitle(t.status);
            base[s].push(t);
        }
        return base;
    }, [items]);

    const [editOpen, setEditOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [menuTask, setMenuTask] = useState<Task | null>(null);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // ЛКМ - переход на страницу задачи
    const openTaskPage = (task: Task) => {
        const slug = task.taskId;
        router.push(
            `/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/tasks/${encodeURIComponent(slug)}`
        );
    };
    const handleCardClick = (t: Task) => {
        openTaskPage(t);
    };

    // ПКМ по карточке — открыть меню
    const handleCardContext = (e: React.MouseEvent, t: Task) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuTask(t);
        setMenuPos({ top: e.clientY - 4, left: e.clientX - 2 });
    };

    const closeMenu = () => setMenuPos(null);

    // открытие страницы задачи из контекстного меню
    const onOpenTask = () => {
        if (menuTask) {
            openTaskPage(menuTask);
        }
    };


    const onEditTask = () => {
        if (!menuTask) return;
        setSelectedTask(menuTask);
        setEditOpen(true);
    };

    const onDeleteTask = () => {
        if (!menuTask) return;
        setDeleteError(null);
        setDeleteOpen(true);
    };

    // удаление
    const confirmDelete = async () => {
        if (!menuTask) return;
        try {
            setDeleteLoading(true);
            setDeleteError(null);
            const url = `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                project
            )}/tasks/${encodeURIComponent(menuTask.taskId)}`;
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

    const handleEdited = () => {
        setEditOpen(false);
        onReloadAction?.();
    };

    if (loading)
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">Загрузка…</Typography>
            </Box>
        );
    if (error)
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="error">{error}</Typography>
            </Box>
        );

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 3, p: 3, overflowX: 'auto', minHeight: '60vh' }}>
                {STATUS_ORDER.map((status) => (
                    <Box
                        key={status}
                        sx={{
                            minWidth: 260,
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
                        {(grouped[status] || []).map((t) => (
                            <TaskCard
                                key={t._id}
                                t={t}
                                statusTitle={status}
                                onClick={handleCardClick}
                                onContextMenu={handleCardContext}
                            />
                        ))}
                    </Box>
                ))}
            </Box>

            {/* меню */}
            <TaskContextMenu
                anchorPosition={menuPos}
                onClose={closeMenu}
                onOpenTask={onOpenTask}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
            />

            {/* диалог удаления */}
            <Dialog open={deleteOpen} onClose={deleteLoading ? undefined : () => setDeleteOpen(false)}>
                <DialogTitle>Удалить задачу?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Это действие нельзя отменить. Будет удалена задача
                        {menuTask ? ` «${menuTask.taskName}»` : ''}.
                    </DialogContentText>
                    {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
                        Отмена
                    </Button>
                    <Button onClick={confirmDelete} variant="contained" color="error" disabled={deleteLoading}>
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
                        priority: normalizePriority(selectedTask.priority || 'medium') || 'medium',
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
}
