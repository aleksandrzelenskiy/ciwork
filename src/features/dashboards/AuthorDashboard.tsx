// app/components/dashboards/AuthorDashboard.tsx

'use client';

import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import MiniMap from '@/features/dashboards/MiniMap';
import MiniTaskTable from '@/features/dashboards/MiniTaskTable';
import MiniReportsList from '@/features/dashboards/MiniReportsList';
import TaskMetricDiagram from '@/features/dashboards/TaskMetricDiagram';
import type { EffectiveOrgRole } from '@/app/types/roles';

interface AuthorDashboardProps {
  role: EffectiveOrgRole | null;
  clerkUserId: string;
}

const AuthorDashboard: React.FC<AuthorDashboardProps> = ({
  role,
  clerkUserId,
}) => {
  console.log(role, clerkUserId);

  return (
    <Box>
      <Typography variant='h6' gutterBottom>
        Author Dashboards
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
        {/* Метрики */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='h6'>Metrics</Typography>
            <TaskMetricDiagram role={role} clerkUserId={clerkUserId} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AuthorDashboard;
