'use client';

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import MiniMap from '@/features/dashboards/MiniMap';
import MiniTaskTable from '@/features/dashboards/MiniTaskTable';
import TaskMetricDiagram from '@/features/dashboards/TaskMetricDiagram';
import ContractorPaymentSummary from '@/features/dashboards/contractor/ContractorPaymentSummary';
import ContractorMarketplaceTasks from '@/features/dashboards/contractor/ContractorMarketplaceTasks';
import type { EffectiveOrgRole } from '@/app/types/roles';

interface ContractorDashboardProps {
    role: EffectiveOrgRole | null;
    clerkUserId: string;
}

const masonrySpacing = { xs: 1, sm: 2, md: 2, lg: 2, xl: 2 };

const ContractorDashboard: React.FC<ContractorDashboardProps> = ({
    role,
    clerkUserId,
}) => (
    <Box>
        <Typography variant='h5' gutterBottom>
            Дашборд исполнителя
        </Typography>
        <Box
            sx={(theme) => ({
                width: '100%',
                px: {
                    xs: `calc(${theme.spacing(masonrySpacing.xs)} / 2)`,
                    sm: `calc(${theme.spacing(masonrySpacing.sm)} / 2)`,
                    md: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
                    lg: `calc(${theme.spacing(masonrySpacing.lg)} / 2)`,
                    xl: `calc(${theme.spacing(masonrySpacing.xl)} / 2)`,
                },
                boxSizing: 'border-box',
            })}
        >
            <Masonry
                columns={{ xs: 1, sm: 1, md: 2, lg: 3, xl: 3 }}
                spacing={masonrySpacing}
                sx={{
                    width: '100%',
                    boxSizing: 'border-box',
                    '& > *': { boxSizing: 'border-box' },
                }}
            >
                <Paper sx={{ p: 2 }}>
                    <Typography variant='h6' gutterBottom>
                        Мои задачи
                    </Typography>
                    <MiniTaskTable
                        role={role}
                        clerkUserId={clerkUserId}
                        ctaLabel='Показать еще'
                        ctaHref='/tasks'
                    />
                </Paper>
                <Paper sx={{ p: 2 }}>
                    <Typography variant='h6' gutterBottom>
                        Оплата
                    </Typography>
                    <ContractorPaymentSummary />
                </Paper>
                <Paper sx={{ p: 2 }}>
                    <Typography variant='h6'>Карта задач</Typography>
                    <MiniMap role={role} clerkUserId={clerkUserId} />
                </Paper>
                <Paper sx={{ p: 2 }}>
                    <Typography variant='h6'>Маркетплейс</Typography>
                    <ContractorMarketplaceTasks />
                </Paper>
                <Paper sx={{ p: 2 }}>
                    <TaskMetricDiagram role={role} clerkUserId={clerkUserId} />
                </Paper>
            </Masonry>
        </Box>
    </Box>
);

export default ContractorDashboard;
