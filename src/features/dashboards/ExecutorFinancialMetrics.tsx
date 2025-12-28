/* cspell:ignore Segoe */
'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { Task } from '@/app/types/taskTypes';
import { FINANCE_CONFIG } from '@/config/finance';

export default function ExecutorFinancialMetrics() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { SUM_TO_PAY_PERCENT } = FINANCE_CONFIG;
    const router = useRouter();

    useEffect(() => {
        async function fetchTasks() {
            try {
                const res = await fetch('/api/tasks');
                // Если ответ не ок — не бросаем исключение, а выставляем ошибку и выходим
                if (!res.ok) {
                    setError('Error fetching tasks');
                    return; // ← ранний выход вместо throw
                }
                const data = await res.json();
                setTasks(data.tasks);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }
        void fetchTasks(); // ← явно игнорируем промис (устраняет предупреждение линтера)
    }, []);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={100}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Typography color="error" textAlign="center">
                {error}
            </Typography>
        );
    }

    const agreedTasks = tasks.filter((t) => t.status === 'Agreed');
    const agreedCount = agreedTasks.length;
    const totalAgreed = agreedTasks.reduce((acc, t) => acc + (t.totalCost || 0), 0);
    const sumToPay = totalAgreed * SUM_TO_PAY_PERCENT;

    // Форматируем число как рубли (два знака после запятой), символ рубля выводим отдельно
    const formatRuble = (value: number) =>
        new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2, // строго 2 цифры (округлит)
        }).format(value);

    const handleClick = () => {
        router.push('/tasks?status=Agreed');
    };

    return (
        <Box textAlign="center" sx={{ mt: 4 }}>
            {agreedCount > 0 ? (
                <>
                    <Typography
                        variant="body1"
                        color="text.primary"
                        sx={{ mb: 1, cursor: 'pointer' }}
                        onClick={handleClick}
                    >
                        {`${agreedCount} ${getTaskWord(agreedCount)} pending payment for a total of:`}
                    </Typography>

                    <Typography
                        variant="h4"
                        fontWeight={600}
                        sx={{
                            cursor: 'pointer',
                            transition: 'color 0.2s ease',
                            '&:hover': { color: 'primary.dark' },

                            // Кастомный стек шрифтов
                            fontFamily: '"Roboto","Inter","Segoe UI",Arial,sans-serif',

                            fontVariantNumeric: 'tabular-nums',
                        }}
                        onClick={handleClick}
                        aria-label="Total amount to pay"
                        title="Open the list of agreed tasks"
                    >
                        {formatRuble(sumToPay)}
                        {'\u00A0'}
                        <Box
                            component="span"
                            sx={{
                                // Кастомный стек шрифтов
                                fontFamily: '"Roboto","Inter","Segoe UI",Arial,sans-serif',
                                lineHeight: 1,
                            }}
                        >
                            {'\u20BD'}
                        </Box>
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                        Shows the total cost of agreed but unpaid tasks.
                    </Typography>
                </>
            ) : (
                <Typography variant="h6" color="text.secondary">
                    No payable tasks
                </Typography>
            )}
        </Box>
    );
}

// Функция для корректного склонения "task" в английском (простая логика)
function getTaskWord(count: number): string {
    return count === 1 ? 'task' : 'tasks';
}
