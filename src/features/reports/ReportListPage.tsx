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
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
  Tooltip,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import NextLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import FolderIcon from '@mui/icons-material/Folder';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { BaseStatus, ReportClient, ApiResponse } from '@/app/types/reportTypes';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel, normalizeStatusTitle } from '@/utils/statusLabels';
import ProfileDialog from '@/features/profile/ProfileDialog';
import { useI18n } from '@/i18n/I18nProvider';

const getTaskStatus = (baseStatuses: BaseStatus[] = []) => {
  const nonAgreedStatus = baseStatuses.find(
    (bs) => normalizeStatusTitle(bs.status) !== 'Agreed'
  );
  return nonAgreedStatus ? normalizeStatusTitle(nonAgreedStatus.status) : 'Agreed';
};

const resolveStatusColor = (status: string) => {
  const color = getStatusColor(normalizeStatusTitle(status));
  return color === 'default' ? undefined : color;
};

export default function ReportListPage() {
  const { t } = useI18n();
  const [reports, setReports] = React.useState<ReportClient[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ReportClient | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [downloadingTaskId, setDownloadingTaskId] = React.useState<string | null>(null);
  const [profileUserId, setProfileUserId] = React.useState<string | null>(null);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const searchParams = useSearchParams();
  const token = searchParams?.get('token')?.trim() || '';
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  const reportRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTaskId = React.useMemo(() => {
    const raw = searchParams?.get('highlightTaskId') ?? '';
    return raw ? raw.trim().toLowerCase() : '';
  }, [searchParams]);
  const highlightActive = Boolean(highlightTaskId);
  const isGuest = Boolean(token);

  React.useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch(
          token ? `/api/reports?token=${encodeURIComponent(token)}` : '/api/reports'
        );
        const data: ApiResponse = await response.json();
        if (!response.ok) {
          setError(data.error || t('reports.list.error.load', 'Не удалось загрузить фотоотчеты'));
          return;
        }
        setReports(Array.isArray(data.reports) ? data.reports : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('reports.list.error.load', 'Не удалось загрузить фотоотчеты'));
      } finally {
        setLoading(false);
      }
    };
    void fetchReports();
  }, [token, t]);

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
    if (isGuest) return;
    setDeleteTarget(report);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (deleteLoading) return;
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const openProfileDialog = (clerkUserId?: string | null) => {
    if (!clerkUserId) return;
    setProfileUserId(clerkUserId);
    setProfileOpen(true);
  };

  const closeProfileDialog = () => {
    setProfileOpen(false);
    setProfileUserId(null);
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
            throw new Error(data.error || t('reports.list.error.delete', 'Не удалось удалить отчёт'));
          }
        })
      );
      await Promise.all(deletions);
      setReports((prev) => prev.filter((report) => report.taskId !== deleteTarget.taskId));
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reports.list.error.delete', 'Не удалось удалить отчёт'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDownloadTaskReports = async (taskId: string) => {
    if (downloadingTaskId) return;
    setDownloadingTaskId(taskId);
    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(taskId)}/download${tokenParam}`
      );
      if (!response.ok) {
        setError(t('reports.error.download', 'Не удалось скачать отчет'));
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reports-${taskId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reports.error.download', 'Не удалось скачать отчет'));
    } finally {
      setDownloadingTaskId(null);
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
      sx={(theme: Theme) => ({
        px: { xs: 2, md: 6 },
        py: { xs: 3, md: 6 },
        background:
          theme.palette.mode === 'dark'
            ? 'linear-gradient(180deg, #0b0f16 0%, #0f141f 100%)'
            : 'linear-gradient(180deg, #f7f8fb 0%, #ffffff 100%)',
        minHeight: '100vh',
        position: 'relative',
      })}
    >
      {highlightActive && (
        <Box
          sx={(theme: Theme) => ({
            position: 'fixed',
            inset: 0,
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(6, 8, 14, 0.75)' : 'rgba(15,23,42,0.35)',
            zIndex: 1,
            pointerEvents: 'none',
          })}
        />
      )}
      <Stack spacing={2} sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          {t('reports.list.title', 'Фотоотчеты')}
        </Typography>
        <Typography color="text.secondary">
          {t('reports.list.subtitle', 'Просматривайте отчеты по задачам и согласовывайте результаты работ.')}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label={t('reports.list.search', 'Поиск по задаче')}
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
            <MenuItem value="all">{t('reports.list.filters.all', 'Все статусы')}</MenuItem>
            <MenuItem value="Pending">{t('reports.status.pending', 'На проверке')}</MenuItem>
            <MenuItem value="Issues">{t('reports.status.issues', 'Есть замечания')}</MenuItem>
            <MenuItem value="Fixed">{t('reports.status.fixed', 'Исправлено')}</MenuItem>
            <MenuItem value="Agreed">{t('reports.status.agreed', 'Согласовано')}</MenuItem>
          </Select>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        {filtered.length === 0 && (
          <Typography color="text.secondary">
            {t('reports.list.empty', 'Нет отчетов по выбранным фильтрам.')}
          </Typography>
        )}
        {filtered.map((report) => {
          const title = report.taskName || report.taskId;
          const titleWithBs = report.bsNumber ? `${title} ${report.bsNumber}` : title;
          const status = getTaskStatus(report.baseStatuses);
          const reportKey = report.taskId.trim().toLowerCase();
          const isHighlighted = highlightActive && reportKey === highlightTaskId;
          return (
            <Box
              key={report.taskId}
              ref={(node) => {
                reportRefs.current[reportKey] = node as HTMLDivElement | null;
              }}
              sx={(theme: Theme) => ({
                position: 'relative',
                zIndex: isHighlighted ? 2 : 0,
                borderRadius: 4,
                p: 3,
                border:
                  theme.palette.mode === 'dark'
                    ? '1px solid rgba(148,163,184,0.18)'
                    : '1px solid rgba(15,23,42,0.08)',
                background:
                  theme.palette.mode === 'dark' ? 'rgba(15,18,26,0.92)' : 'rgba(255,255,255,0.92)',
                boxShadow: isHighlighted
                  ? theme.palette.mode === 'dark'
                    ? '0 0 0 2px rgba(56, 189, 248, 0.7), 0 30px 70px rgba(0,0,0,0.65)'
                    : '0 0 0 3px rgba(56, 189, 248, 0.9), 0 30px 70px rgba(15,23,42,0.25)'
                  : theme.palette.mode === 'dark'
                    ? '0 24px 60px rgba(0,0,0,0.55)'
                    : '0 24px 60px rgba(15,23,42,0.08)',
              })}
            >
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      {titleWithBs}
                    </Typography>
                    {(report.projectKey || report.projectId) && (
                      <Typography variant="body2" color="text.secondary">
                        {t('reports.list.project', 'Проект: {project}', {
                          project: report.projectKey || report.projectId,
                        })}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {t('reports.header.task', 'Задача')}{' '}
                      {report.orgSlug && report.projectKey ? (
                        <Link
                          component={NextLink}
                          href={`/org/${encodeURIComponent(report.orgSlug)}/projects/${encodeURIComponent(
                            report.projectKey
                          )}/tasks/${encodeURIComponent(report.taskId)}`}
                          underline="hover"
                          color="inherit"
                        >
                          {report.taskId}
                        </Link>
                      ) : (
                        report.taskId
                      )}{' '}
                      · {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '—'}
                    </Typography>
                    {report.createdByName && (
                      <Typography variant="body2" color="text.secondary">
                        {t('reports.list.author', 'Автор:')}{' '}
                        {report.createdById ? (
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => openProfileDialog(report.createdById)}
                            sx={{ textTransform: 'none', px: 0, minWidth: 0 }}
                          >
                            {report.createdByName}
                          </Button>
                        ) : (
                          report.createdByName
                        )}
                      </Typography>
                    )}
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {status === 'Agreed' && (
                      <Tooltip title={t('reports.download', 'Скачать отчет')}>
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleDownloadTaskReports(report.taskId)}
                            aria-label={t('reports.download', 'Скачать отчет')}
                            disabled={downloadingTaskId === report.taskId}
                          >
                            <CloudDownloadIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    {!isGuest && report.canDelete && (
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDeleteDialog(report)}
                        aria-label={t('reports.list.deleteAction', 'Удалить отчет')}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
                  {report.baseStatuses.map((base) => {
                    const baseStatus = normalizeStatusTitle(base.status);
                    const baseStatusLabel = getStatusLabel(baseStatus);
                    const baseStatusColor = getStatusColor(baseStatus);
                    const baseStatusChipSx =
                      baseStatusColor === 'default'
                        ? {
                            fontWeight: 600,
                            backgroundColor: (theme: Theme) =>
                              theme.palette.mode === 'dark'
                                ? 'rgba(148,163,184,0.2)'
                                : 'rgba(15,23,42,0.08)',
                            color: (theme: Theme) => theme.palette.text.primary,
                          }
                        : { backgroundColor: baseStatusColor, color: '#fff', fontWeight: 600 };
                    return (
                      <Stack
                        key={`${report.taskId}-${base.baseId}`}
                        direction="row"
                        spacing={1}
                        alignItems="center"
                      >
                        <Chip
                          icon={<FolderIcon sx={{ color: resolveStatusColor(base.status) }} />}
                          label={t('reports.base', 'БС {baseId}', { baseId: base.baseId })}
                          component={NextLink}
                          href={`/reports/${report.taskId}/${base.baseId}${tokenParam}`}
                          clickable
                          sx={{
                            borderRadius: 999,
                            px: 1,
                            backgroundColor: (theme: Theme) =>
                              theme.palette.mode === 'dark'
                                ? 'rgba(148,163,184,0.16)'
                                : 'rgba(15,23,42,0.04)',
                          }}
                        />
                        <Chip label={baseStatusLabel} size="small" sx={baseStatusChipSx} />
                      </Stack>
                    );
                  })}
                </Stack>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>{t('reports.list.deleteTitle', 'Удалить фотоотчёт?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('reports.list.deleteDescription', 'Отчёт и все файлы в хранилище будут удалены без возможности восстановления.')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} disabled={deleteLoading}>
            {t('common.cancel', 'Отмена')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDelete}
            disabled={deleteLoading}
          >
            {t('reports.list.deleteConfirm', 'Удалить')}
          </Button>
        </DialogActions>
      </Dialog>

      <ProfileDialog
        open={profileOpen}
        onClose={closeProfileDialog}
        clerkUserId={profileUserId}
      />
    </Box>
  );
}
