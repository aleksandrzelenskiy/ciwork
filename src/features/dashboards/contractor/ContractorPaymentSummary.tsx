'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Divider,
    List,
    ListItem,
    ListItemText,
    Typography,
} from '@mui/material';
import Link from 'next/link';
import type { Task } from '@/app/types/taskTypes';

const PAYABLE_STATUSES = new Set(['Done', 'Agreed']);

const formatRuble = (value: number) =>
    new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

const resolveTaskAmount = (task: Task) =>
    Number(task.contractorPayment ?? task.totalCost ?? 0);

export default function ContractorPaymentSummary() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmingTaskIds, setConfirmingTaskIds] = useState<string[]>([]);

    useEffect(() => {
        async function fetchTasks() {
            try {
                const res = await fetch('/api/tasks', { cache: 'no-store' });
                if (!res.ok) {
                    setError('Ошибка при загрузке задач');
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

    const payableTasks = useMemo(
        () =>
            tasks.filter(
                (task) =>
                    PAYABLE_STATUSES.has(task.status) &&
                    !task.payment?.contractorConfirmedAt
            ),
        [tasks]
    );

    const awaitingOrgMark = payableTasks.filter(
        (task) => !task.payment?.orgMarkedPaidAt
    );
    const awaitingConfirmation = payableTasks.filter(
        (task) => task.payment?.orgMarkedPaidAt
    );

    const totalPayable = payableTasks.reduce(
        (sum, task) => sum + resolveTaskAmount(task),
        0
    );

    const handleConfirm = async (taskId: string) => {
        if (confirmingTaskIds.includes(taskId)) return;
        setConfirmingTaskIds((prev) => [...prev, taskId]);
        setError(null);

        try {
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/payment`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'confirm_paid' }),
            });

            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                setError(payload.error || 'Не удалось подтвердить оплату');
                return;
            }

            const payload = await res.json();
            setTasks((prev) =>
                prev.map((task) =>
                    task.taskId === taskId
                        ? { ...task, payment: payload.payment }
                        : task
                )
            );
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setConfirmingTaskIds((prev) => prev.filter((id) => id !== taskId));
        }
    };

    if (loading) {
        return (
            <Box display='flex' justifyContent='center' alignItems='center' minHeight={120}>
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

    return (
        <Box>
            {payableTasks.length === 0 ? (
                <Typography variant='h6' color='text.secondary' textAlign='center'>
                    Нет задач к оплате
                </Typography>
            ) : (
                <>
                    <Typography variant='body2' color='text.secondary' textAlign='center'>
                        К выплате по завершенным задачам
                    </Typography>
                    <Typography variant='h4' fontWeight={600} textAlign='center' sx={{ mt: 1 }}>
                        {formatRuble(totalPayable)}
                        {'\u00A0'}
                        {'\u20BD'}
                    </Typography>
                    <Typography variant='body2' color='text.secondary' textAlign='center' sx={{ mt: 1 }}>
                        {`Задач: ${payableTasks.length}`}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant='body2' color='text.secondary'>
                        {`Ожидают отметки организации: ${awaitingOrgMark.length}`}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {`Ожидают подтверждения: ${awaitingConfirmation.length}`}
                    </Typography>
                </>
            )}

            {awaitingConfirmation.length > 0 && (
                <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant='subtitle2' sx={{ mb: 1 }}>
                        Подтвердите оплату
                    </Typography>
                    <List dense>
                        {awaitingConfirmation.slice(0, 3).map((task) => (
                            <ListItem
                                key={task.taskId}
                                secondaryAction={
                                    <Button
                                        size='small'
                                        variant='outlined'
                                        onClick={() => handleConfirm(task.taskId)}
                                        disabled={confirmingTaskIds.includes(task.taskId)}
                                    >
                                        Подтвердить
                                    </Button>
                                }
                            >
                                <ListItemText
                                    primary={task.taskName}
                                    secondary={task.taskId}
                                />
                            </ListItem>
                        ))}
                    </List>
                    {awaitingConfirmation.length > 3 && (
                        <Typography variant='caption' color='text.secondary'>
                            Есть еще задачи для подтверждения
                        </Typography>
                    )}
                </>
            )}

            <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Link href='/tasks'>
                    <Button variant='text'>Показать задачи</Button>
                </Link>
            </Box>
        </Box>
    );
}
