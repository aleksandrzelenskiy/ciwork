// app/page.tsx

import React from 'react';
import { Box, Typography } from '@mui/material';
import { GetUserContext } from '@/server-actions/user-context';
import DashboardHome from '@/features/dashboards/DashboardHome';

export const dynamic = 'force-dynamic';

const DashboardPage: React.FC = async () => {
  const response = await GetUserContext();
  if (!response || !response.success) {
    return (
      <Box className='p-4 md:p-8' sx={{ minHeight: '100vh' }}>
        <Typography variant='h4' component='h1' align='center' color='error'>
          {response?.message || 'User data not found'}
        </Typography>
      </Box>
    );
  }

  const { user, effectiveOrgRole } = response.data;

  return (
    <Box className='p-2 sm:p-4 md:p-8' sx={{ minHeight: '100vh' }}>
      <DashboardHome
        role={effectiveOrgRole}
        clerkUserId={user.clerkUserId}
        profileType={user.profileType ?? null}
      />
    </Box>
  );
};

export default DashboardPage;
