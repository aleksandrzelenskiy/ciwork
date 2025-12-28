'use client';

import React from 'react';
import AdminDashboard from '@/features/dashboards/AdminDashboard';
import ManagerDashboard from '@/features/dashboards/ManagerDashboard';
import type { EffectiveOrgRole } from '@/app/types/roles';

interface EmployerDashboardProps {
    role: EffectiveOrgRole | null;
    clerkUserId: string;
}

const EmployerDashboard: React.FC<EmployerDashboardProps> = ({
    role,
    clerkUserId,
}) => {
    if (role === 'manager') {
        return <ManagerDashboard role={role} clerkUserId={clerkUserId} />;
    }

    return <AdminDashboard role={role} clerkUserId={clerkUserId} />;
};

export default EmployerDashboard;
