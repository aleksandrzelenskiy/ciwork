// app/page.tsx

import React from 'react';
import { Box, Typography } from '@mui/material';
import { GetUserContext } from '@/server-actions/user-context';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
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

  const { user, effectiveOrgRole, memberships } = response.data;
  const requestedMembership = memberships.find((membership) => membership.status === 'requested') ?? null;
  const hasActiveMembership = memberships.some((membership) => membership.status === 'active');
  const isEmployer = user.profileType === 'employer';
  let pendingOrgName: string | null = null;

  if (requestedMembership && !hasActiveMembership) {
    await dbConnect();
    const orgDoc = await Organization.findById(requestedMembership.orgId, {
      name: 1,
      orgSlug: 1,
    }).lean();
    pendingOrgName = orgDoc?.name || orgDoc?.orgSlug || null;
  }

  return (
    <Box className='p-2 sm:p-4 md:p-8' sx={{ minHeight: '100vh' }}>
      <DashboardHome
        role={effectiveOrgRole}
        clerkUserId={user.clerkUserId}
        profileType={user.profileType ?? null}
        pendingAccess={Boolean(requestedMembership && !hasActiveMembership && isEmployer)}
        pendingOrgName={pendingOrgName}
      />
    </Box>
  );
};

export default DashboardPage;
