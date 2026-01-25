// app/components/TaskColumnPage.tsx

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Link,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Task } from '@/app/types/taskTypes';
import {
  KeyboardDoubleArrowUp as KeyboardDoubleArrowUpIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  DragHandle as DragHandleIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import TaskOutlinedIcon from '@mui/icons-material/TaskOutlined';
import Tooltip from '@mui/material/Tooltip';
import { getStatusColor } from '@/utils/statusColors';
import { fetchUserContext, resolveRoleFromContext } from '@/app/utils/userContext';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { isAdminRole } from '@/app/utils/roleGuards';
import { defaultTaskFilters, type TaskFilters } from '@/app/types/taskFilters';
import { getStatusLabel, normalizeStatusTitle, STATUS_ORDER } from '@/utils/statusLabels';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

// Формат dd.mm.yyyy (ru-RU)
const formatDateRU = (value?: Date | string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU');
};


const statusOrder: CurrentStatus[] = STATUS_ORDER;

type CurrentStatus =
  | 'To do'
  | 'Draft'
  | 'Assigned'
  | 'At work'
  | 'Done'
  | 'Pending'
  | 'Issues'
  | 'Fixed'
  | 'Agreed';

const getAuthorIdentifier = (task: Task) => ((task.authorName || task.authorEmail)?.trim() || '');

interface TaskColumnPageProps {
  searchQuery?: string;
  projectFilter?: string;
  refreshToken?: number;
  filters?: TaskFilters;
}

function DraggableTask({
  task,
  role,
  t,
}: {
  task: Task;
  role: EffectiveOrgRole | null;
  t: (key: string, fallback?: string) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (!isAdminRole(role)) return;

    return draggable({
      element,
      getInitialData: () => ({ id: task.taskId, status: task.status }),
    });
  }, [task.taskId, task.status, role]);

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'low':
        return <RemoveIcon sx={{ color: '#28a0e9' }} />;
      case 'medium':
        return <DragHandleIcon sx={{ color: '#df9b18' }} />;
      case 'high':
        return <KeyboardArrowUpIcon sx={{ color: '#ca3131' }} />;
      case 'urgent':
        return <KeyboardDoubleArrowUpIcon sx={{ color: '#ff0000' }} />;
      default:
        return null;
    }
  };

  const documentStatusHint = task.taskType === 'document'
    ? (() => {
        const normalized = normalizeStatusTitle(task.status);
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
      })()
    : null;

  return (
    <Link
      href={`/tasks/${task.taskId.toLowerCase()}`}
      sx={{ cursor: 'pointer' }}
      underline='none'
    >
      <Card
        ref={ref}
        sx={{
          mb: 2,
          cursor: isAdminRole(role) ? 'grab' : 'default',
          '&:active': { cursor: isAdminRole(role) ? 'grabbing' : 'default' },
          boxShadow: 2,
        }}
      >
        <Box sx={{ marginTop: '5px', marginLeft: '5px' }}>
          <Typography variant='caption' color='text.secondary'>
            <TaskOutlinedIcon sx={{ fontSize: 15, mb: 0.5, mr: 0.5 }} />
            {task.taskId} {new Date(task.createdAt).toLocaleDateString()}
          </Typography>
        </Box>
        <CardContent>
          <Typography variant='subtitle1' gutterBottom>
            {task.taskName}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant='body2'>BS: {task.bsNumber}</Typography>
          </Box>
          <Typography variant='caption' color='text.secondary'>
            Проект: {task.projectKey || '—'}
          </Typography>
          <Typography variant='caption' color='text.primary'>
            Due date: {formatDateRU(task.dueDate) || '—'}
          </Typography>
          <Typography variant='caption' color='text.primary'>
            Complete: {formatDateRU(task.workCompletionDate) || '—'}
          </Typography>

        </CardContent>
        <Box
          sx={{
            margin: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {documentStatusHint ? (
            <Tooltip title={documentStatusHint}>
              <Chip
                label={getStatusLabel(task.status)}
                sx={{
                  backgroundColor: getStatusColor(task.status),
                  color: '#fff',
                }}
                size='small'
              />
            </Tooltip>
          ) : (
            <Chip
              label={getStatusLabel(task.status)}
              sx={{
                backgroundColor: getStatusColor(task.status),
                color: '#fff',
              }}
              size='small'
            />
          )}
          <Tooltip title={task.priority}>
            <Typography>{getPriorityIcon(task.priority)}</Typography>
          </Tooltip>
        </Box>
      </Card>
    </Link>
  );
}

function DroppableColumn({
  status,
  tasks,
  role,
  t,
}: {
  status: CurrentStatus;
  tasks: Task[];
  role: EffectiveOrgRole | null;
  t: (key: string, fallback?: string) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const columnBackground = 'transparent';
  const columnBorder = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';
  const columnShadow = 'none';
  const headerBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.95)';
  const headerBorder = isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';
  const headerText = isDarkMode ? '#f8fafc' : '#0f172a';
  const statusLabel = getStatusLabel(status);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (!isAdminRole(role)) return;

    return dropTargetForElements({
      element,
      getData: () => ({ status }),
      onDragEnter: () => setIsDraggingOver(true),
      onDragLeave: () => setIsDraggingOver(false),
      onDrop: () => setIsDraggingOver(false),
    });
  }, [status, role]);

  return (
    <Box
      ref={ref}
      sx={{
        minWidth: 260,
        minHeight: '60vh',
        backgroundColor: columnBackground,
        p: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: isDraggingOver ? theme.palette.primary.main : columnBorder,
        position: 'relative',
        boxShadow: columnShadow,
        backdropFilter: 'blur(18px)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          backgroundColor: headerBg,
          border: '1px solid',
          borderColor: headerBorder,
          color: headerText,
          backdropFilter: 'blur(12px)',
        }}
      >
        <Typography variant='subtitle1' fontWeight={600} sx={{ color: headerText }}>
          {statusLabel}
        </Typography>
        <Typography variant='body2' fontWeight={600} sx={{ color: headerText }}>
          {tasks.length}
        </Typography>
      </Box>
      {tasks.map((task) => (
        <DraggableTask key={task.taskId} task={task} role={role} t={t} />
      ))}
    </Box>
  );
}

export default function TaskColumnPage({
  searchQuery = '',
  projectFilter = '',
  refreshToken = 0,
  filters = defaultTaskFilters,
}: TaskColumnPageProps) {
  const { t } = useI18n();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<EffectiveOrgRole | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const response = await fetch(withBasePath('/api/tasks'));
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to fetch tasks');
          setLoading(false);
          return;
        }

        setTasks(data.tasks);
        setLoading(false);

      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
      }
    };

    const fetchUserRole = async () => {
      try {
        const userContext = await fetchUserContext();
        const resolvedRole = resolveRoleFromContext(userContext);
        setRole(resolvedRole ?? null);
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    void fetchTasks();
    void fetchUserRole();

  }, [refreshToken]);

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
        if (!isAdminRole(role)) return;

        const destination = location.current.dropTargets[0];
        if (!destination) return;

        const taskId = source.data.id;
        const newStatus = destination.data.status as CurrentStatus;

        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.taskId === taskId ? { ...task, status: newStatus } : task
          )
        );

        fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }).catch((error) => console.error('Update failed:', error));
      },
    });
  }, [role]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedProject = projectFilter.trim().toLowerCase();
  const managerFilter = filters.manager;
  const statusFilter = filters.status;
  const priorityFilter = filters.priority;

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (managerFilter) {
      result = result.filter((task) => getAuthorIdentifier(task) === managerFilter);
    }
    if (statusFilter) {
      result = result.filter((task) => task.status === statusFilter);
    }
    if (priorityFilter) {
      result = result.filter((task) => task.priority === priorityFilter);
    }
    if (normalizedProject) {
      result = result.filter(
        (task) => (task.projectKey || '').toLowerCase() === normalizedProject
      );
    }

    if (normalizedSearch) {
      result = result.filter((task) => {
        const haystack = [
          task.taskId,
          task.taskName,
          task.bsNumber,
          task.projectKey,
          task.projectName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    return result;
  }, [tasks, normalizedProject, normalizedSearch, managerFilter, statusFilter, priorityFilter]);

  if (loading)
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, p: 5 }}>
          <CircularProgress />
        </Box>
    );

  if (error)
    return (
        <Typography color="error" sx={{ mt: 4, textAlign: 'center' }}>
          {error}
        </Typography>
    );


  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          gap: 3,
          p: 3,
          overflowX: 'auto',
          minHeight: 'calc(100vh - 64px)',
        }}
      >
        {statusOrder.map((status) => (
          <DroppableColumn
            key={status}
            status={status}
            tasks={filteredTasks.filter((task) => task.status === status)}
            role={role}
            t={t}
          />
        ))}
      </Box>
    </Box>
  );
}
