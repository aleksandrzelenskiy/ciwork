import React from 'react';
import { Box } from '@mui/material';
import ProjectTaskLocation from '@/app/workspace/components/ProjectTaskLocation';

export default function TaskLocationsPage() {
    return (
        <Box sx={{ width: '100%', height: '100vh', p: 0, m: 0 }}>
            <ProjectTaskLocation />
        </Box>
    );
}
