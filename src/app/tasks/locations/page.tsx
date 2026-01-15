import React from 'react';
import { Box } from '@mui/material';
import ProjectTaskLocation from '@/app/workspace/components/ProjectTaskLocation';

export default function TaskLocationsPage() {
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
            <ProjectTaskLocation contactRole="manager" />
        </Box>
    );
}
