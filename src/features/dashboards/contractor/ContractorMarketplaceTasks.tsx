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

const formatBudget = (budget?: number | null, currency?: string) => {
    if (!budget) return '—';
    const resolvedCurrency = currency || 'RUB';
    try {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: resolvedCurrency,
            maximumFractionDigits: 0,
        }).format(budget);
    } catch {
        return `${budget} ${resolvedCurrency}`;
    }
};

export default function ContractorMarketplaceTasks() {
    const [tasks, setTasks] = useState<MarketplaceTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTasks() {
            try {
                const res = await fetch('/api/tasks/public?limit=5');
                if (!res.ok) {
                    setError('Ошибка при загрузке задач маркетплейса');
                    return;
                }
                const data = await res.json();
                setTasks(data.tasks || []);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }
        fetchTasks();
    }, []);

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
                Сейчас нет новых задач на маркетплейсе
            </Typography>
        );
    }

    return (
        <Box>
            <TableContainer component={Paper} sx={{ maxHeight: 260 }}>
                <Table size='small' stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Задача</TableCell>
                            <TableCell>Организация</TableCell>
                            <TableCell align='right'>Бюджет</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {tasks.map((task) => (
                            <TableRow key={task._id}>
                                <TableCell>
                                    <Typography variant='body2' fontWeight={600}>
                                        {task.taskName || 'Без названия'}
                                    </Typography>
                                    {task.project?.name && (
                                        <Typography variant='caption' color='text.secondary'>
                                            {task.project.name}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell>{task.orgName || '—'}</TableCell>
                                <TableCell align='right'>
                                    {formatBudget(task.budget, task.currency)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Link href='/market'>
                    <Button variant='text'>Показать еще</Button>
                </Link>
            </Box>
        </Box>
    );
}
