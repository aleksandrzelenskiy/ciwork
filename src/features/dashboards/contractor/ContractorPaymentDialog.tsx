'use client';

import React, { useMemo, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    List,
    ListItem,
    ListItemText,
    Typography,
} from '@mui/material';
import type { Task, TaskPayment } from '@/app/types/taskTypes';
import { useI18n } from '@/i18n/I18nProvider';

interface ContractorPaymentDialogProps {
    open: boolean;
    onClose: () => void;
    tasks: Task[];
    onPaymentUpdated: (taskId: string, payment: TaskPayment | null) => void;
}

const formatRuble = (value: number, locale: string) =>
    new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

const resolveTaskAmount = (task: Task) =>
    Number(task.contractorPayment ?? task.totalCost ?? 0);

const resolvePaymentStatus = (payment: TaskPayment | null | undefined, t: (key: string, fallback?: string, params?: Record<string, string | number>) => string): string => {
    if (payment?.contractorConfirmedAt) return t('payments.status.confirmed', 'Оплата подтверждена');
    if (payment?.orgMarkedPaidAt) return t('payments.status.marked', 'Организация отметила оплату');
    return t('payments.status.awaitingOrg', 'Ожидает отметки организации');
};

export default function ContractorPaymentDialog({
    open,
    onClose,
    tasks,
    onPaymentUpdated,
}: ContractorPaymentDialogProps) {
    const { t, locale } = useI18n();
    const [confirmingTaskId, setConfirmingTaskId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const sortedTasks = useMemo(
        () =>
            [...tasks].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() -
                    new Date(a.createdAt).getTime()
            ),
        [tasks]
    );

    const handleConfirm = async () => {
        if (!confirmingTaskId) return;
        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch(
                `/api/tasks/${encodeURIComponent(confirmingTaskId)}/payment`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'confirm_paid' }),
                }
            );

            if (!res.ok) {
                const payload = await res.json().catch(() => ({}));
                setError(payload.error || t('payments.error.confirm', 'Не удалось подтвердить оплату'));
                return;
            }

            const payload = await res.json();
            onPaymentUpdated(confirmingTaskId, payload.payment || null);
            setConfirmingTaskId(null);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : t('common.error.unknown', 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
                <DialogTitle>{t('payments.dialog.title', 'Согласованные задачи')}</DialogTitle>
                <DialogContent dividers>
                    {tasks.length === 0 ? (
                        <Typography color='text.secondary'>
                            {t('payments.dialog.empty', 'Нет задач в статусе «Согласовано».')}
                        </Typography>
                    ) : (
                        <List dense>
                            {sortedTasks.map((task) => {
                                const amount = resolveTaskAmount(task);
                                const statusLabel = resolvePaymentStatus(task.payment, t);
                                const canConfirm =
                                    Boolean(task.payment?.orgMarkedPaidAt) &&
                                    !task.payment?.contractorConfirmedAt;
                                return (
                                    <React.Fragment key={task.taskId}>
                                        <ListItem
                                            secondaryAction={
                                                canConfirm ? (
                                                    <Button
                                                        size='small'
                                                        variant='outlined'
                                                        onClick={() => setConfirmingTaskId(task.taskId)}
                                                    >
                                                        {t('payments.actions.confirm', 'Подтвердить оплату')}
                                                    </Button>
                                                ) : null
                                            }
                                        >
                                            <ListItemText
                                                primary={task.taskName}
                                                secondary={
                                                    <Box sx={{ mt: 0.5 }}>
                                                        <Typography variant='caption' display='block'>
                                                            {task.taskId}
                                                        </Typography>
                                                        <Typography variant='caption' display='block'>
                                                            {statusLabel}
                                                        </Typography>
                                                        <Typography variant='caption' display='block'>
                                                            {t('payments.amount', 'Сумма: {amount} ₽', {
                                                                amount: formatRuble(amount, locale),
                                                            })}
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </ListItem>
                                        <Divider component='li' />
                                    </React.Fragment>
                                );
                            })}
                        </List>
                    )}
                    {error && (
                        <Typography color='error' sx={{ mt: 2 }}>
                            {error}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>{t('common.close', 'Закрыть')}</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(confirmingTaskId)}
                onClose={() => (submitting ? null : setConfirmingTaskId(null))}
                maxWidth='xs'
                fullWidth
            >
                <DialogTitle>{t('payments.confirm.title', 'Подтверждение оплаты')}</DialogTitle>
                <DialogContent dividers>
                    <Typography>
                        {t('payments.confirm.body', 'Подтвердить получение оплаты по задаче?')}
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setConfirmingTaskId(null)}
                        disabled={submitting}
                    >
                        {t('common.cancel', 'Отмена')}
                    </Button>
                    <Button
                        variant='contained'
                        onClick={() => void handleConfirm()}
                        disabled={submitting}
                    >
                        {t('common.confirm', 'Подтвердить')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
