// app/components/dashboards/InitiatorDashboard.tsx

'use client';

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import MiniMap from '@/features/dashboards/MiniMap';
import MiniTaskTable from '@/features/dashboards/MiniTaskTable';
import MiniReportsList from '@/features/dashboards/MiniReportsList';
import TaskMetricDiagram from '@/features/dashboards/TaskMetricDiagram';
import type { EffectiveOrgRole } from '@/app/types/roles';

interface InitiatorDashboardProps {
  role: EffectiveOrgRole | null;
  clerkUserId: string;
}

const masonrySpacing = { xs: 1, sm: 2, md: 2, lg: 2, xl: 2 };

const InitiatorDashboard: React.FC<InitiatorDashboardProps> = ({
  role,
  clerkUserId,
}) => {
  console.log(role, clerkUserId);

  return (
    <Box>
      <Typography variant='h6' gutterBottom>
        Initiator Dashboards
      </Typography>

      <Box
        sx={(theme) => ({
          width: '100%',
          px: {
            xs: `calc(${theme.spacing(masonrySpacing.xs)} / 2)`,
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
            <Typography variant='subtitle1'>Task Location</Typography>
            <MiniMap role={role} clerkUserId={clerkUserId} />
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant='h6'>Metrics</Typography>
            <TaskMetricDiagram role={role} clerkUserId={clerkUserId} />
          </Paper>
        </Masonry>
      </Box>
    </Box>
  );
};

export default InitiatorDashboard;
