// app/components/dashboards/AdminDashboard.tsx

'use client';

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import MiniMap from '@/features/dashboards/MiniMap';
import MiniTaskTable from '@/features/dashboards/MiniTaskTable';
import MiniReportsList from '@/features/dashboards/MiniReportsList';
import FinancialMetrics from '@/features/dashboards/FinancialMetrics';
import TaskMetricDiagram from './TaskMetricDiagram';
import type { EffectiveOrgRole } from '@/app/types/roles';

interface AdminDashboardProps {
  role: EffectiveOrgRole | null;
  clerkUserId: string;
}

const masonrySpacing = { xs: 0.5, sm: 2, md: 2, lg: 2, xl: 2 };

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  role,
  clerkUserId,
}) => {
  console.log(role, clerkUserId);

  return (
    <Box>
      <Typography variant='h6' gutterBottom>
        Admin Dashboards
      </Typography>

      <Box
        sx={(theme) => ({
          width: '100%',
          px: {
            xs: theme.spacing(0),
            sm: `calc(${theme.spacing(masonrySpacing.sm)} / 2)`,
            md: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
            lg: `calc(${theme.spacing(masonrySpacing.lg)} / 2)`,
            xl: `calc(${theme.spacing(masonrySpacing.xl)} / 2)`,
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
          <Paper sx={{ p: 2 }}>
            <Typography variant='h6' gutterBottom>
              Last Tasks
            </Typography>
            <MiniTaskTable role={role} clerkUserId={clerkUserId} />
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant='h6' gutterBottom>
              Last Reports
            </Typography>
            <MiniReportsList role={role} clerkUserId={clerkUserId} />
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant='h6'>Task Location</Typography>
            <MiniMap role={role} clerkUserId={clerkUserId} />
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Box sx={{ mb: 2 }}>
              <FinancialMetrics />
            </Box>
            <Box sx={{ mb: 2 }}>
              <TaskMetricDiagram role={role} clerkUserId={clerkUserId} />
            </Box>
          </Paper>
        </Masonry>
      </Box>
    </Box>
  );
};

export default AdminDashboard;
