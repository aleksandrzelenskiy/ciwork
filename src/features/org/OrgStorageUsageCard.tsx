'use client';

import * as React from 'react';
import {
    Box,
    Card,
    CardContent,
    CardHeader,
    CircularProgress,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import {
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';

type StorageUsagePayload = {
    totalBytes: number;
    reportBytes: number;
    attachmentBytes: number;
    limitBytes: number | null;
    readOnly: boolean;
    readOnlyReason?: string;
    updatedAt?: string;
};

type StorageUsageResponse = {
    usage: StorageUsagePayload;
};

type OrgStorageUsageCardProps = {
    orgSlug: string;
    cardSx?: SxProps<Theme>;
    cardHeaderSx?: SxProps<Theme>;
    cardContentSx?: SxProps<Theme>;
};

const COLORS = {
    reports: '#3b82f6',
    attachments: '#f97316',
    empty: '#cbd5f5',
};

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б';
    if (bytes >= GB) return `${(bytes / GB).toFixed(2)} ГБ`;
    if (bytes >= MB) return `${(bytes / MB).toFixed(1)} МБ`;
    if (bytes >= KB) return `${Math.round(bytes / KB)} КБ`;
    return `${Math.round(bytes)} Б`;
};

const isStorageUsageResponse = (
    data: StorageUsageResponse | { error?: string } | null,
): data is StorageUsageResponse => Boolean(data && 'usage' in data);

export default function OrgStorageUsageCard({
    orgSlug,
    cardSx,
    cardHeaderSx,
    cardContentSx,
}: OrgStorageUsageCardProps) {
    const [usage, setUsage] = React.useState<StorageUsagePayload | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!orgSlug) return;
        let active = true;

        const loadUsage = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/storage`, {
                    cache: 'no-store',
                });
                const data = (await res.json().catch(() => null)) as StorageUsageResponse | { error?: string } | null;
                if (!res.ok || !data || !isStorageUsageResponse(data)) {
                    if (active) {
                        setError(data && 'error' in data ? data.error ?? 'Не удалось загрузить данные' : 'Не удалось загрузить данные');
                    }
                    return;
                }
                if (active) {
                    setUsage(data.usage);
                }
            } catch (err) {
                if (active) {
                    setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void loadUsage();

        return () => {
            active = false;
        };
    }, [orgSlug]);

    const totalBytes = usage?.totalBytes ?? 0;
    const reportBytes = usage?.reportBytes ?? 0;
    const attachmentBytes = usage?.attachmentBytes ?? 0;
    const limitBytes = usage?.limitBytes ?? null;
    const remainingBytes = limitBytes ? Math.max(0, limitBytes - totalBytes) : null;
    const usagePercent = limitBytes ? Math.min(100, (totalBytes / limitBytes) * 100) : null;
    const hasUsage = totalBytes > 0;

    const breakdown = [
        { label: 'Фотоотчеты', value: reportBytes, color: COLORS.reports },
        { label: 'Вложения задач', value: attachmentBytes, color: COLORS.attachments },
    ];

    const chartData = hasUsage
        ? breakdown
        : [{ label: 'Нет данных', value: 1, color: COLORS.empty }];

    return (
        <Card variant="outlined" sx={cardSx}>
            <CardHeader
                sx={cardHeaderSx}
                avatar={<StorageOutlinedIcon fontSize="small" />}
                title="Хранилище организации"
                subheader="Фотоотчеты и вложения задач"
            />
            <CardContent sx={cardContentSx}>
                {loading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={20} />
                        <Typography>Загрузка данных о хранилище…</Typography>
                    </Stack>
                ) : error ? (
                    <Typography color="error">{error}</Typography>
                ) : (
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={3}
                        alignItems={{ xs: 'stretch', md: 'center' }}
                    >
                        <Box sx={{ width: { xs: '100%', md: 260 }, height: 220 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        dataKey="value"
                                        nameKey="label"
                                        innerRadius={65}
                                        outerRadius={90}
                                        paddingAngle={hasUsage ? 4 : 0}
                                    >
                                        {chartData.map((entry) => (
                                            <Cell
                                                key={entry.label}
                                                fill={entry.color}
                                                stroke="transparent"
                                            />
                                        ))}
                                    </Pie>
                                    {hasUsage && (
                                        <Tooltip
                                            formatter={(value: number) => formatBytes(value)}
                                            labelFormatter={(label) => String(label)}
                                        />
                                    )}
                                </PieChart>
                            </ResponsiveContainer>
                        </Box>
                        <Stack spacing={1.5} sx={{ flex: 1 }}>
                            <Stack spacing={0.5}>
                                <Typography variant="overline" color="text.secondary">
                                    Использовано
                                </Typography>
                                <Typography variant="h5" fontWeight={700}>
                                    {formatBytes(totalBytes)}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {limitBytes
                                        ? `Лимит тарифа ${formatBytes(limitBytes)}, свободно ${formatBytes(remainingBytes ?? 0)}`
                                        : 'Лимит не задан'}
                                </Typography>
                            </Stack>
                            {limitBytes && (
                                <Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={usagePercent ?? 0}
                                        sx={{ height: 8, borderRadius: 999 }}
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                        {`${usagePercent?.toFixed(1) ?? '0.0'}% от лимита`}
                                    </Typography>
                                </Box>
                            )}
                            <Stack spacing={1}>
                                {breakdown.map((item) => {
                                    const percent = totalBytes > 0 ? (item.value / totalBytes) * 100 : 0;
                                    return (
                                        <Stack
                                            key={item.label}
                                            direction="row"
                                            spacing={1}
                                            alignItems="center"
                                            justifyContent="space-between"
                                        >
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Box
                                                    sx={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: '50%',
                                                        backgroundColor: item.color,
                                                    }}
                                                />
                                                <Typography variant="body2">{item.label}</Typography>
                                            </Stack>
                                            <Typography variant="body2" color="text.secondary">
                                                {`${formatBytes(item.value)} · ${percent.toFixed(1)}%`}
                                            </Typography>
                                        </Stack>
                                    );
                                })}
                            </Stack>
                            {usage?.readOnly && (
                                <Typography variant="caption" color="error">
                                    {usage.readOnlyReason
                                        ? `Доступ только чтение: ${usage.readOnlyReason}`
                                        : 'Доступ только чтение: недостаточно средств'}
                                </Typography>
                            )}
                        </Stack>
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
}
