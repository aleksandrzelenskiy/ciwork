'use client';

import React from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Link from 'next/link';
import type { DocumentReviewClient } from '@/app/types/documentReviewTypes';
import { getStatusLabel } from '@/utils/statusLabels';
import { useI18n } from '@/i18n/I18nProvider';

const isPdf = (url: string) => url.toLowerCase().endsWith('.pdf');

type DocumentReviewTaskPanelProps = {
    taskId: string;
};

export default function DocumentReviewTaskPanel({ taskId }: DocumentReviewTaskPanelProps) {
    const { t } = useI18n();
    const [review, setReview] = React.useState<DocumentReviewClient | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [refreshing, setRefreshing] = React.useState(false);

    const loadReview = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/document-reviews/${encodeURIComponent(taskId)}`);
            const data = (await res.json().catch(() => null)) as (DocumentReviewClient & { error?: string }) | null;
            if (!res.ok || !data || data.error) {
                setError(data?.error || 'Не удалось загрузить документацию');
                return;
            }
            setReview(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить документацию');
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    React.useEffect(() => {
        void loadReview();
    }, [loadReview]);

    const refresh = async () => {
        setRefreshing(true);
        await loadReview();
        setRefreshing(false);
    };

    if (loading) {
        return <LinearProgress sx={{ borderRadius: 1 }} />;
    }

    if (error || !review) {
        return <Alert severity="error">{error || 'Не удалось загрузить документацию'}</Alert>;
    }

    const currentFiles = review.publishedFiles ?? [];
    const currentPdf = currentFiles.find(isPdf) ?? currentFiles[0] ?? '';

    return (
        <Stack spacing={1.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                        {t('tasks.fields.status', 'Статус')}: {getStatusLabel(review.status, t)}
                    </Typography>
                <Chip size="small" label={`Версия ${review.currentVersion || 0}`} />
                <Box sx={{ flexGrow: 1 }} />
                <Button
                    size="small"
                    variant="outlined"
                    component={Link}
                    href={`/documents/${encodeURIComponent(taskId.toLowerCase())}`}
                    endIcon={<OpenInNewIcon />}
                >
                    Перейти к согласованию
                </Button>
                <Button size="small" variant="text" onClick={refresh} disabled={refreshing}>
                    Обновить
                </Button>
            </Stack>

            <Divider />

            {currentFiles.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    Файлы пока не загружены. Загрузка и согласование доступны на отдельной странице.
                </Typography>
            ) : (
                <Stack spacing={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                        Текущий пакет: {currentFiles.length} файлов
                    </Typography>
                    {currentPdf && (
                        <Typography variant="caption" color="text.secondary">
                            PDF для просмотра доступен на странице согласования.
                        </Typography>
                    )}
                </Stack>
            )}
        </Stack>
    );
}
