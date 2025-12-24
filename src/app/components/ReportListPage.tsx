'use client';

import React from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import Link from 'next/link';
import FolderIcon from '@mui/icons-material/Folder';
import { BaseStatus, ReportClient, ApiResponse } from '@/app/types/reportTypes';
import ReportStatusPill from '@/app/components/reports/ReportStatusPill';

const getTaskStatus = (baseStatuses: BaseStatus[] = []) => {
  const nonAgreedStatus = baseStatuses.find((bs) => bs.status !== 'Agreed');
  return nonAgreedStatus ? nonAgreedStatus.status : 'Agreed';
};

export default function ReportListPage() {
  const [reports, setReports] = React.useState<ReportClient[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

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

  const filtered = reports.filter((report) => {
    const status = getTaskStatus(report.baseStatuses);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const label = (report.taskName || report.taskId || '').toLowerCase();
    const matchesSearch = label.includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

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
      }}
    >
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
          return (
            <Box
              key={report.taskId}
              sx={{
                borderRadius: 4,
                p: 3,
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'rgba(255,255,255,0.92)',
                boxShadow: '0 24px 60px rgba(15,23,42,0.08)',
              }}
            >
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      {report.taskName || report.taskId}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Задача {report.taskId} · {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : '—'}
                    </Typography>
                    {report.createdByName && (
                      <Typography variant="body2" color="text.secondary">
                        Исполнитель: {report.createdByName}
                      </Typography>
                    )}
                  </Box>
                  <ReportStatusPill status={status} />
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {report.baseStatuses.map((base) => (
                    <Chip
                      key={`${report.taskId}-${base.baseId}`}
                      icon={<FolderIcon />}
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
    </Box>
  );
}
