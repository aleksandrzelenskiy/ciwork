'use client';

import React from 'react';
import { Box } from '@mui/material';
import AdminTasksMap from '@/features/admin/AdminTasksMap';

export default function AdminTasksLocationsPage(): React.ReactElement {
    return (
        <Box
            sx={{
                position: 'fixed',
                top: 70,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: 'calc(100vh - 70px)',
                p: 0,
                m: 0,
            }}
        >
            <AdminTasksMap />
        </Box>
    );
}
