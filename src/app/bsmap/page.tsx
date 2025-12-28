import React from 'react';
import { Box, Typography } from '@mui/material';
import BSMap from '@/features/maps/BSMap';
import { GetUserContext } from '@/server-actions/user-context';

export default async function BsMapPage() {
    const response = await GetUserContext();
    if (!response || !response.success || !response.data.isSuperAdmin) {
        return (
            <Box className='p-4 md:p-8'>
                <Typography variant='h6' color='error'>
                    Доступ запрещен
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', height: '100vh', p: 0, m: 0 }}>
            <BSMap />
        </Box>
    );
}
