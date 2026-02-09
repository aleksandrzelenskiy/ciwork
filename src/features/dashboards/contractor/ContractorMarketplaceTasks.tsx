'use client';

import React, { useEffect, useState } from 'react';
import {
    Alert,
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

interface UserContextPayload {
    profileType?: 'employer' | 'contractor';
    specializations?: string[];
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
    const [needsSpecialization, setNeedsSpecialization] = useState(false);

    useEffect(() => {
        async function fetchUserContext() {
            try {
                const res = await fetch(withBasePath('/api/current-user'), { cache: 'no-store' });
                if (!res.ok) return;
                const data = (await res.json()) as UserContextPayload;
                const specs = Array.isArray(data.specializations) ? data.specializations : [];
                const hasAllowedSpec = specs.some(
                    (spec) => spec === 'installation' || spec === 'document' || spec === 'construction'
                );
                if (data.profileType === 'contractor' && !hasAllowedSpec) {
                    setNeedsSpecialization(true);
                }
            } catch {
                // Ignore profile read errors here and keep default empty-state behavior.
            }
        }

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
        void fetchUserContext();
        void fetchTasks();
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
        if (needsSpecialization) {
            return (
                <Alert severity='info'>
                    {t(
                        'market.specialization.required',
                        'Чтобы видеть задачи на бирже, выберите специализацию в настройках профиля.'
                    )}
                </Alert>
            );
        }
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
