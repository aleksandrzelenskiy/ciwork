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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Загружаем все задачи
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/tasks');
        if (!res.ok) {
          setError('Failed to fetch tasks');
          return;
        }
        const data = await res.json();
        setTasks(data.tasks);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

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
        No tasks found
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
                <TableCell align='center'>Task</TableCell>
                <TableCell align='center'>Due Date</TableCell>
                <TableCell align='center'>Статус</TableCell>
                <TableCell align='center'>Priority</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lastFive.map((task) => (
                <TableRow key={task.taskId}>
                  <TableCell>
                    <Link href={`/tasks/${task.taskId.toLowerCase()}`}>
                      {task.taskId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/tasks/${task.taskId.toLowerCase()}`}>
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
                        color: '#fff',
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
        background: 'linear-gradient(rgba(255,255,255,0), #fff 80%)',
        pointerEvents: 'none',
      }}
    />
  </Box>

      <Box
        sx={{
          textAlign: 'center',
        }}
      >
      <Link href={ctaHref ?? '/tasks'}>
        <Button variant='text'>{ctaLabel ?? 'All Tasks'}</Button>
      </Link>
    </Box>
  </Box>
);
}
