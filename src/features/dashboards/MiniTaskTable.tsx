// app/components/dashboards/MiniTaskTable.tsx

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import Link from 'next/link';

import RemoveIcon from '@mui/icons-material/Remove';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';

import { Task } from '@/app/types/taskTypes';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel } from '@/utils/statusLabels';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { isAdminRole } from '@/app/utils/roleGuards';

interface MiniTaskTableProps {
  role: EffectiveOrgRole | null;
  clerkUserId: string;
  ctaLabel?: string;
  ctaHref?: string;
  maxItems?: number;
}

interface OrgSummary {
  _id: string;
  orgSlug: string;
}

type OrgResponse = { orgs: OrgSummary[] } | { error: string };

// Функция для выбора иконки по приоритету
function getPriorityIcon(priority: string) {
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
      return <RemoveIcon sx={{ color: '#28a0e9' }} />;
  }
}

export default function MiniTaskTable({
  role,
  clerkUserId,
  ctaLabel,
  ctaHref,
  maxItems,
}: MiniTaskTableProps) {
  const theme = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgSlugById, setOrgSlugById] = useState<Record<string, string>>({});
  const shouldUseOrgRoutes = role !== null && role !== 'executor';
  const isAdmin = isAdminRole(role);

  // 1. Загружаем все задачи
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/tasks');
        if (!res.ok) {
          setError('Не удалось загрузить задачи');
          return;
        }
        const data = await res.json();
        setTasks(data.tasks);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  useEffect(() => {
    if (!shouldUseOrgRoutes) return;
    const controller = new AbortController();

    const fetchOrgs = async () => {
      try {
        const endpoint = isAdmin ? '/api/admin/organizations' : '/api/org';
        const res = await fetch(endpoint, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as
          | OrgResponse
          | { organizations?: Array<{ orgId: string; orgSlug: string }> }
          | { error: string };
        const orgList =
          'orgs' in data
            ? data.orgs
            : 'organizations' in data
              ? data.organizations
              : undefined;
        if (!orgList || !Array.isArray(orgList)) return;
        const map = orgList.reduce<Record<string, string>>((acc, org) => {
          const id = '_id' in org ? org._id : org.orgId;
          if (id) {
            acc[id] = org.orgSlug;
          }
          return acc;
        }, {});
        setOrgSlugById(map);
      } catch (err: unknown) {
        if ((err as DOMException)?.name !== 'AbortError') {
          setOrgSlugById({});
        }
      }
    };

    void fetchOrgs();
    return () => controller.abort();
  }, [isAdmin, shouldUseOrgRoutes]);

  // 2. Фильтруем задачи
  const filteredTasks = useMemo(() => {
    if (!role) return tasks;
    if (isAdminRole(role) || role === 'manager' || role === 'viewer') {
      return tasks;
    }
    if (role === 'executor') {
      return tasks.filter((t) => t.executorId === clerkUserId);
    }
    return tasks;
  }, [role, clerkUserId, tasks]);

  // 3. Сортируем по дате создания (createdAt) в убывающем порядке (самые свежие сверху)
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filteredTasks]);

  const rowLimit = maxItems ?? 5;
  // 4. Берём только первые N для отображения
  const lastFive = sortedTasks.slice(0, rowLimit);
  const tableMaxHeight =
    rowLimit >= 5 ? 310 : Math.max(210, 70 + rowLimit * 48);
  const resolvedCtaHref = useMemo(() => {
    if (isAdmin) return ctaHref ?? '/admin/tasks';
    if (!shouldUseOrgRoutes) return ctaHref ?? '/tasks';
    const taskWithProject = sortedTasks.find(
      (task) => task.orgId && (task.projectKey || task.projectId)
    );
    if (!taskWithProject) return ctaHref ?? '/tasks';
    const orgId = taskWithProject.orgId as string;
    const orgRef = orgSlugById[orgId] ?? orgId;
    const projectRef = taskWithProject.projectKey || taskWithProject.projectId;
    if (!orgRef || !projectRef) return ctaHref ?? '/tasks';
    return `/org/${encodeURIComponent(orgRef)}/projects/${encodeURIComponent(
      projectRef
    )}/tasks`;
  }, [ctaHref, isAdmin, orgSlugById, shouldUseOrgRoutes, sortedTasks]);

  const resolveTaskHref = (task: Task) => {
    if (shouldUseOrgRoutes && task.orgId) {
      const orgRef = orgSlugById[task.orgId] ?? task.orgId;
      const projectRef = task.projectKey || task.projectId;
      if (orgRef && projectRef) {
        return `/org/${encodeURIComponent(
          orgRef
        )}/projects/${encodeURIComponent(projectRef)}/tasks/${encodeURIComponent(
          task.taskId
        )}`;
      }
    }
    return `/tasks/${task.taskId.toLowerCase()}`;
  };

  if (loading) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        height='200px'
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color='error' textAlign='center' mt={2}>
        {error}
      </Typography>
    );
  }

  if (lastFive.length === 0) {
    return (
      <Typography textAlign='center' mt={2}>
        Задач не найдено
      </Typography>
    );
  }

  return (
    <Box>
      {/* Контейнер фиксированной высоты, чтобы 5-я строка отображалась частично */}
      <Box
        sx={{
          position: 'relative',
          maxHeight: tableMaxHeight,
          overflow: 'hidden',
          mb: 2,
        }}
      >
        <TableContainer component={Paper} sx={{ maxHeight: tableMaxHeight }}>
          <Table size='small' stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell align='center'>ID</TableCell>
                <TableCell align='center'>Задача</TableCell>
                <TableCell align='center'>Срок</TableCell>
                <TableCell align='center'>Статус</TableCell>
                <TableCell align='center'>Приоритет</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lastFive.map((task) => (
                <TableRow key={task.taskId}>
                  <TableCell>
                    <Link href={resolveTaskHref(task)}>
                      {task.taskId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={resolveTaskHref(task)}>
                      {task.taskName}
                      {task.bsNumber ? ` / ${task.bsNumber}` : ''}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {new Date(task.dueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell align='center'>
                    <Chip
                      label={getStatusLabel(task.status)}
                      sx={{
                        backgroundColor: getStatusColor(task.status),
                        color: theme.palette.common.white,
                      }}
                      size='small'
                    />
                  </TableCell>
                  <TableCell align='center'>
                    <Tooltip title={task.priority}>
                      <Box component='span'>
                        {getPriorityIcon(task.priority)}
                      </Box>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: `linear-gradient(${alpha(
              theme.palette.background.paper,
              0
            )}, ${theme.palette.background.paper} 80%)`,
            pointerEvents: 'none',
          }}
        />
      </Box>

      <Box
        sx={{
          textAlign: 'center',
        }}
      >
        <Link href={resolvedCtaHref}>
          <Button variant='text'>{ctaLabel ?? 'Все задачи'}</Button>
        </Link>
      </Box>
    </Box>
  );
}
