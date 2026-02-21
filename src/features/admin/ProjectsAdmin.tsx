'use client';

import * as React from 'react';
import Link from 'next/link';
import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';

import { UI_RADIUS } from '@/config/uiTokens';
import { withBasePath } from '@/utils/basePath';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';

type AdminProjectRow = {
    _id: string;
    orgId: string;
    orgName?: string;
    orgSlug?: string;
    name: string;
    key: string;
    projectType?: 'installation' | 'document';
    regionCode?: string;
    operator?: string;
    managers?: string[];
    createdByEmail?: string;
    createdAt?: string;
    updatedAt?: string;
};

const PROJECT_TYPE_LABELS: Record<NonNullable<AdminProjectRow['projectType']>, string> = {
    installation: 'Монтажный',
    document: 'Документационный',
};

const REGION_LABELS = new Map(RUSSIAN_REGIONS.map((region) => [region.code, region.label]));
const OPERATOR_LABELS = new Map(OPERATORS.map((operator) => [operator.value, operator.label]));

const formatDate = (value?: string): string => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function ProjectsAdmin() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const [items, setItems] = React.useState<AdminProjectRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const headerBg = isDarkMode ? 'rgba(17,22,33,0.85)' : 'rgba(255,255,255,0.55)';
    const headerBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
    const headerShadow = isDarkMode ? '0 25px 70px rgba(0,0,0,0.55)' : '0 25px 80px rgba(15,23,42,0.1)';
    const sectionBg = isDarkMode ? 'rgba(18,24,36,0.85)' : 'rgba(255,255,255,0.65)';
    const sectionBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)';
    const sectionShadow = isDarkMode ? '0 35px 90px rgba(0,0,0,0.5)' : '0 35px 90px rgba(15,23,42,0.15)';
    const textPrimary = isDarkMode ? '#f8fafc' : '#0f172a';
    const textSecondary = isDarkMode ? 'rgba(226,232,240,0.8)' : 'rgba(15,23,42,0.7)';
    const iconBorderColor = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.12)';
    const iconBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
    const iconHoverBg = isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)';
    const iconShadow = isDarkMode ? '0 6px 18px rgba(0,0,0,0.4)' : '0 6px 18px rgba(15,23,42,0.08)';
    const tableBg = isDarkMode ? 'rgba(10,13,20,0.92)' : '#ffffff';
    const headBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(248,250,252,0.95)';
    const cellBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
    const tableShadow = isDarkMode ? '0 25px 70px rgba(0,0,0,0.55)' : '0 20px 50px rgba(15,23,42,0.12)';

    const fetchProjects = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(withBasePath('/api/admin/projects'), { cache: 'no-store' });
            const payload = (await response.json().catch(() => null)) as
                | { projects?: AdminProjectRow[]; error?: string }
                | null;

            if (!response.ok || !payload || !payload.projects) {
                setError(payload?.error || 'Не удалось загрузить проекты');
                return;
            }

            setItems(payload.projects);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Сервер не ответил');
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void fetchProjects();
    }, [fetchProjects]);

    return (
        <Box sx={{ minHeight: '100%', py: { xs: 4, md: 6 }, px: { xs: 0.25, md: 6 } }}>
            <Box sx={{ maxWidth: 1320, mx: 'auto', width: '100%' }}>
                <Box
                    sx={{
                        mb: 3,
                        borderRadius: UI_RADIUS.surface,
                        p: { xs: 2, md: 3 },
                        backgroundColor: headerBg,
                        border: `1px solid ${headerBorder}`,
                        boxShadow: headerShadow,
                        backdropFilter: 'blur(22px)',
                    }}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Box>
                            <Typography
                                variant="h5"
                                fontWeight={700}
                                color={textPrimary}
                                sx={{ fontSize: { xs: '1.6rem', md: '1.95rem' } }}
                            >
                                Проекты организаций
                            </Typography>
                            <Typography
                                variant="body2"
                                color={textSecondary}
                                sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, mt: 0.5 }}
                            >
                                {loading ? 'Загружаем проекты...' : `Всего проектов: ${items.length}.`}
                            </Typography>
                            {error && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                                    {error}
                                </Typography>
                            )}
                        </Box>
                        <Tooltip title="Обновить">
                            <span>
                                <IconButton
                                    onClick={() => void fetchProjects()}
                                    disabled={loading}
                                    sx={{
                                        borderRadius: UI_RADIUS.overlay,
                                        border: `1px solid ${iconBorderColor}`,
                                        backgroundColor: iconBg,
                                        color: textPrimary,
                                        boxShadow: iconShadow,
                                        backdropFilter: 'blur(14px)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            backgroundColor: iconHoverBg,
                                        },
                                    }}
                                >
                                    <RefreshIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                </Box>

                <Paper
                    variant="outlined"
                    sx={{
                        p: { xs: 2, md: 3 },
                        borderRadius: UI_RADIUS.surface,
                        border: `1px solid ${sectionBorder}`,
                        backgroundColor: sectionBg,
                        boxShadow: sectionShadow,
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}
                    <TableContainer sx={{ borderRadius: UI_RADIUS.panel, boxShadow: tableShadow, bgcolor: tableBg }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow sx={{ '& th': { bgcolor: headBg, borderColor: cellBorder } }}>
                                    <TableCell>Проект</TableCell>
                                    <TableCell>Организация</TableCell>
                                    <TableCell>Тип</TableCell>
                                    <TableCell>Регион / Оператор</TableCell>
                                    <TableCell>Менеджеры</TableCell>
                                    <TableCell>Создал</TableCell>
                                    <TableCell>Обновлен</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                                                <CircularProgress size={20} />
                                                <Typography>Загрузка …</Typography>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ) : items.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            Проекты не найдены
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((project) => {
                                        const orgProjectHref =
                                            project.orgSlug && project.key
                                                ? `/org/${encodeURIComponent(project.orgSlug)}/projects/${encodeURIComponent(project.key)}`
                                                : null;
                                        const regionLabel = project.regionCode
                                            ? REGION_LABELS.get(project.regionCode) || project.regionCode
                                            : '—';
                                        const operatorLabel = project.operator
                                            ? OPERATOR_LABELS.get(project.operator) || project.operator
                                            : '—';

                                        return (
                                            <TableRow
                                                key={project._id}
                                                hover
                                                sx={{
                                                    '& td': { borderColor: cellBorder },
                                                    '&:hover': {
                                                        backgroundColor: isDarkMode
                                                            ? 'rgba(255,255,255,0.08)'
                                                            : '#fffde7',
                                                    },
                                                }}
                                            >
                                                <TableCell>
                                                    {orgProjectHref ? (
                                                        <Link href={orgProjectHref}>
                                                            {project.name || project.key || '—'}
                                                        </Link>
                                                    ) : (
                                                        project.name || project.key || '—'
                                                    )}
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                        {project.key || '—'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{project.orgName || '—'}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {project.orgSlug || '—'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={
                                                            project.projectType
                                                                ? PROJECT_TYPE_LABELS[project.projectType]
                                                                : '—'
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{regionLabel}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {operatorLabel}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>{project.managers?.length ? project.managers.join(', ') : '—'}</TableCell>
                                                <TableCell>{project.createdByEmail || '—'}</TableCell>
                                                <TableCell>{formatDate(project.updatedAt || project.createdAt)}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            </Box>
        </Box>
    );
}
