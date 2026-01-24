// app/components/dashboards/MiniReportsList.tsx

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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import Link from 'next/link';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';

import { getStatusColor } from '@/utils/statusColors';
import { BaseStatus, ReportClient, ApiResponse } from '@/app/types/reportTypes';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { isAdminRole } from '@/app/utils/roleGuards';
import ProfileDialog from '@/features/profile/ProfileDialog';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

interface MiniReportsListProps {
  role: EffectiveOrgRole | null;
  clerkUserId: string; // текущий userId (из Clerk)
}

// Простая функция, определяющая «общий» статус отчёта
function getTaskStatus(baseStatuses: BaseStatus[] = []): string {
  const notAgreed = baseStatuses.find((bs) => bs.status !== 'Agreed');
  return notAgreed ? notAgreed.status : 'Agreed';
}

export default function MiniReportsList({
  role,
  clerkUserId,
}: MiniReportsListProps) {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const [reports, setReports] = useState<ReportClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = isAdminRole(role);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Диалоговое окно
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportClient | null>(
    null
  );

  // 1) Загружаем /api/reports
  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch(withBasePath('/api/reports'));
        if (!res.ok) {
          setError(t('reports.error.load', 'Не удалось загрузить отчеты'));
          return;
        }
        // Ожидаем формат ApiResponse { reports: ReportClient[], error?: string }
        const data: ApiResponse = await res.json();
        if (!Array.isArray(data.reports)) {
          setError(t('common.error.invalidResponse', 'Некорректный ответ от сервера'));
          return;
        }
        setReports(data.reports);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(t('common.error.unknown', 'Неизвестная ошибка'));
        }
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, [t]);

  // 2) Фильтрация по роли
  const filteredReports = useMemo(() => {
    if (!role) return reports;
    if (isAdminRole(role) || role === 'manager' || role === 'viewer') {
      return reports;
    }
    if (role === 'executor') {
      return reports.filter((rep) => rep.createdById === clerkUserId);
    }
    return reports;
  }, [role, clerkUserId, reports]);

  // 3) Сортируем по createdAt (самые свежие – сверху)
  const sortedReports = useMemo(() => {
    return [...filteredReports].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filteredReports]);

  // 4) Берём первые 5
  const lastFive = sortedReports.slice(0, 5);

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
        {t('reports.empty', 'Отчеты не найдены')}
      </Typography>
    );
  }

  // Открытие диалога
  const handleOpenDialog = (report: ReportClient) => {
    setSelectedReport(report);
    setOpenDialog(true);
  };

  // Закрытие диалога
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedReport(null);
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

  return (
    <>
      <Box>
        {/* Таблица (в "окне" высотой ~4-5 строк) */}
        <Box
          sx={{
            position: 'relative',
            maxHeight: 210,
            overflow: 'hidden',
            mb: 2,
          }}
        >
          <TableContainer component={Paper} sx={{ maxHeight: 210 }}>
            <Table size='small' stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>{t('reports.table.report', 'Отчет')}</TableCell>
                  <TableCell>{t('reports.table.author', 'Автор')}</TableCell>
                  <TableCell>{t('reports.table.createdAt', 'Создан')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lastFive.map((report) => {
                  const status = getTaskStatus(report.baseStatuses || []);
                  return (
                    <TableRow key={report.taskId}>
                      <TableCell>
                        {/* Клик по названию отчёта -> открываем диалог */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleOpenDialog(report)}
                        >
                          <FolderIcon
                            fontSize='small'
                            sx={{ color: getStatusColor(status) }}
                          />
                          {report.taskName || report.taskId}
                        </Box>
                      </TableCell>

                      <TableCell>
                        {report.createdById ? (
                          <Button
                            variant='text'
                            size='small'
                            onClick={() => openProfileDialog(report.createdById)}
                            sx={{ textTransform: 'none', px: 0, minWidth: 0 }}
                          >
                            {report.createdByName || report.createdById}
                          </Button>
                        ) : (
                          report.createdByName || '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(report.createdAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Градиент, чтобы обрезать 5ю строку */}
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

        {/* Кнопка All Reports */}
        <Box sx={{ textAlign: 'center' }}>
        <Link href={isAdmin ? '/admin/reports' : '/reports'}>
          <Button variant='text'>{t('reports.all', 'Все отчеты')}</Button>
        </Link>
      </Box>
      </Box>

      {/* Диалог с базовыми станциями */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth='xs'
        fullWidth
      >
        {selectedReport && (
          <>
            <DialogTitle
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                  {t(
                    'reports.openDialog.title',
                    'Открыть отчет по "{task}" на базовой станции:',
                    { task: selectedReport.taskName || selectedReport.taskId }
                  )}
                </Typography>
              </Box>
              <IconButton onClick={handleCloseDialog}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent dividers>
              <Typography variant='subtitle2' sx={{ mb: 1 }}>
                {t('reports.createdAt', 'Создан:')} {' '}
                {new Date(selectedReport.createdAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US')}
              </Typography>

              {/* Список всех базовых станций */}
              <List dense>
                {(selectedReport.baseStatuses || []).map((base) => {
                  const color = getStatusColor(base.status);
                  return (
                    <ListItemButton
                      key={base.baseId}
                      component={Link}
                      href={`/reports/${selectedReport.taskId}/${base.baseId}`}
                    >
                      <ListItemIcon>
                        <FolderIcon sx={{ color }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography>{base.baseId}</Typography>
                            <Chip
                              label={base.status}
                              sx={{
                                backgroundColor: color,
                                color: theme.palette.common.white,
                                textTransform: 'capitalize',
                              }}
                              size='small'
                            />
                          </Box>
                        }
                        secondary={
                          t('reports.statusChanged', 'Статус изменен: {date}', {
                            date: new Date(base.latestStatusChangeDate).toLocaleDateString(
                              locale === 'ru' ? 'ru-RU' : 'en-US'
                            ),
                          })
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </DialogContent>

            <DialogActions>
              <Button onClick={handleCloseDialog}>{t('common.close', 'Закрыть')}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <ProfileDialog
        open={profileOpen}
        onClose={closeProfileDialog}
        clerkUserId={profileUserId}
      />
    </>
  );
}
