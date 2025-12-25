'use client';

import React from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import FolderIcon from '@mui/icons-material/Folder';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { BaseStatus, ReportClient, ApiResponse } from '@/app/types/reportTypes';
import { getStatusColor } from '@/utils/statusColors';

const getTaskStatus = (baseStatuses: BaseStatus[] = []) => {
  const nonAgreedStatus = baseStatuses.find((bs) => bs.status !== 'Agreed');
  return nonAgreedStatus ? nonAgreedStatus.status : 'Agreed';
};

const resolveStatusColor = (status: string) => {
  const color = getStatusColor(status);
  return color === 'default' ? undefined : color;
};

export default function ReportListPage() {
  const [reports, setReports] = React.useState<ReportClient[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ReportClient | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const searchParams = useSearchParams();
  const reportRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTaskId = React.useMemo(() => {
    const raw = searchParams?.get('highlightTaskId') ?? '';
    return raw ? raw.trim().toLowerCase() : '';
  }, [searchParams]);
  const highlightActive = Boolean(highlightTaskId);

  React.useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('/api/reports');
        const data: ApiResponse = await response.json();
        if (!response.ok) {
          setError(data.error || 'Не удалось загрузить фотоотчеты');
          return;
        }
        setReports(Array.isArray(data.reports) ? data.reports : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить фотоотчеты');
      } finally {
        setLoading(false);
      }
    };
    void fetchReports();
  }, []);

  React.useEffect(() => {
    if (!highlightActive || loading) return;
    const target = reportRefs.current[highlightTaskId];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightActive, highlightTaskId, loading, reports]);

  const filtered = reports.filter((report) => {
    const status = getTaskStatus(report.baseStatuses);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const label = [report.taskName, report.taskId, report.bsNumber]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = label.includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleOpenDeleteDialog = (report: ReportClient) => {
    setDeleteTarget(report);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (deleteLoading) return;
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const deletions = deleteTarget.baseStatuses.map((base) =>
        fetch(
          `/api/reports/${encodeURIComponent(deleteTarget.taskId)}/${encodeURIComponent(base.baseId)}`,
          { method: 'DELETE' }
        ).then(async (response) => {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          if (!response.ok) {
            throw new Error(data.error || 'Не удалось удалить отчёт');
          }
        })
      );
      await Promise.all(deletions);
      setReports((prev) => prev.filter((report) => report.taskId !== deleteTarget.taskId));
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить отчёт');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" mt={6}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        px: { xs: 2, md: 6 },
        py: { xs: 3, md: 6 },
        background: 'linear-gradient(180deg, #f7f8fb 0%, #ffffff 100%)',
        minHeight: '100vh',
        position: 'relative',
      }}
    >
      {highlightActive && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15,23,42,0.35)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      )}
      <Stack spacing={2} sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          Фотоотчеты
        </Typography>
        <Typography color="text.secondary">
          Просматривайте отчеты по задачам и согласовывайте результаты работ.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Поиск по задаче"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            size="small"
            sx={{ maxWidth: 320 }}
          />
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            size="small"
            sx={{ maxWidth: 220 }}
          >
            <MenuItem value="all">Все статусы</MenuItem>
            <MenuItem value="Pending">На проверке</MenuItem>
            <MenuItem value="Issues">Есть замечания</MenuItem>
            <MenuItem value="Fixed">Исправлено</MenuItem>
            <MenuItem value="Agreed">Согласовано</MenuItem>
          </Select>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        {filtered.length === 0 && (
          <Typography color="text.secondary">Нет отчетов по выбранным фильтрам.</Typography>
        )}
        {filtered.map((report) => {
          const status = getTaskStatus(report.baseStatuses);
          const title = report.taskName || report.taskId;
          const titleWithBs = report.bsNumber ? `${title} ${report.bsNumber}` : title;
          const statusColor = getStatusColor(status);
          const statusChipSx =
            statusColor === 'default'
              ? { fontWeight: 600 }
              : { backgroundColor: statusColor, color: '#fff', fontWeight: 600 };
          const reportKey = report.taskId.trim().toLowerCase();
          const isHighlighted = highlightActive && reportKey === highlightTaskId;
          return (
            <Box
              key={report.taskId}
              ref={(node) => {
                reportRefs.current[reportKey] = node;
              }}
              sx={{
                position: 'relative',
                zIndex: isHighlighted ? 2 : 0,
                borderRadius: 4,
                p: 3,
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'rgba(255,255,255,0.92)',
                boxShadow: isHighlighted
                  ? '0 0 0 3px rgba(56, 189, 248, 0.9), 0 30px 70px rgba(15,23,42,0.25)'
                  : '0 24px 60px rgba(15,23,42,0.08)',
              }}
            >
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      {titleWithBs}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Задача {report.taskId} · {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '—'}
                    </Typography>
                    {(report.executorName || report.createdByName) && (
                      <Typography variant="body2" color="text.secondary">
                        Исполнитель: {report.executorName || report.createdByName}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip label={status} size="small" sx={statusChipSx} />
                    {report.canDelete && (
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDeleteDialog(report)}
                        aria-label="Удалить отчет"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {report.baseStatuses.map((base) => (
                    <Chip
                      key={`${report.taskId}-${base.baseId}`}
                      icon={<FolderIcon sx={{ color: resolveStatusColor(base.status) }} />}
                      label={`БС ${base.baseId}`}
                      component={Link}
                      href={`/reports/${report.taskId}/${base.baseId}`}
                      clickable
                      sx={{
                        borderRadius: 999,
                        px: 1,
                        backgroundColor: 'rgba(15,23,42,0.04)',
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Удалить фотоотчёт?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Отчёт и все файлы в хранилище будут удалены без возможности восстановления.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleteLoading}>
            Отмена
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDelete}
            disabled={deleteLoading}
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
