// app/components/ReportListPage.tsx

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Collapse,
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
  TextField,
  InputLabel,
  FormControl,
  Button,
  Popover,
  Tooltip,
  Link,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Alert,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { BaseStatus, ReportClient, ApiResponse } from '../types/reportTypes';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { SingleInputDateRangeField } from '@mui/x-date-pickers-pro/SingleInputDateRangeField';
import { DateRange } from '@mui/x-date-pickers-pro/models';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import Pagination from '@mui/material/Pagination';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel } from '@/utils/statusLabels';

// Цвет иконки папки в зависимости от статуса
const getFolderColor = (status: string) => {
  switch (status) {
    case 'Agreed':
      return '#28a745'; // Green
    case 'Pending':
    case 'Fixed':
      return '#ffc107'; // Yellow
    case 'Issues':
      return '#dc3545'; // Red
    default:
      return '#787878'; // Gray
  }
};

// Общий статус задачи (если хотя бы один baseId не Agreed, то считаем общий статус тем же)
const getTaskStatus = (baseStatuses: BaseStatus[] = []) => {
  const nonAgreedStatus = baseStatuses.find((bs) => bs.status !== 'Agreed');
  return nonAgreedStatus ? nonAgreedStatus.status : 'Agreed';
};

// Определяем количество колонок для colspan в раскрывающейся строке
function getColSpanByRole(role: string) {
  if (role === 'admin') return 7;
  return 5; // executor/initiator
}

// === Компонент строки (одной задачи) ===
function Row({
  report,
  role,
  canDelete,
  onDeleteReport,
}: {
  report: ReportClient;
  role: string;
  canDelete: boolean;
  onDeleteReport: (task: string, baseId: string, reportId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setOpen(!open);
  };

  const getReportDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime())
      ? date.toLocaleDateString()
      : 'The date is unavailable';
  };

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        {/* Стрелка-иконка для раскрытия */}
        <TableCell
          sx={{
            padding: '4px',
          }}
        >
          <IconButton
            aria-label='expand row'
            size='small'
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>

        <TableCell
          align='center'
          sx={{
            padding: '8px',
            textAlign: 'center',
          }}
        >
          <Link
            href={`/tasks/${report.reportId.toLowerCase()}`}
            // onClick={handleLinkClick}
            underline='always'
            color='primary'
            sx={{ cursor: 'pointer' }}
          >
            <Typography variant='body2'>{report.reportId}</Typography>
          </Link>
        </TableCell>

        {/* Task */}
        <TableCell
          sx={{
            padding: '4px',
            textAlign: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderIcon
              fontSize='small'
              sx={{ color: getFolderColor(getTaskStatus(report.baseStatuses)) }}
            />
            <Typography variant='body2' sx={{ textAlign: 'left' }}>
              <Link
                href='#'
                onClick={handleLinkClick}
                underline='always'
                color='primary'
                sx={{ cursor: 'pointer' }}
              >
                {report.task}
              </Link>
            </Typography>
          </Box>
        </TableCell>

        {/* Если role=initiator => показываем столбец "Executor" */}
        {role === 'initiator' && (
          <TableCell
            align='center'
            sx={{
              padding: '8px',
              textAlign: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Typography variant='subtitle2'>{report.executorName}</Typography>
            </Box>
          </TableCell>
        )}

        {/* Если role=executor => показываем столбец "initiator" */}
        {role === 'executor' && (
          <TableCell
            align='center'
            sx={{
              padding: '8px',
              textAlign: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Typography sx={{ fontSize: '0.9rem' }}>
                {report.initiatorName}
              </Typography>
            </Box>
          </TableCell>
        )}

        {/* Если role=admin => показываем executor + initiator */}
        {role === 'admin' && (
          <>
            <TableCell
              align='center'
              sx={{
                padding: '8px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Typography sx={{ fontSize: '0.9rem' }}>
                  {report.executorName}
                </Typography>
              </Box>
            </TableCell>
            <TableCell
              align='center'
              sx={{
                padding: '8px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Typography sx={{ fontSize: '0.9rem' }}>
                  {report.initiatorName}
                </Typography>
              </Box>
            </TableCell>
          </>
        )}

        {/* Created */}
        <TableCell
          align='center'
          sx={{
            padding: '8px',
            textAlign: 'center',
          }}
        >
          {getReportDate(report.createdAt)}
        </TableCell>

        {/* Status */}
        <TableCell
          align='center'
          sx={{
            padding: '8px',
          }}
        >
          <Box
            sx={{
              backgroundColor: getStatusColor(
                getTaskStatus(report.baseStatuses)
              ),
              padding: '4px 8px',
              display: 'inline-block',
              color: '#fff', // Белый текст для лучшей читаемости
            }}
          >
            {report.baseStatuses
              .map((bs) => bs.status)
              .filter((value, index, self) => self.indexOf(value) === index)
              .map((status) => getStatusLabel(status))
              .join(' | ')}
          </Box>
        </TableCell>
      </TableRow>

      {/* Доп. информация (раскрывающаяся строка) */}
      <TableRow>
        <TableCell
          style={{ paddingBottom: 0, paddingTop: 0 }}
          colSpan={getColSpanByRole(role)}
        >
          <Collapse in={open} timeout='auto' unmountOnExit>
            <Box sx={{ margin: 1, paddingLeft: 7 }}>
              {report.baseStatuses.map((baseStatus: BaseStatus) => (
                <Box
                  key={baseStatus.baseId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <FolderIcon
                    fontSize='small'
                    sx={{
                      marginRight: '8px',
                      color: getFolderColor(baseStatus.status),
                    }}
                  />
                  <Typography variant='body2' sx={{ marginRight: '16px' }}>
                    <Link
                      href={`/reports/${report.task}/${baseStatus.baseId}`}
                      underline='always'
                      color='textSecondary'
                    >
                      {baseStatus.baseId}
                    </Link>
                    <Typography
                      component='span'
                      variant='caption'
                      sx={{
                        marginLeft: '8px',
                        color: '#787878',
                      }}
                    >
                      Статус изменён:{' '}
                      {getReportDate(baseStatus.latestStatusChangeDate)}
                    </Typography>
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      marginLeft: 'auto',
                    }}
                  >
                    <Box
                      sx={{
                        backgroundColor: getStatusColor(baseStatus.status),
                        padding: '4px 8px',
                        display: 'inline-block',
                        color: '#fff', // Белый текст для лучшей читаемости
                      }}
                    >
                      {getStatusLabel(baseStatus.status)}
                    </Box>
                    {canDelete && (
                      <Tooltip title='Delete report'>
                        <IconButton
                          size='small'
                          color='error'
                          onClick={() =>
                            onDeleteReport(
                              report.task,
                              baseStatus.baseId,
                              report.reportId
                            )
                          }
                        >
                          <DeleteForeverIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function ReportListPage() {
  const [role, setRole] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [reports, setReports] = useState<ReportClient[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    task: string;
    baseId: string;
    reportId: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'success' });

  // Пагинация
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Фильтры:
  const [executorFilter, setExecutorFilter] = useState('');
  const [initiatorFilter, setInitiatorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [createdDateRange, setCreatedDateRange] = useState<DateRange<Date>>([
    null,
    null,
  ]);

  // Popover:
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('');

  // Расчет данных для пагинации
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredReports.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, filteredReports]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredReports.length / itemsPerPage);
  }, [filteredReports]);

  // Количество активных фильтров
  const activeFiltersCount = useMemo(() => {
    return [
      executorFilter,
      initiatorFilter,
      statusFilter,
      taskSearch,
      createdDateRange[0] || createdDateRange[1] ? createdDateRange : null,
    ].filter(Boolean).length;
  }, [
    executorFilter,
    initiatorFilter,
    statusFilter,
    taskSearch,
    createdDateRange,
  ]);

  // Получаем уникальных авторов
  const uniqueExecutors = useMemo(() => {
    const executors = reports.map((report) => report.executorName);
    // console.log('Executors:', executors);
    return Array.from(new Set(executors));
  }, [reports]);

  // Получаем уникальных ревьюеров
  const uniqueInitiators = useMemo(() => {
    const initiators = reports.map((report) => report.initiatorName);
    return Array.from(new Set(initiators));
  }, [reports]);

  // Получаем уникальные статусы
  const uniqueStatuses = useMemo(() => {
    const statuses = reports.flatMap((report) =>
      report.baseStatuses.map((bs) => bs.status)
    );
    return Array.from(new Set(statuses));
  }, [reports]);

  // Загружаем данные
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('/api/reports');
        const data: ApiResponse = await response.json();

        if (!response.ok) {
          const errorMessage = data.error || 'Unknown error';
          setError(errorMessage);
          setLoading(false);
          return;
        }
        if (!Array.isArray(data.reports)) {
          setError('Invalid data format');
          setLoading(false);
          return;
        }
        // console.log('Reports:', data.reports);
        // Устанавливаем роль (executor, initiator, admin и т.д.)
        if (data.userRole) {
          setRole(data.userRole);
        }
        setIsSuperAdmin(Boolean(data.isSuperAdmin));

        // Преобразуем даты в ISO
        const mappedReports = data.reports.map((report: ReportClient) => ({
          ...report,
          baseStatuses: report.baseStatuses.map((bs: BaseStatus) => ({
            ...bs,
            latestStatusChangeDate: new Date(
              bs.latestStatusChangeDate
            ).toISOString(),
          })),
        }));

        setReports(mappedReports);
        setLoading(false);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error fetching reports:', error);
          setError(error.message || 'Unknown error');
        } else {
          console.error('Error fetching reports:', error);
          setError('Unknown error');
        }
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  // Фильтруем отчёты
  useEffect(() => {
    let tempReports = [...reports];

    // Filter by executor
    if (executorFilter) {
      tempReports = tempReports.filter(
        (report) => report.executorName === executorFilter
      );
    }

    // Filter by initiator
    if (initiatorFilter) {
      tempReports = tempReports.filter(
        (report) => report.initiatorName === initiatorFilter
      );
    }

    // Filter by status
    if (statusFilter) {
      tempReports = tempReports.filter((report) =>
        report.baseStatuses.some((bs) => bs.status === statusFilter)
      );
    }

    // Filter by creation date range
    if (createdDateRange[0] && createdDateRange[1]) {
      tempReports = tempReports.filter((report) => {
        const reportDate = new Date(report.createdAt);
        return (
          reportDate >= createdDateRange[0]! &&
          reportDate <= createdDateRange[1]!
        );
      });
    }

    // Search by tasks
    if (taskSearch) {
      tempReports = tempReports.filter((report) =>
        report.task.toLowerCase().includes(taskSearch.toLowerCase())
      );
    }

    setFilteredReports(tempReports);
    setCurrentPage(1);
  }, [
    reports,
    executorFilter,
    initiatorFilter,
    statusFilter,
    createdDateRange,
    taskSearch,
  ]);

  // Popover handlers
  const handleFilterClick = (
    event: React.MouseEvent<HTMLElement>,
    filterType: string
  ) => {
    setAnchorEl(event.currentTarget);
    setCurrentFilter(filterType);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setCurrentFilter('');
  };

  const openPopover = Boolean(anchorEl);
  const popoverId = openPopover ? 'filter-popover' : undefined;

  const handleDeleteRequest = (task: string, baseId: string, reportId: string) => {
    setDeleteTarget({ task, baseId, reportId });
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  const handleNotificationClose = (
    event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === 'clickaway') return;
    setNotification((prev) => ({ ...prev, open: false }));
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(deleteTarget.task)}/${encodeURIComponent(
          deleteTarget.baseId
        )}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setNotification({
          open: true,
          message: data.error || 'Failed to delete report.',
          severity: 'error',
        });
        return;
      }

      setReports((prev) =>
        prev
          .map((report) => {
            if (report.reportId !== deleteTarget.reportId) return report;
            const nextBaseStatuses = report.baseStatuses.filter(
              (status) => status.baseId !== deleteTarget.baseId
            );
            return { ...report, baseStatuses: nextBaseStatuses };
          })
          .filter((report) => report.baseStatuses.length > 0)
      );

      setNotification({
        open: true,
        message: 'Report deleted successfully.',
        severity: 'success',
      });
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error('Error deleting report:', deleteError);
      setNotification({
        open: true,
        message:
          deleteError instanceof Error
            ? deleteError.message
            : 'Failed to delete report.',
        severity: 'error',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color='error' align='center' sx={{ marginTop: '20px' }}>
        {error}
      </Typography>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        sx={{
          width: '100%',
        }}
      >
        <Snackbar
          open={notification.open}
          autoHideDuration={3000}
          onClose={handleNotificationClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            onClose={handleNotificationClose}
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>

        {/* Блок "Active filters" */}
        {activeFiltersCount > 0 && (
          <Box sx={{ padding: 2, marginBottom: 2 }}>
            <Typography variant='subtitle1' sx={{ mb: 1 }}>
              Active filters
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {executorFilter && (
                <Chip
                  label={`Executor: ${executorFilter}`}
                  onDelete={() => setExecutorFilter('')}
                  color='primary'
                  size='small'
                />
              )}
              {initiatorFilter && (
                <Chip
                  label={`Initiator: ${initiatorFilter}`}
                  onDelete={() => setInitiatorFilter('')}
                  color='primary'
                  size='small'
                />
              )}
              {statusFilter && (
                <Chip
                  label={`Статус: ${getStatusLabel(statusFilter)}`}
                  onDelete={() => setStatusFilter('')}
                  color='primary'
                  size='small'
                />
              )}
              {taskSearch && (
                <Chip
                  label={`Task: ${taskSearch}`}
                  onDelete={() => setTaskSearch('')}
                  color='primary'
                  size='small'
                />
              )}
              {createdDateRange[0] && createdDateRange[1] && (
                <Chip
                  label={`Created: ${createdDateRange[0].toLocaleDateString()} - ${createdDateRange[1].toLocaleDateString()}`}
                  onDelete={() => setCreatedDateRange([null, null])}
                  color='primary'
                  size='small'
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Button
                onClick={() => {
                  setExecutorFilter('');
                  setInitiatorFilter('');
                  setStatusFilter('');
                  setTaskSearch('');
                  setCreatedDateRange([null, null]);
                }}
              >
                Delete All
              </Button>
            </Box>
          </Box>
        )}

        {/* Таблица */}
        <TableContainer component={Box}>
          <Table aria-label='collapsible table'>
            <TableHead>
              <TableRow>
                {/* 1) Пустая ячейка (стрелка) */}
                <TableCell />

                {/* 2) ID */}
                <TableCell
                  align='center'
                  sx={{
                    whiteSpace: 'nowrap',
                    padding: '16px',
                  }}
                >
                  <strong>Task</strong>
                </TableCell>

                {/* 3) Task */}
                <TableCell
                  align='center'
                  sx={{
                    whiteSpace: 'nowrap',
                    padding: '16px',
                  }}
                >
                  <strong>Report</strong>
                  <Tooltip title='Report Find'>
                    <IconButton
                      size='small'
                      onClick={(event) => handleFilterClick(event, 'task')}
                      color={taskSearch ? 'primary' : 'default'}
                      aria-label='Report filter'
                      aria-controls={
                        openPopover && currentFilter === 'task'
                          ? 'filter-popover'
                          : undefined
                      }
                      aria-haspopup='true'
                      sx={{ mr: 1 }}
                    >
                      <SearchIcon fontSize='medium' />
                    </IconButton>
                  </Tooltip>
                </TableCell>

                {/* Если initiator → столбец executor */}
                {role === 'initiator' && (
                  <TableCell
                    align='center'
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                    }}
                  >
                    <strong>Executor</strong>
                    <Tooltip title='Executor filter'>
                      <IconButton
                        size='small'
                        onClick={(event) =>
                          handleFilterClick(event, 'executor')
                        }
                        color={executorFilter ? 'primary' : 'default'}
                        aria-label='Executor filter'
                        aria-controls={
                          openPopover && currentFilter === 'executor'
                            ? 'filter-popover'
                            : undefined
                        }
                        aria-haspopup='true'
                      >
                        <FilterListIcon fontSize='small' />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}

                {/* Если executor → столбец initiator */}
                {role === 'executor' && (
                  <TableCell
                    align='center'
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                    }}
                  >
                    <strong>Initiator</strong>
                    {/* Иконка для фильтра initiator */}
                    <Tooltip title='initiator filter'>
                      <IconButton
                        size='small'
                        onClick={(event) =>
                          handleFilterClick(event, 'initiator')
                        }
                        color={initiatorFilter ? 'primary' : 'default'}
                        aria-label='initiator filter'
                        aria-controls={
                          openPopover && currentFilter === 'initiator'
                            ? 'filter-popover'
                            : undefined
                        }
                        aria-haspopup='true'
                      >
                        <FilterListIcon fontSize='small' />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}

                {/* Если admin → столбцы executor + initiator */}
                {role === 'admin' && (
                  <>
                    <TableCell
                      align='center'
                      sx={{
                        whiteSpace: 'nowrap',
                        padding: '16px',
                      }}
                    >
                      <strong>Executor</strong>
                      <Tooltip title='Executor filter'>
                        <IconButton
                          size='small'
                          onClick={(event) =>
                            handleFilterClick(event, 'executor')
                          }
                          color={executorFilter ? 'primary' : 'default'}
                          aria-label='Executor filter'
                          aria-controls={
                            openPopover && currentFilter === 'executor'
                              ? 'filter-popover'
                              : undefined
                          }
                          aria-haspopup='true'
                        >
                          <FilterListIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      align='center'
                      sx={{
                        whiteSpace: 'nowrap',
                        padding: '16px',
                      }}
                    >
                      <strong>Initiator</strong>
                      <Tooltip title='initiator filter'>
                        <IconButton
                          size='small'
                          onClick={(event) =>
                            handleFilterClick(event, 'initiator')
                          }
                          color={initiatorFilter ? 'primary' : 'default'}
                          aria-label='initiator filter'
                          aria-controls={
                            openPopover && currentFilter === 'initiator'
                              ? 'filter-popover'
                              : undefined
                          }
                          aria-haspopup='true'
                        >
                          <FilterListIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </>
                )}

                {/* Created */}
                <TableCell
                  align='center'
                  sx={{
                    whiteSpace: 'nowrap',
                    padding: '16px',
                  }}
                >
                  <strong>Created</strong>
                  <Tooltip title='Filter by creation date'>
                    <IconButton
                      size='small'
                      onClick={(event) => handleFilterClick(event, 'createdAt')}
                      color={
                        createdDateRange[0] || createdDateRange[1]
                          ? 'primary'
                          : 'default'
                      }
                      aria-label='Filter by creation date'
                      aria-controls={
                        openPopover && currentFilter === 'createdAt'
                          ? 'filter-popover'
                          : undefined
                      }
                      aria-haspopup='true'
                    >
                      <FilterListIcon fontSize='small' />
                    </IconButton>
                  </Tooltip>
                </TableCell>

                {/* Status */}
                <TableCell
                  align='center'
                  sx={{
                    whiteSpace: 'nowrap',
                    padding: '16px',
                  }}
                >
                  <strong>Status</strong>
                  <Tooltip title='Filter by Status'>
                    <IconButton
                      size='small'
                      onClick={(event) => handleFilterClick(event, 'status')}
                      color={statusFilter ? 'primary' : 'default'}
                      aria-label='Filter by Status'
                      aria-controls={
                        openPopover && currentFilter === 'status'
                          ? 'filter-popover'
                          : undefined
                      }
                      aria-haspopup='true'
                    >
                      <FilterListIcon fontSize='small' />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedReports.length > 0 ? (
                paginatedReports.map((report: ReportClient) => (
                  <Row
                    key={report.reportId}
                    report={report}
                    role={role}
                    canDelete={isSuperAdmin}
                    onDeleteReport={handleDeleteRequest}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={getColSpanByRole(role)} align='center'>
                    There are no reports that meet the specified conditions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Пагинация */}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(event, page) => setCurrentPage(page)}
            color='primary'
            showFirstButton
            showLastButton
          />
        </Box>

        {/* Popover для фильтров */}
        <Popover
          id={popoverId}
          open={openPopover}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <Box sx={{ p: 1.5, minWidth: 200, boxShadow: 3, borderRadius: 1 }}>
            {currentFilter === 'task' && (
              <TextField
                label='Search by Tasks'
                variant='outlined'
                size='small'
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                fullWidth
                autoFocus
                sx={{
                  '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                  '& .MuiInputBase-input': { fontSize: '0.75rem' },
                }}
              />
            )}

            {currentFilter === 'executor' && (
              <FormControl fullWidth variant='outlined' size='small'>
                <InputLabel
                  id='executor-filter-label'
                  sx={{ fontSize: '0.75rem' }}
                >
                  Executor
                </InputLabel>
                <Select
                  labelId='executor-filter-label'
                  value={executorFilter}
                  label='Executor'
                  onChange={(e) => setExecutorFilter(e.target.value)}
                  autoFocus
                  sx={{
                    '& .MuiSelect-select': { fontSize: '0.75rem' },
                    '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                  }}
                >
                  <MenuItem value=''>
                    <em>All</em>
                  </MenuItem>
                  {uniqueExecutors.map((executor) => (
                    <MenuItem key={uuidv4()} value={executor}>
                      {executor}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'initiator' && (
              <FormControl fullWidth variant='outlined' size='small'>
                <InputLabel
                  id='initiator-filter-label'
                  sx={{ fontSize: '0.75rem' }}
                >
                  Initiator
                </InputLabel>
                <Select
                  labelId='initiator-filter-label'
                  value={initiatorFilter}
                  label='Initiator'
                  onChange={(e) => setInitiatorFilter(e.target.value)}
                  autoFocus
                  sx={{
                    '& .MuiSelect-select': { fontSize: '0.75rem' },
                    '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                  }}
                >
                  <MenuItem value=''>
                    <em>All</em>
                  </MenuItem>
                  {uniqueInitiators.map((initiator) => (
                    <MenuItem key={initiator} value={initiator}>
                      {initiator}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'status' && (
              <FormControl fullWidth variant='outlined' size='small'>
                <InputLabel
                  id='status-filter-label'
                  sx={{ fontSize: '0.75rem' }}
                >
                  Статус
                </InputLabel>
                <Select
                  labelId='status-filter-label'
                  value={statusFilter}
                  label='Статус'
                  onChange={(e) => setStatusFilter(e.target.value)}
                  autoFocus
                  sx={{
                    '& .MuiSelect-select': { fontSize: '0.75rem' },
                    '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                  }}
                >
                  <MenuItem value=''>
                    <em>Все</em>
                  </MenuItem>
                  {uniqueStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {getStatusLabel(status)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'createdAt' && (
              <DateRangePicker
                value={createdDateRange}
                onChange={(newValue) => setCreatedDateRange(newValue)}
                slots={{ field: SingleInputDateRangeField }}
              />
            )}

            {/* Кнопки "Close" и "Delete" (сброс) */}
            <Box
              sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}
            >
              <Button
                variant='contained'
                size='small'
                onClick={handleClose}
                sx={{ fontSize: '0.8rem' }}
              >
                Close
              </Button>
              <Button
                variant='text'
                size='small'
                onClick={() => {
                  if (currentFilter === 'task') setTaskSearch('');
                  if (currentFilter === 'executor') setExecutorFilter('');
                  if (currentFilter === 'initiator') setInitiatorFilter('');
                  if (currentFilter === 'status') setStatusFilter('');
                  if (currentFilter === 'createdAt')
                    setCreatedDateRange([null, null]);
                }}
                sx={{ fontSize: '0.8rem' }}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Popover>

        <Dialog open={Boolean(deleteTarget)} onClose={handleDeleteCancel}>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete the photo report for{' '}
              {deleteTarget
                ? `${deleteTarget.task} | ${deleteTarget.baseId}`
                : ''}
              ?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} color='primary'>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color='error'
              disabled={deleteLoading}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
