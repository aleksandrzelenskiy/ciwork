'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    CircularProgress,
    Divider,
    Typography,
} from '@mui/material';
import type { Task, TaskPayment } from '@/app/types/taskTypes';
import ContractorPaymentDialog from '@/features/dashboards/contractor/ContractorPaymentDialog';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

const PAYABLE_STATUSES = new Set(['Agreed']);

const formatRuble = (value: number, locale: string) =>
    new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

const resolveTaskAmount = (task: Task) =>
    Number(task.contractorPayment ?? task.totalCost ?? 0);

export default function ContractorPaymentSummary() {
    const { t, locale } = useI18n();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        async function fetchTasks() {
            try {
                const res = await fetch(withBasePath('/api/tasks'), { cache: 'no-store' });
                if (!res.ok) {
                    setError(t('tasks.error.load', 'Ошибка при загрузке задач'));
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

    const agreedTasks = useMemo(
        () => tasks.filter((task) => PAYABLE_STATUSES.has(task.status)),
        [tasks]
    );
    const payableTasks = useMemo(
        () => agreedTasks.filter((task) => !task.payment?.contractorConfirmedAt),
        [agreedTasks]
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

    const handlePaymentUpdated = (taskId: string, payment: TaskPayment | null) => {
        setTasks((prev) =>
            prev.map((task) =>
                task.taskId === taskId ? { ...task, payment: payment ?? undefined } : task
            )
        );
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
                    {t('payments.empty', 'Нет задач к оплате')}
                </Typography>
            ) : (
                <>
                    <Typography variant='body2' color='text.secondary' textAlign='center'>
                        {t('payments.payable.subtitle', 'К выплате по согласованным задачам')}
                    </Typography>
                    <Typography variant='h4' fontWeight={600} textAlign='center' sx={{ mt: 1 }}>
                        {formatRuble(totalPayable, locale)}
                        {'\u00A0'}
                        {'\u20BD'}
                    </Typography>
                    <Typography variant='body2' color='text.secondary' textAlign='center' sx={{ mt: 1 }}>
                        {t('payments.tasksCount', 'Задач: {count}', { count: payableTasks.length })}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant='body2' color='text.secondary'>
                        {t('payments.awaitingOrgMark', 'Ожидают отметки организации: {count}', {
                            count: awaitingOrgMark.length,
                        })}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {t('payments.awaitingConfirmation', 'Ожидают подтверждения: {count}', {
                            count: awaitingConfirmation.length,
                        })}
                    </Typography>
                </>
            )}

            <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button variant='text' onClick={() => setDialogOpen(true)}>
                    {t('payments.showTasks', 'Показать задачи')}
                </Button>
            </Box>

            <ContractorPaymentDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                tasks={agreedTasks}
                onPaymentUpdated={handlePaymentUpdated}
            />
        </Box>
    );
}
