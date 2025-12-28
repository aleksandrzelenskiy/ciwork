// app/tasks/locations/page.tsx

import React from 'react';
import { Box, Typography } from '@mui/material';
import MiniMap from '@/features/dashboards/MiniMap';
import { GetUserContext } from '@/server-actions/user-context';

export default async function TaskLocationsPage() {
    const response = await GetUserContext();
    if (!response || !response.success) {
        return (
            <Box className='p-4 md:p-8'>
                <Typography variant='h6' color='error'>
                    {response?.message || 'User data not found'}
                </Typography>
            </Box>
        );
    }

    const { user, effectiveOrgRole } = response.data;

    return (
        <Box className='p-4 md:p-8'>
            <Typography variant='h5' gutterBottom>
                Карта задач
            </Typography>
            <MiniMap
                role={effectiveOrgRole}
                clerkUserId={user.clerkUserId}
                showOverlay={false}
                showCta={false}
                mapHeight={600}
            />
        </Box>
    );
}
