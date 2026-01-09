'use client';

import React from 'react';
import { Box, Paper, Typography, type PaperProps } from '@mui/material';
import Masonry from '@mui/lab/Masonry';
import { useTheme } from '@mui/material/styles';
import MiniMap from '@/features/dashboards/MiniMap';
import MiniTaskTable from '@/features/dashboards/MiniTaskTable';
import TaskMetricDiagram from '@/features/dashboards/TaskMetricDiagram';
import ContractorPaymentSummary from '@/features/dashboards/contractor/ContractorPaymentSummary';
import ContractorMarketplaceTasks from '@/features/dashboards/contractor/ContractorMarketplaceTasks';
import ContractorReportsStatus from '@/features/dashboards/contractor/ContractorReportsStatus';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { getOrgPageStyles } from '@/app/org/(protected)/[org]/styles';

interface ContractorDashboardProps {
    role: EffectiveOrgRole | null;
    clerkUserId: string;
}

const masonrySpacing = { xs: 1, sm: 1.5, md: 2 } as const;

const ContractorDashboard: React.FC<ContractorDashboardProps> = ({
    role,
    clerkUserId,
}) => {
    const theme = useTheme();
    const { masonryCardSx } = getOrgPageStyles(theme);
    const cardPadding = React.useMemo(() => ({ xs: 2, md: 2.5 }), []);
    const CardItem = React.useMemo(() => {
        const Component = React.forwardRef<HTMLDivElement, PaperProps>(({ sx, ...rest }, ref) => (
            <Paper ref={ref} {...rest} sx={{ ...masonryCardSx, p: cardPadding, minWidth: 0, ...sx }} />
        ));
        Component.displayName = 'CardItem';
        return Component;
    }, [cardPadding, masonryCardSx]);

    return (
        <Box>
            <Typography variant='h5' gutterBottom sx={{ mb: 2 }}>
                Панель подрядчика
            </Typography>
            <Box
                sx={(theme) => ({
                    width: '100%',
                    px: {
                        xs: `calc(${theme.spacing(masonrySpacing.xs)} / 2)`,
                        sm: `calc(${theme.spacing(masonrySpacing.sm)} / 2)`,
                        md: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
                        lg: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
                        xl: `calc(${theme.spacing(masonrySpacing.md)} / 2)`,
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
                    <CardItem sx={{ minWidth: 0 }}>
                        <Typography variant='h6' gutterBottom>
                            Мои задачи
                        </Typography>
                        <MiniTaskTable
                            role={role}
                            clerkUserId={clerkUserId}
                            ctaLabel='Показать еще'
                            ctaHref='/tasks'
                        />
                    </CardItem>
                    <CardItem sx={{ minWidth: 0 }}>
                        <Typography variant='h6' gutterBottom>
                            Оплата
                        </Typography>
                        <ContractorPaymentSummary />
                    </CardItem>
                    <CardItem sx={{ minWidth: 0 }}>
                        <Typography variant='h6'>Карта задач</Typography>
                        <MiniMap role={role} clerkUserId={clerkUserId} />
                    </CardItem>
                    <CardItem sx={{ minWidth: 0 }}>
                        <Typography variant='h6'>Маркетплейс</Typography>
                        <ContractorMarketplaceTasks />
                    </CardItem>
                    <CardItem sx={{ minWidth: 0 }}>
                        <Typography variant='h6' gutterBottom>
                            Фотоотчеты
                        </Typography>
                        <ContractorReportsStatus />
                    </CardItem>
                    <CardItem sx={{ minWidth: 0 }}>
                        <TaskMetricDiagram role={role} clerkUserId={clerkUserId} />
                    </CardItem>
                </Masonry>
            </Box>
        </Box>
    );
};

export default ContractorDashboard;
