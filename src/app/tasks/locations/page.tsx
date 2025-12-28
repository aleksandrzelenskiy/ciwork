'use client';

import { Box } from '@mui/material';
import TasksLocation from '@/features/tasks/TasksLocation';

export default function TasksLocationsPage() {
    return (
        <Box sx={{ width: '100%', height: '100vh', p: 0, m: 0 }}>
            <TasksLocation />
        </Box>
    );
}
