// app/components/TaskListPage.tsx

'use client';

import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle, useCallback } from 'react';
import {
    Avatar,
    Box,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    CircularProgress,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Button,
    Popover,
    Tooltip,
    Chip,
    Checkbox,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Alert,
    Stack,
} from '@mui/material';
import Pagination from '@mui/material/Pagination';
import { useTheme } from '@mui/material/styles';
import { ViewColumn as ViewColumnIcon } from '@mui/icons-material';
import { Task } from '../types/taskTypes';
import { getStatusColor } from '@/utils/statusColors';
import { useRouter } from 'next/navigation';
import { getPriorityIcon, getPriorityLabelRu } from '@/utils/priorityIcons';
import { defaultTaskFilters, type TaskFilterOptions, type TaskFilters } from '@/app/types/taskFilters';
import { getStatusLabel } from '@/utils/statusLabels';

interface TaskListPageProps {
  searchQuery?: string;
  projectFilter?: string;
  refreshToken?: number;
  hideToolbarControls?: boolean;
  filters?: TaskFilters;
  onFilterOptionsChange?: (options: TaskFilterOptions) => void;
}

export interface TaskListPageHandle {
  openColumns: (anchor: HTMLElement) => void;
  closeColumns: () => void;
}

/* ───────────── формат даты dd.mm.yyyy ───────────── */
const formatDateRU = (value?: Date | string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU'); // dd.mm.yyyy
};

const DEFAULT_COLUMN_VISIBILITY = {
  taskId: true,
  task: true,
  project: true,
  author: true,
  created: true,
  due: true,
  complete: true,
  status: true,
  priority: true,
} as const;

type ColumnKey = keyof typeof DEFAULT_COLUMN_VISIBILITY;

const COLUMN_LABELS: Record<ColumnKey, string> = {
  taskId: 'ID',
  task: 'Задача',
  project: 'Проект',
  author: 'Менеджер',
  created: 'Создана',
  due: 'Срок',
  complete: 'Завершено',
  status: 'Статус',
  priority: 'Приоритет',
};

const COLUMN_KEYS = Object.keys(DEFAULT_COLUMN_VISIBILITY) as ColumnKey[];

const getInitials = (value?: string) => {
  if (!value) return '—';
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '—';
};

const getAuthorIdentifier = (task: Task) =>
  ((task.authorName || task.authorEmail)?.trim() || '').toLowerCase();

type UserProfile = {
  email: string;
  name?: string;
  profilePic?: string;
};


/* ───────────── строка задачи ───────────── */
function Row({
  task,
  columnVisibility,
  authorProfile,
}: {
  task: Task;
  columnVisibility: Record<ColumnKey, boolean>;
  authorProfile?: UserProfile | null;
}) {
  const router = useRouter();

  const handleRowClick = () => {
    const slug = task.taskId ? task.taskId.toLowerCase() : '';
    if (slug) {
      void router.push(`/tasks/${slug}`);
    }
  };

  const statusLabel = getStatusLabel(task.status);
  const priorityLabel = getPriorityLabelRu(task.priority) || 'Не задан';
  const authorName =
    authorProfile?.name?.trim() || task.authorName?.trim() || '';
  const authorEmail = task.authorEmail?.trim() || authorProfile?.email || '';
  const authorInitials = getInitials(authorName || authorEmail);

  return (
    <TableRow
      hover
      sx={{
        cursor: 'pointer',
        '& td': { borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)') },
        '&:hover': {
          backgroundColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#fffde7'),
        },
      }}
      onClick={handleRowClick}
    >
      {columnVisibility.taskId && (
        <TableCell align='center'>
          <Typography variant='body2' fontWeight={600}>
            {task.taskId}
          </Typography>
        </TableCell>
      )}

      {columnVisibility.task && (
        <TableCell>
          <Typography variant='subtitle2'>
            {task.taskName}
            {task.bsNumber ? ` ${task.bsNumber}` : ''}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            {formatDateRU(task.createdAt)}
          </Typography>
        </TableCell>
      )}

      {columnVisibility.project && (
        <TableCell align='center'>
          <Typography variant='subtitle2'>
            {task.projectKey || '—'}
          </Typography>
        </TableCell>
      )}

      {columnVisibility.author && (
        <TableCell>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar src={authorProfile?.profilePic} sx={{ width: 32, height: 32 }}>
              {authorInitials}
            </Avatar>
            <Box>
              <Typography variant="body2">{authorName || authorEmail || '—'}</Typography>
              {authorName && authorEmail && (
                <Typography variant="caption" color="text.secondary">
                  {authorEmail}
                </Typography>
              )}
            </Box>
          </Stack>
        </TableCell>
      )}

      {columnVisibility.created && (
        <TableCell align='center'>{formatDateRU(task.createdAt)}</TableCell>
      )}

      {columnVisibility.due && (
        <TableCell align='center'>{formatDateRU(task.dueDate)}</TableCell>
      )}

      {columnVisibility.complete && (
        <TableCell align='center'>
          {formatDateRU(task.workCompletionDate) || '—'}
        </TableCell>
      )}

      {columnVisibility.status && (
        <TableCell align='center'>
          <Chip
            label={statusLabel}
            size='small'
            sx={{
              backgroundColor: getStatusColor(task.status),
              color: '#fff',
              fontWeight: 600,
            }}
          />
        </TableCell>
      )}

      {columnVisibility.priority && (
        <TableCell align='center'>
          {getPriorityIcon(task.priority) ? (
            <Tooltip title={priorityLabel}>
              <Box
                component='span'
                sx={{ display: 'inline-flex', alignItems: 'center' }}
              >
                {getPriorityIcon(task.priority)}
              </Box>
            </Tooltip>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              —
            </Typography>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

/* ───────────── основной компонент ───────────── */
const TaskListPage = forwardRef<TaskListPageHandle, TaskListPageProps>(function TaskListPageInner(
  {
    searchQuery = '',
    projectFilter = '',
    refreshToken = 0,
    hideToolbarControls = false,
    filters = defaultTaskFilters,
    onFilterOptionsChange,
  },
  ref
) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const tableBg = isDark ? 'rgba(10,13,20,0.92)' : '#ffffff';
  const headBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(248,250,252,0.95)';
  const cellBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
  const containerShadow = isDark ? '0 25px 70px rgba(0,0,0,0.55)' : '0 20px 50px rgba(15,23,42,0.12)';
  const popoverBg = isDark ? 'rgba(12,16,26,0.95)' : theme.palette.background.paper;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ----- видимость колонок ----- */
  const [columnVisibility, setColumnVisibility] = useState<Record<
    ColumnKey,
    boolean
  >>({ ...DEFAULT_COLUMN_VISIBILITY });
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});

  /* ----- popover / пагинация ----- */
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10); // -1 = All
  const [columnsAnchorEl, setColumnsAnchorEl] = useState<HTMLElement | null>(null);

  /* ----- пагинация ----- */
  const paginatedTasks = useMemo(() => {
    if (rowsPerPage === -1) return filteredTasks;
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredTasks.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredTasks, rowsPerPage]);

  const totalPages = useMemo(() => {
    if (rowsPerPage === -1) return 1;
    return Math.ceil(filteredTasks.length / rowsPerPage);
  }, [filteredTasks, rowsPerPage]);

  const uniqueValues = useMemo(
      () => ({
        authors: Array.from(
          new Set(
            tasks
              .map((t) => (t.authorName || t.authorEmail)?.trim())
              .filter((name): name is string => Boolean(name))
          )
        ),
        executors: Array.from(
          new Set(
            tasks
              .map((t) => (t.executorName || t.executorEmail)?.trim())
              .filter((name): name is string => Boolean(name))
          )
        ),
        statuses: Array.from(new Set(tasks.map((t) => t.status))),
        priorities: Array.from(new Set(tasks.map((t) => t.priority))),
      }),
      [tasks]
  );

  useEffect(() => {
    onFilterOptionsChange?.({
      managers: uniqueValues.authors,
      executors: uniqueValues.executors,
      statuses: uniqueValues.statuses,
      priorities: uniqueValues.priorities,
    });
  }, [uniqueValues, onFilterOptionsChange]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch('/api/users');
        if (!response.ok) return;
        const data = await response.json();
        if (!active) return;
        const map: Record<string, UserProfile> = {};
        for (const user of Array.isArray(data) ? data : []) {
          if (user.email) {
            map[user.email.toLowerCase()] = {
              email: user.email.toLowerCase(),
              name: user.name,
              profilePic: user.profilePic,
            };
          }
        }
        setUserProfiles(map);
      } catch (error) {
        console.error('Failed loading user profiles', error);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /* ----- загрузка задач и роли пользователя ----- */
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/tasks');
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || 'Failed to fetch tasks');
          return;
        }


        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    void fetchTasks();

  }, [refreshToken]);

  /* ----- применение фильтров ----- */
  const managerFilter = filters.manager;
  const statusFilter = filters.status;
  const priorityFilter = filters.priority;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedProject = projectFilter.trim().toLowerCase();

  useEffect(() => {
    let filtered = [...tasks];

    if (managerFilter) {
      filtered = filtered.filter((t) => getAuthorIdentifier(t) === managerFilter);
    }
    if (statusFilter) {
      filtered = filtered.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter) {
      filtered = filtered.filter((t) => t.priority === priorityFilter);
    }
    if (normalizedProject) {
      filtered = filtered.filter(
        (t) => (t.projectKey || '').toLowerCase() === normalizedProject
      );
    }

    if (normalizedSearch) {
      filtered = filtered.filter((t) => {
        const haystack = [
          t.taskId,
          t.taskName,
          t.bsNumber,
          t.projectKey,
          t.projectName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    setFilteredTasks(filtered);
    setCurrentPage(1);
  }, [
    tasks,
    managerFilter,
    statusFilter,
    priorityFilter,
    normalizedSearch,
    normalizedProject,
  ]);

  /* ----- popover helpers ----- */
  const handleColumnVisibilityChange =
    (col: ColumnKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setColumnVisibility((prev) => ({ ...prev, [col]: e.target.checked }));

  const openColumns = useCallback((anchor: HTMLElement) => {
    if (anchor) {
      setColumnsAnchorEl(anchor);
    }
  }, []);

  const closeColumns = useCallback(() => {
    setColumnsAnchorEl(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      openColumns,
      closeColumns,
    }),
    [openColumns, closeColumns]
  );

  /* ----- loading / error UI ----- */
  if (loading)
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, p: 5 }}>
          <CircularProgress />
        </Box>
    );
  if (error) return <Alert severity='error'>{error}</Alert>;
  return (
    <Box sx={{ width: '100%', margin: '0 auto' }}>
      {!hideToolbarControls && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
          <Tooltip title='Настроить колонки'>
            <IconButton onClick={(e) => openColumns(e.currentTarget)}>
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <TableContainer
        component={Box}
        sx={{
          backgroundColor: tableBg,
          borderRadius: 3,
          border: `1px solid ${cellBorder}`,
          boxShadow: containerShadow,
          overflow: 'hidden',
        }}
      >
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: headBg }}>
                {columnVisibility.taskId && (
                    <TableCell
                        sx={{
                          whiteSpace: 'nowrap',
                          padding: '16px',
                          textAlign: 'center',
                          borderColor: cellBorder,
                        }}
                    >
                      <strong>ID</strong>
                    </TableCell>
                )}


                {columnVisibility.task && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                      borderColor: cellBorder,
                    }}
                  >
                    <strong>{COLUMN_LABELS.task}</strong>
                  </TableCell>
                )}

                {columnVisibility.project && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                      borderColor: cellBorder,
                    }}
                  >
                    <strong>Проект</strong>
                  </TableCell>
                )}

                {columnVisibility.author && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                      borderColor: cellBorder,
                    }}
                  >
                    <strong>{COLUMN_LABELS.author}</strong>
                  </TableCell>
                )}

                {columnVisibility.created && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                      borderColor: cellBorder,
                    }}
                  >
                    <strong>{COLUMN_LABELS.created}</strong>
                  </TableCell>
                )}

                {columnVisibility.due && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                      borderColor: cellBorder,
                    }}
                  >
                    <strong>{COLUMN_LABELS.due}</strong>
                  </TableCell>
                )}

                {columnVisibility.complete && (
                    <TableCell
                        sx={{ whiteSpace: 'nowrap', padding: '16px', textAlign: 'center', borderColor: cellBorder }}
                    >
                      <strong>{COLUMN_LABELS.complete}</strong>
                    </TableCell>
                )}

                {columnVisibility.status && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                      borderColor: cellBorder,
                    }}
                  >
                    <strong>{COLUMN_LABELS.status}</strong>
                  </TableCell>
                )}

                {columnVisibility.priority && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                      borderColor: cellBorder,
                    }}
                  >
                    <strong>{COLUMN_LABELS.priority}</strong>
                  </TableCell>
                )}
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedTasks.map((task) => {
                const emailKey = (task.authorEmail || '').trim().toLowerCase();
                return (
                  <Row
                    key={task.taskId}
                    task={task}
                    columnVisibility={columnVisibility}
                    authorProfile={emailKey ? userProfiles[emailKey] : undefined}
                  />
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Селект для выбора количества строк */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <FormControl sx={{ minWidth: 120 }} size='small'>
            <InputLabel id='rows-per-page-label'>
              Записей на странице
            </InputLabel>
            <Select
              labelId='rows-per-page-label'
              id='rows-per-page'
              value={rowsPerPage}
              onChange={(e) => {
                const value = Number(e.target.value);
                setRowsPerPage(value);
                setCurrentPage(1);
              }}
              label='Записей на странице'
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value={-1}>Все</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Пагинация */}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(_e, page) => setCurrentPage(page)}
            color='primary'
            showFirstButton
            showLastButton
          />
        </Box>

      <Popover
        open={Boolean(columnsAnchorEl)}
        anchorEl={columnsAnchorEl}
        onClose={closeColumns}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              overflow: 'visible',
              backgroundColor: popoverBg,
              borderRadius: 2,
              border: `1px solid ${cellBorder}`,
              boxShadow: containerShadow,
            },
          },
        }}
      >
        <Box
          sx={{
            p: 2,
            minWidth: 220,
          }}
        >
          <List>
            {COLUMN_KEYS.map((column) => (
              <ListItem key={column} dense component='button'>
                <ListItemIcon>
                  <Checkbox
                    edge='start'
                    checked={columnVisibility[column]}
                    onChange={handleColumnVisibilityChange(column)}
                    tabIndex={-1}
                    disableRipple
                  />
                </ListItemIcon>
                <ListItemText primary={COLUMN_LABELS[column]} />
              </ListItem>
            ))}
          </List>
          <Box
            sx={{
              mt: 2,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <Button
              onClick={() =>
                setColumnVisibility(
                  COLUMN_KEYS.reduce(
                    (acc, key) => ({ ...acc, [key]: true }),
                    {} as Record<ColumnKey, boolean>
                  )
                )
              }
            >
              Все
            </Button>
            <Button
              onClick={() =>
                setColumnVisibility(
                  COLUMN_KEYS.reduce(
                    (acc, key) => ({ ...acc, [key]: false }),
                    {} as Record<ColumnKey, boolean>
                  )
                )
              }
            >
              Очистить
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
});

export default TaskListPage;
