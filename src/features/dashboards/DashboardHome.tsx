'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import ContractorDashboard from '@/features/dashboards/contractor/ContractorDashboard';
import EmployerDashboard from '@/features/dashboards/employer/EmployerDashboard';
import type { EffectiveOrgRole } from '@/app/types/roles';

interface DashboardHomeProps {
    role: EffectiveOrgRole | null;
    clerkUserId: string;
    profileType?: 'employer' | 'contractor' | null;
}

export default function DashboardHome({
    role,
    clerkUserId,
    profileType,
}: DashboardHomeProps) {
    if (role === 'executor' || profileType === 'contractor') {
        return <ContractorDashboard role={role} clerkUserId={clerkUserId} />;
    }

    if (role) {
        return <EmployerDashboard role={role} clerkUserId={clerkUserId} />;
    }

    return (
        <Box sx={{ textAlign: 'center', p: 4 }}>
            <Typography variant='h6'>
                Главная страница обновляется. Профиль еще не настроен.
            </Typography>
        </Box>
    );
}
