'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Task } from '@/app/types/taskTypes';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { FINANCE_CONFIG } from '@/config/finance';

export default function FinancialMetrics() {
  const theme = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllTasks() {
      try {
        const res = await fetch('/api/tasks');
        if (!res.ok) {
          setError('Не удалось загрузить задачи');
          return;
        }
        const data = await res.json();
        setTasks(data.tasks);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchAllTasks();
  }, []);

  if (loading) {
    return (
        <Box display='flex' justifyContent='center' alignItems='center' minHeight={100}>
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

  // Фильтруем задачи со статусом "Agreed"
  const agreedTasks = tasks.filter((t) => t.status === 'Agreed');

  // Общая сумма totalCost для задач со статусом "Agreed"
  const totalAgreed = agreedTasks.reduce((acc, t) => acc + (t.totalCost || 0), 0);

  // Используем коэффициенты из FINANCE_CONFIG
  const { COMMISSION_PERCENT, SUM_TO_PAY_PERCENT, TAX_PERCENT_OF_REMAINING } = FINANCE_CONFIG;

  // Комиссия
  const commission = totalAgreed * COMMISSION_PERCENT;

  // Оплата
  const sumToPay = totalAgreed * SUM_TO_PAY_PERCENT;

  // Налог
  const tax = (totalAgreed * (1 - COMMISSION_PERCENT)) * TAX_PERCENT_OF_REMAINING;

  // Маржа
  const profit = totalAgreed - (commission + sumToPay + tax);

  // Подготавливаем данные для диаграммы
  const chartData = [
    { name: 'К выплате', value: sumToPay, color: '#0088FE' },
    { name: 'Комиссия', value: commission, color: '#B3B3B3' },
    { name: 'Налог', value: tax, color: '#FFBB28' },
    { name: 'Маржа', value: profit, color: '#388E3C' },
  ];

  const COLORS = chartData.map((c) => c.color);

  // Форматирование суммы
  const formatRuble = (value: number) => {
    const num = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${num}\u00A0\u20BD`; // неразрывный пробел + ₽
  };


  // Форматирование процента
  const formatPercent = (value: number) => ((value / totalAgreed) * 100).toFixed(1) + '%';

  type PieLabelProps = {
    x?: number;
    y?: number;
    name?: string;
    value?: number;
    textAnchor?: string;
    dominantBaseline?: string;
  };

  const renderChartLabel = (props: PieLabelProps) => {
    if (props.x == null || props.y == null || props.value == null || !props.name) {
      return null;
    }
    return (
      <text
        x={props.x}
        y={props.y}
        textAnchor={props.textAnchor ?? 'middle'}
        dominantBaseline={props.dominantBaseline ?? 'central'}
        fill={theme.palette.text.primary}
        style={{ fontSize: 12, fontWeight: 500 }}
      >
        {`${props.name}: ${formatPercent(props.value)}`}
      </text>
    );
  };

  return (
      <Box>
        <Typography variant='h6' sx={{ mb: 2 }}>
          Финансовые показатели
        </Typography>

        <Box width="100%" height={400} sx={{ fontFamily: '"Roboto","Inter","Segoe UI",Arial,sans-serif' }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={90}
                  labelLine={false}
                  label={renderChartLabel} // тут только проценты, без ₽
              >
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>

              {/* Текст в центре диаграммы */}
              <text
                  x="50%"
                  y="47.5%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={theme.palette.text.primary}
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    fontFamily: '"Roboto","Inter","Segoe UI",Arial,sans-serif',
                  }}
              >
                {formatRuble(totalAgreed)}
              </text>

              <Tooltip
                  formatter={(value: number, name: string) => [
                    `${formatRuble(value)} (${formatPercent(value)})`,
                    name,
                  ]}
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                    color: theme.palette.text.primary,
                  }}
                  itemStyle={{ color: theme.palette.text.primary }}
                  labelStyle={{ color: theme.palette.text.primary }}
              />

              <Legend wrapperStyle={{ color: theme.palette.text.primary }} />
            </PieChart>
          </ResponsiveContainer>
        </Box>

      </Box>
  );
}
