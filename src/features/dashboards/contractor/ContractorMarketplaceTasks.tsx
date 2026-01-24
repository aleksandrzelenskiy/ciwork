'use client';

import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import Link from 'next/link';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

interface MarketplaceTask {
    _id: string;
    taskName?: string;
    publicDescription?: string;
    budget?: number | null;
    currency?: string;
    orgName?: string;
    project?: { name?: string };
    createdAt?: string;
}

const formatBudget = (budget: number | null | undefined, currency: string | undefined, locale: string) => {
    if (!budget) return '—';
    const resolvedCurrency = currency || 'RUB';
    try {
        return new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
            style: 'currency',
            currency: resolvedCurrency,
            maximumFractionDigits: 0,
        }).format(budget);
    } catch {
        return `${budget} ${resolvedCurrency}`;
    }
};

export default function ContractorMarketplaceTasks() {
    const { t, locale } = useI18n();
    const [tasks, setTasks] = useState<MarketplaceTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTasks() {
            try {
                const res = await fetch(withBasePath('/api/tasks/public?limit=5'));
                if (!res.ok) {
                    setError(t('market.error.loadTasks', 'Ошибка при загрузке задач маркетплейса'));
                    return;
                }
                const data = await res.json();
                setTasks(data.tasks || []);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : t('common.error.unknown', 'Unknown error'));
            } finally {
                setLoading(false);
            }
        }
        fetchTasks();
    }, [t]);

    if (loading) {
        return (
            <Box display='flex' justifyContent='center' alignItems='center' minHeight={140}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Typography color='error' textAlign='center'>
                {error}
            </Typography>
        );
    }

    if (tasks.length === 0) {
        return (
            <Typography textAlign='center' color='text.secondary'>
                {t('market.empty.newTasks', 'Сейчас нет новых задач на маркетплейсе')}
            </Typography>
        );
    }

    return (
        <Box>
            <TableContainer component={Paper} sx={{ maxHeight: 260 }}>
                <Table size='small' stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>{t('market.table.task', 'Задача')}</TableCell>
                            <TableCell>{t('market.table.organization', 'Организация')}</TableCell>
                            <TableCell align='right'>{t('market.table.budget', 'Бюджет')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {tasks.map((task) => (
                            <TableRow key={task._id}>
                                <TableCell>
                                    <Typography variant='body2' fontWeight={600}>
                                        {task.taskName || t('common.untitled', 'Без названия')}
                                    </Typography>
                                    {task.project?.name && (
                                        <Typography variant='caption' color='text.secondary'>
                                            {task.project.name}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell>{task.orgName || '—'}</TableCell>
                                <TableCell align='right'>
                                    {formatBudget(task.budget, task.currency, locale)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Link href='/market'>
                    <Button variant='text'>{t('dashboard.showMore', 'Показать еще')}</Button>
                </Link>
            </Box>
        </Box>
    );
}
