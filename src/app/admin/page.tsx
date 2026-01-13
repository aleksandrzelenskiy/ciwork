'use client';

import * as React from 'react';
import {
    Box,
    Tab,
    Tabs,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSearchParams } from 'next/navigation';
import OrganizationsAdmin from '@/features/admin/OrganizationsAdmin';
import UsersAdmin from '@/features/admin/UsersAdmin';
import PlanConfigAdmin from '@/features/admin/PlanConfigAdmin';
import { UI_RADIUS } from '@/config/uiTokens';

type AdminTab = 'organizations' | 'users' | 'plans';

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
        if (rawTab === 'organizations' || rawTab === 'users' || rawTab === 'plans') {
            return rawTab;
        }
        if (focusUserId) {
            return 'users';
        }
        return null;
    }, [focusUserId, safeParams]);
    const isDarkMode = theme.palette.mode === 'dark';
    const [tab, setTab] = React.useState<AdminTab>(() => resolveTab() ?? 'organizations');
    const tabBorderColor = isDarkMode ? 'rgba(148,163,184,0.3)' : 'rgba(15,23,42,0.16)';
    const tabActiveBg = isDarkMode ? 'rgba(14,116,144,0.24)' : 'rgba(14,116,144,0.1)';
    const tabInactiveColor = isDarkMode ? 'rgba(226,232,240,0.7)' : 'rgba(15,23,42,0.6)';

    React.useEffect(() => {
        const nextTab = resolveTab();
        if (nextTab && nextTab !== tab) {
            setTab(nextTab);
        }
    }, [resolveTab, tab]);

    return (
        <Box sx={{ px: { xs: 1, md: 2 }, py: { xs: 2, md: 3 } }}>
            <Tabs
                value={tab}
                onChange={(_, newValue) => setTab(newValue as AdminTab)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                    mb: 2,
                    '& .MuiTabs-indicator': {
                        display: 'none',
                    },
                }}
            >
                <Tab
                    value="organizations"
                    label="ОРГАНИЗАЦИИ"
                    sx={{
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        borderRadius: UI_RADIUS.tab,
                        minHeight: 0,
                        px: 2.5,
                        py: 1.2,
                        mx: 0.5,
                        color: tab === 'organizations' ? theme.palette.text.primary : tabInactiveColor,
                        backgroundColor: tab === 'organizations' ? tabActiveBg : 'transparent',
                        border: `1px solid ${tabBorderColor}`,
                    }}
                />
                <Tab
                    value="users"
                    label="ПОЛЬЗОВАТЕЛИ"
                    sx={{
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        borderRadius: UI_RADIUS.tab,
                        minHeight: 0,
                        px: 2.5,
                        py: 1.2,
                        mx: 0.5,
                        color: tab === 'users' ? theme.palette.text.primary : tabInactiveColor,
                        backgroundColor: tab === 'users' ? tabActiveBg : 'transparent',
                        border: `1px solid ${tabBorderColor}`,
                    }}
                />
                <Tab
                    value="plans"
                    label="ТАРИФЫ"
                    sx={{
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        borderRadius: UI_RADIUS.tab,
                        minHeight: 0,
                        px: 2.5,
                        py: 1.2,
                        mx: 0.5,
                        color: tab === 'plans' ? theme.palette.text.primary : tabInactiveColor,
                        backgroundColor: tab === 'plans' ? tabActiveBg : 'transparent',
                        border: `1px solid ${tabBorderColor}`,
                    }}
                />
            </Tabs>

            {tab === 'organizations' && <OrganizationsAdmin />}
            {tab === 'users' && <UsersAdmin focusUserId={focusUserId} />}
            {tab === 'plans' && <PlanConfigAdmin />}
        </Box>
    );
}
