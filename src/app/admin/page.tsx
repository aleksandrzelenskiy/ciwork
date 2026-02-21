'use client';

import * as React from 'react';
import {
    Box,
    Button,
    ButtonGroup,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSearchParams } from 'next/navigation';
import OrganizationsAdmin from '@/features/admin/OrganizationsAdmin';
import UsersAdmin from '@/features/admin/UsersAdmin';
import PlanConfigAdmin from '@/features/admin/PlanConfigAdmin';
import TasksAdmin from '@/features/admin/TasksAdmin';
import ReportsAdmin from '@/features/admin/ReportsAdmin';
import ProjectsAdmin from '@/features/admin/ProjectsAdmin';
import { UI_RADIUS } from '@/config/uiTokens';

type AdminTab = 'organizations' | 'users' | 'projects' | 'tasks' | 'reports' | 'plans';

const TAB_ITEMS: Array<{ value: AdminTab; label: string }> = [
    { value: 'organizations', label: 'ОРГАНИЗАЦИИ' },
    { value: 'users', label: 'ПОЛЬЗОВАТЕЛИ' },
    { value: 'projects', label: 'ПРОЕКТЫ' },
    { value: 'tasks', label: 'ЗАДАЧИ' },
    { value: 'reports', label: 'ОТЧЕТЫ' },
    { value: 'plans', label: 'ТАРИФЫ' },
];

export default function AdminPage() {
    const theme = useTheme();
    const searchParams = useSearchParams();
    const safeParams = React.useMemo(
        () => searchParams ?? new URLSearchParams(),
        [searchParams]
    );
    const focusUserId = React.useMemo(() => {
        const value = safeParams.get('focusUser');
        return value?.trim() || null;
    }, [safeParams]);
    const resolveTab = React.useCallback((): AdminTab | null => {
        const rawTab = safeParams.get('tab')?.trim().toLowerCase();
        if (
            rawTab === 'organizations' ||
            rawTab === 'users' ||
            rawTab === 'projects' ||
            rawTab === 'tasks' ||
            rawTab === 'reports' ||
            rawTab === 'plans'
        ) {
            return rawTab;
        }
        if (focusUserId) {
            return 'users';
        }
        return null;
    }, [focusUserId, safeParams]);
    const isDarkMode = theme.palette.mode === 'dark';
    const [tab, setTab] = React.useState<AdminTab>(() => resolveTab() ?? 'organizations');
    const activeBg = isDarkMode ? 'rgba(14,116,144,0.88)' : 'rgba(14,116,144,0.9)';
    const inactiveBg = isDarkMode ? 'rgba(30,41,59,0.45)' : 'rgba(248,250,252,0.95)';
    const activeColor = '#f8fafc';
    const inactiveColor = isDarkMode ? 'rgba(226,232,240,0.85)' : 'rgba(15,23,42,0.75)';
    const borderColor = isDarkMode ? 'rgba(148,163,184,0.28)' : 'rgba(15,23,42,0.16)';

    React.useEffect(() => {
        const nextTab = resolveTab();
        if (nextTab && nextTab !== tab) {
            setTab(nextTab);
        }
    }, [resolveTab, tab]);

    return (
        <Box sx={{ px: { xs: 1, md: 2 }, py: { xs: 2, md: 3 } }}>
            <Box sx={{ mb: 2, overflowX: 'auto', pb: 0.5 }}>
                <ButtonGroup
                    variant="contained"
                    sx={{
                        minWidth: 'max-content',
                        '& .MuiButton-root': {
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            borderRadius: UI_RADIUS.tab,
                            px: 2.25,
                            py: 1,
                            borderColor,
                            boxShadow: 'none',
                            color: inactiveColor,
                            backgroundColor: inactiveBg,
                        },
                        '& .MuiButton-root:hover': {
                            boxShadow: 'none',
                        },
                    }}
                >
                    {TAB_ITEMS.map((item) => (
                        <Button
                            key={item.value}
                            onClick={() => setTab(item.value)}
                            sx={
                                tab === item.value
                                    ? {
                                          backgroundColor: activeBg,
                                          color: activeColor,
                                          '&:hover': {
                                              backgroundColor: activeBg,
                                          },
                                      }
                                    : undefined
                            }
                        >
                            {item.label}
                        </Button>
                    ))}
                </ButtonGroup>
            </Box>

            {tab === 'organizations' && <OrganizationsAdmin />}
            {tab === 'users' && <UsersAdmin focusUserId={focusUserId} />}
            {tab === 'projects' && <ProjectsAdmin />}
            {tab === 'tasks' && <TasksAdmin />}
            {tab === 'reports' && <ReportsAdmin />}
            {tab === 'plans' && <PlanConfigAdmin />}
        </Box>
    );
}
