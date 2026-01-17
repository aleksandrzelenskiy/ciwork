'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import { Task } from '@/app/types/taskTypes';
import { getStatusColor } from '@/utils/statusColors';
import { useRouter } from 'next/navigation';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { isAdminRole } from '@/app/utils/roleGuards';
import { getStatusLabel, STATUS_ORDER } from '@/utils/statusLabels';
import { withBasePath } from '@/utils/basePath';

interface ChartData {
  name: string;
  count: number;
}

interface TaskMetricDiagramProps {
  role: EffectiveOrgRole | null;
  clerkUserId: string;
}

interface OrgSummary {
  _id: string;
  orgSlug: string;
}

type OrgResponse = { orgs: OrgSummary[] } | { error: string };

// Обновлённый тип для элемента payload легенды
interface CustomLegendPayload {
  color?: string;
  value?: string;
  type?: string;
  payload: ChartData;
}

// Интерфейс для кастомного рендера меток в сегментах
interface CustomizedLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  payload: ChartData;
}

export default function TaskMetricDiagram({
  role,
  clerkUserId,
}: TaskMetricDiagramProps) {
  const theme = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgSlugById, setOrgSlugById] = useState<Record<string, string>>({});
  const router = useRouter();
  const shouldUseOrgRoutes = role !== null && role !== 'executor';

  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await fetch(withBasePath('/api/tasks'));
        if (!res.ok) {
          setError('Не удалось загрузить задачи');
          return;
        }
        const data = await res.json();
        setTasks(data.tasks);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, []);

  useEffect(() => {
    if (!shouldUseOrgRoutes) return;
    const controller = new AbortController();

    const fetchOrgs = async () => {
      try {
        const res = await fetch(withBasePath('/api/org'), { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as OrgResponse;
        if (!('orgs' in data) || !Array.isArray(data.orgs)) return;

        const map = data.orgs.reduce<Record<string, string>>((acc, org) => {
          acc[org._id] = org.orgSlug;
          return acc;
        }, {});
        setOrgSlugById(map);
      } catch (err: unknown) {
        if ((err as DOMException)?.name !== 'AbortError') {
          setOrgSlugById({});
        }
      }
    };

    void fetchOrgs();
    return () => controller.abort();
  }, [shouldUseOrgRoutes]);

  let tasksForMetrics = tasks;
  if (!role) {
    tasksForMetrics = tasks;
  } else if (isAdminRole(role) || role === 'manager' || role === 'viewer') {
    tasksForMetrics = tasks;
  } else if (role === 'executor') {
    tasksForMetrics = tasks.filter((t) => t.executorId === clerkUserId);
  }

  const orgTasksBase = React.useMemo(() => {
    if (!shouldUseOrgRoutes) return '/tasks';
    const taskWithProject = tasksForMetrics.find(
      (task) => task.orgId && (task.projectKey || task.projectId)
    );
    if (!taskWithProject) return null;
    const orgId = taskWithProject.orgId as string;
    const orgRef = orgSlugById[orgId] ?? orgId;
    const projectRef = taskWithProject.projectKey || taskWithProject.projectId;
    if (!orgRef || !projectRef) return null;
    return `/org/${encodeURIComponent(orgRef)}/projects/${encodeURIComponent(
      projectRef
    )}/tasks`;
  }, [orgSlugById, shouldUseOrgRoutes, tasksForMetrics]);

  if (loading) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        minHeight={100}
      >
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

  // Группируем задачи по статусам и считаем количество для каждого
  const chartData: ChartData[] = STATUS_ORDER.map((status) => {
    const filteredTasks = tasksForMetrics.filter((t) => t.status === status);
    return {
      name: status,
      count: filteredTasks.length,
    };
  });

  // Данные для легенды – все статусы с count > 0
  const legendData = chartData.filter((data) => data.count > 0);
  // Данные для диаграммы – исключаем сегмент "Agreed"
  const pieChartData = chartData.filter(
    (data) => data.count > 0 && data.name !== 'Agreed'
  );

  // Общее количество задач (с учетом всех статусов)
  const totalCount = legendData.reduce((acc, item) => acc + item.count, 0);

  // При клике на сегмент переходим на /tasks с фильтром по статусу
  const handleSegmentClick = (status: string) => {
    if (shouldUseOrgRoutes && !orgTasksBase) return;
    const base = orgTasksBase ?? '/tasks';
    router.push(`${base}?status=${encodeURIComponent(status)}`);
  };

  // Кастомный рендер меток внутри сегментов (белым цветом)
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    payload,
  }: CustomizedLabelProps) => {
    const RADIAN = Math.PI / 180;
    // Располагаем метку примерно на середине от центра до края сегмента
    const radius = outerRadius * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill='white'
        textAnchor='middle'
        dominantBaseline='central'
      >
        {payload.count}
      </text>
    );
  };

  // Кастомный рендер легенды с общим счетчиком задач перед списком
  const renderLegend = (props: { payload?: unknown[] }) => {
    const payloadTyped = props.payload as CustomLegendPayload[] | undefined;
    return (
      <div style={{ textAlign: 'center' }}>
        <Typography variant='h6' gutterBottom>
          {`Всего задач: ${totalCount}`}
        </Typography>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {payloadTyped?.map((entry) => {
            const data = entry.payload;
            const baseHref = orgTasksBase ?? '/tasks';
            const canLink = !shouldUseOrgRoutes || Boolean(orgTasksBase);
            return (
              canLink ? (
                <Link
                  key={data.name}
                  href={{ pathname: baseHref, query: { status: data.name } }}
                  style={{
                    marginRight: 10,
                    color: entry.color || theme.palette.text.primary,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {`${getStatusLabel(data.name)} (${data.count})`}
                </Link>
              ) : (
                <Typography
                  key={data.name}
                  component='span'
                  sx={{
                    marginRight: 1,
                    color: entry.color || theme.palette.text.primary,
                  }}
                >
                  {`${getStatusLabel(data.name)} (${data.count})`}
                </Typography>
              )
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Box>
      <Typography variant='h6'>Статусы задач</Typography>
      <Box width='100%' height={350}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={pieChartData}
              dataKey='count'
              nameKey='name'
              cx='50%'
              cy='50%'
              outerRadius={120}
              innerRadius={0}
              label={renderCustomizedLabel}
              labelLine={false}
            >
              {pieChartData.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={getStatusColor(entry.name)}
                  onClick={() => handleSegmentClick(entry.name)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => `${value}`}
              labelFormatter={(name) => getStatusLabel(name as string)}
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
              itemStyle={{ color: theme.palette.text.primary }}
              labelStyle={{ color: theme.palette.text.primary }}
            />
            <Legend
              payload={legendData.map((item) => ({
                color: getStatusColor(item.name),
                value: getStatusLabel(item.name),
                payload: { ...item, strokeDasharray: '' },
              }))}
              content={renderLegend}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
