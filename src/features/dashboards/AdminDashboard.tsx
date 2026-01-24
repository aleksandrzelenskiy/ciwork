// app/components/dashboards/AdminDashboard.tsx

'use client';

import React from 'react';
import { Box, Paper, Typography, type PaperProps } from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import { useTheme } from '@mui/material/styles';
import MiniMap from '@/features/dashboards/MiniMap';
import MiniTaskTable from '@/features/dashboards/MiniTaskTable';
import MiniReportsList from '@/features/dashboards/MiniReportsList';
import TaskMetricDiagram from './TaskMetricDiagram';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { getOrgPageStyles } from '@/app/org/(protected)/[org]/styles';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminDashboardProps {
  role: EffectiveOrgRole | null;
  clerkUserId: string;
}

const masonrySpacing = { xs: 1, sm: 1.5, md: 2 } as const;

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  role,
  clerkUserId,
}) => {
  const { t } = useI18n();
  console.log(role, clerkUserId);
  const theme = useTheme();
  const { masonryCardSx } = getOrgPageStyles(theme);
  const cardPadding = React.useMemo(() => ({ xs: 2, md: 2.5 }), []);
  const CardItem = React.useMemo(() => {
    const Component = React.forwardRef<HTMLDivElement, PaperProps>(({ sx, ...rest }, ref) => (
      <Paper ref={ref} {...rest} sx={{ ...masonryCardSx, p: cardPadding, minWidth: 0, ...sx }} />
    ));
    Component.displayName = 'CardItem';
    return Component;
  }, [cardPadding, masonryCardSx]);

  return (
    <Box>
      <Typography variant='h6' gutterBottom sx={{ mb: 2 }}>
        {t('dashboard.admin.title', 'Панель администратора')}
      </Typography>

      <Box
        sx={(theme) => ({
          width: '100%',
          px: {
            xs: `calc(${theme.spacing(masonrySpacing.xs)} / 2)`,
            sm: `calc(${theme.spacing(masonrySpacing.sm)} / 2)`,
            md: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
            lg: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
            xl: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
          },
          boxSizing: 'border-box',
        })}
      >
        <Masonry
          columns={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}
          spacing={masonrySpacing}
          sx={{
            width: '100%',
            boxSizing: 'border-box',
            '& > *': { boxSizing: 'border-box' },
          }}
        >
          <CardItem sx={{ minWidth: 0 }}>
            <Typography variant='h6' gutterBottom>
              {t('dashboard.recentTasks', 'Последние задачи')}
            </Typography>
            <MiniTaskTable role={role} clerkUserId={clerkUserId} />
          </CardItem>

          <CardItem sx={{ minWidth: 0 }}>
            <Typography variant='h6' gutterBottom>
              {t('dashboard.recentReports', 'Последние отчеты')}
            </Typography>
            <MiniReportsList role={role} clerkUserId={clerkUserId} />
          </CardItem>

          <CardItem sx={{ minWidth: 0 }}>
            <Typography variant='h6'>{t('dashboard.taskMap', 'Карта задач')}</Typography>
            <MiniMap role={role} clerkUserId={clerkUserId} />
          </CardItem>

          <CardItem sx={{ minWidth: 0 }}>
            <Box sx={{ mb: 2 }}>
              <TaskMetricDiagram role={role} clerkUserId={clerkUserId} />
            </Box>
          </CardItem>
        </Masonry>
      </Box>
    </Box>
  );
};

export default AdminDashboard;
