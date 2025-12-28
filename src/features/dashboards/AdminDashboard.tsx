// app/components/dashboards/AdminDashboard.tsx

'use client';

import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
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

      <Grid container spacing={2}>
        {/* Last Tasks */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='h6' gutterBottom>
              Last Tasks
            </Typography>
            <MiniTaskTable role={role} clerkUserId={clerkUserId} />
          </Paper>
        </Grid>

        {/* Last Reports */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='h6' gutterBottom>
              Last Reports
            </Typography>
            <MiniReportsList role={role} clerkUserId={clerkUserId} />
          </Paper>
        </Grid>

        {/* Task Location (с мини-картой) */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='h6'>Task Location</Typography>
            <MiniMap role={role} clerkUserId={clerkUserId} />
          </Paper>
        </Grid>

        {/* Metrics */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ mb: 2 }}>
              <FinancialMetrics />
            </Box>
            <Box sx={{ mb: 2 }}>
              <TaskMetricDiagram role={role} clerkUserId={clerkUserId} />
            </Box>
          </Paper>
        </Grid>

        {/* Дополнительный блок */}
        {/* <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='h6' gutterBottom>
              Some Future Block
            </Typography>
          </Paper>
        </Grid> */}
      </Grid>
    </Box>
  );
};

export default AdminDashboard;
