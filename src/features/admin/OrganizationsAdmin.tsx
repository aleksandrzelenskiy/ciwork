'use client';

import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    IconButton,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';

type Plan = 'basic' | 'pro' | 'business' | 'enterprise';
type SubStatus = 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';

type OrganizationRow = {
    orgId: string;
    name: string;
    orgSlug: string;
    ownerEmail?: string;
    plan: Plan;
    status: SubStatus;
    seats?: number;
    projectsLimit?: number;
    publicTasksLimit?: number;
    tasksWeeklyLimit?: number;
    boostCredits?: number;
    storageLimitGb?: number;
    walletBalance?: number;
    walletCurrency?: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    note?: string;
    updatedAt?: string | null;
    createdAt?: string | null;
};

type AdminSubscriptionPayload = {
    orgSlug: string;
    plan: Plan;
    status: SubStatus;
    seats?: number;
    projectsLimit?: number;
    publicTasksLimit?: number;
    tasksWeeklyLimit?: number;
    boostCredits?: number;
    storageLimitGb?: number;
    periodStart?: string | null;
    periodEnd?: string | null;
    note?: string;
    updatedByEmail?: string;
    updatedAt: string | null;
};

const PLAN_OPTIONS: Array<{ value: Plan; label: string }> = [
    { value: 'basic', label: 'Basic' },
    { value: 'pro', label: 'Pro' },
    { value: 'business', label: 'Business' },
    { value: 'enterprise', label: 'Enterprise' },
];

const STATUS_OPTIONS: Array<{ value: SubStatus; label: string }> = [
    { value: 'active', label: 'Подписка активна' },
    { value: 'trial', label: 'Пробный период' },
    { value: 'inactive', label: 'Неактивна' },
    { value: 'past_due', label: 'Просрочка оплаты' },
    { value: 'suspended', label: 'Приостановлена' },
];

const STATUS_COLOR_MAP: Record<SubStatus, 'success' | 'info' | 'default' | 'warning' | 'error'> = {
    active: 'success',
    trial: 'info',
    inactive: 'default',
    past_due: 'error',
    suspended: 'warning',
};

const formatDate = (value?: string | null): string => {
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

export default function OrganizationsAdmin() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const [organizations, setOrganizations] = React.useState<OrganizationRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [selectedOrg, setSelectedOrg] = React.useState<OrganizationRow | null>(null);
    const [selectedPlan, setSelectedPlan] = React.useState<Plan>('basic');
    const [selectedStatus, setSelectedStatus] = React.useState<SubStatus>('inactive');
    const [walletTopUpInput, setWalletTopUpInput] = React.useState('0');
    const [dialogError, setDialogError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [orgToDelete, setOrgToDelete] = React.useState<OrganizationRow | null>(null);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [deleting, setDeleting] = React.useState(false);

    const fetchOrganizations = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/organizations', { cache: 'no-store' });
            const payload = (await response.json().catch(() => null)) as
                | { organizations?: OrganizationRow[]; error?: string }
                | null;

            if (!response.ok || !payload || !payload.organizations) {
                const message = payload?.error || 'Не удалось загрузить организации';
                setError(message);
                return;
            }

            setOrganizations(payload.organizations);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Сервер не ответил';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void fetchOrganizations();
    }, [fetchOrganizations]);

    const handleOpenDialog = (org: OrganizationRow) => {
        setSelectedOrg(org);
        setSelectedPlan(org.plan);
        setSelectedStatus(org.status);
        setWalletTopUpInput('0');
        setDialogError(null);
    };

    const handleCloseDialog = () => {
        if (saving) return;
        setSelectedOrg(null);
        setDialogError(null);
    };

    const handleOpenDelete = (org: OrganizationRow) => {
        setOrgToDelete(org);
        setDeleteError(null);
    };

    const handleCloseDelete = () => {
        if (deleting) return;
        setOrgToDelete(null);
        setDeleteError(null);
    };

    const handleDelete = async () => {
        if (!orgToDelete) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const response = await fetch(
                `/api/admin/organizations/${encodeURIComponent(orgToDelete.orgSlug)}`,
                { method: 'DELETE' }
            );
            const payload = (await response.json().catch(() => null)) as
                | { ok?: true; error?: string }
                | null;

            if (!response.ok || !payload || !payload.ok) {
                const message = payload?.error || 'Не удалось удалить организацию';
                setDeleteError(message);
                return;
            }

            setOrganizations((prev) =>
                prev.filter((item) => item.orgSlug !== orgToDelete.orgSlug)
            );
            setOrgToDelete(null);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Ошибка удаления';
            setDeleteError(message);
        } finally {
            setDeleting(false);
        }
    };

    const handleApply = async () => {
        if (!selectedOrg) return;
        setSaving(true);
        setDialogError(null);
        try {
            const topUpAmount = Number(walletTopUpInput);
            if (Number.isFinite(topUpAmount) && topUpAmount > 0) {
                const walletRes = await fetch(
                    `/api/admin/organizations/${encodeURIComponent(selectedOrg.orgSlug)}/wallet`,
                    {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ delta: topUpAmount }),
                    }
                );
                if (!walletRes.ok) {
                    const walletPayload = (await walletRes.json().catch(() => null)) as
                        | { error?: string }
                        | null;
                    const message = walletPayload?.error || 'Не удалось обновить баланс';
                    setDialogError(message);
                    setSaving(false);
                    return;
                }
            }
            const response = await fetch(
                `/api/admin/organizations/${encodeURIComponent(selectedOrg.orgSlug)}/subscription`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plan: selectedPlan,
                        status: selectedStatus,
                    }),
                }
            );
            type UpdateResponse =
                | { ok?: true; subscription?: AdminSubscriptionPayload; error?: string }
                | null;

            const payload = (await response.json().catch(() => null)) as UpdateResponse;

            if (!response.ok || !payload || !payload.ok || !payload.subscription) {
                const message = payload?.error || 'Не удалось сохранить изменения';
                setDialogError(message);
                return;
            }

            setOrganizations((prev) =>
                prev.map((item) =>
                    item.orgSlug === payload.subscription?.orgSlug
                        ? {
                              ...item,
                              plan: payload.subscription.plan,
                              status: payload.subscription.status,
                              seats: payload.subscription.seats,
                              projectsLimit: payload.subscription.projectsLimit,
                              publicTasksLimit: payload.subscription.publicTasksLimit,
                              tasksWeeklyLimit: payload.subscription.tasksWeeklyLimit,
                              periodStart: payload.subscription.periodStart,
                              periodEnd: payload.subscription.periodEnd,
                              updatedAt: payload.subscription.updatedAt,
                              walletBalance:
                                  (item.walletBalance ?? 0) +
                                  (Number.isFinite(topUpAmount) && topUpAmount > 0
                                      ? topUpAmount
                                      : 0),
                          }
                        : item
                )
            );
            handleCloseDialog();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Ошибка обновления';
            setDialogError(message);
        } finally {
            setSaving(false);
        }
    };

    const statusChip = (status: SubStatus) => (
        <Chip
            label={STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status}
            color={STATUS_COLOR_MAP[status]}
            size="small"
            variant="outlined"
        />
    );

    const containerSx = {
        backgroundColor: isDarkMode ? 'rgba(15,23,42,0.8)' : '#fff',
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}`,
        borderRadius: 3,
        boxShadow: isDarkMode
            ? '0 40px 90px rgba(0,0,0,0.55)'
            : '0 40px 80px rgba(15,23,42,0.15)',
    } as const;

    return (
        <Box sx={{ px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 }, minHeight: '100vh' }}>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems="flex-start"
                justifyContent="space-between"
                sx={{ mb: 3 }}
            >
                <Stack spacing={0.5}>
                    <Typography variant="h5" fontWeight={700}>
                        Администрирование организаций
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                        Просматривайте текущий статус подписки и изменяйте тариф для любой организации.
                    </Typography>
                </Stack>
                <Button
                    variant="outlined"
                    onClick={() => void fetchOrganizations()}
                    disabled={loading}
                >
                    {loading ? 'Обновляем…' : 'Обновить список'}
                </Button>
            </Stack>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Paper elevation={0} sx={{ ...containerSx, overflow: 'hidden' }}>
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Организация</TableCell>
                                <TableCell>Владелец</TableCell>
                                <TableCell>Тариф</TableCell>
                                <TableCell>Статус</TableCell>
                                <TableCell>Лимиты</TableCell>
                                <TableCell>Баланс</TableCell>
                                <TableCell>Последнее обновление</TableCell>
                                <TableCell align="right">Действия</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center">
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            alignItems="center"
                                            justifyContent="center"
                                        >
                                            <CircularProgress size={20} />
                                            <Typography>Загрузка …</Typography>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ) : organizations.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center">
                                        Нет зарегистрированных организаций
                                    </TableCell>
                                </TableRow>
                            ) : (
                                organizations.map((org) => (
                                    <TableRow key={org.orgId} hover>
                                        <TableCell>
                                            <Typography fontWeight={600}>{org.name || '—'}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {org.orgSlug}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {org.ownerEmail || '—'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography fontWeight={600}>{org.plan.toUpperCase()}</Typography>
                                        </TableCell>
                                        <TableCell>{statusChip(org.status)}</TableCell>
                                        <TableCell>
                                            <Stack spacing={0.25}>
                                                <Typography variant="body2">
                                                    Рабочие места: {org.seats ?? '—'}
                                                </Typography>
                                                <Typography variant="body2">
                                                    Проекты: {org.projectsLimit ?? '—'}
                                                </Typography>
                                                <Typography variant="body2">
                                                    Публикации: {org.publicTasksLimit ?? '—'} ·
                                                    Задачи/нед: {org.tasksWeeklyLimit ?? '—'}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            {Number.isFinite(org.walletBalance)
                                                ? `${org.walletBalance} ${org.walletCurrency || 'RUB'}`
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            {formatDate(org.updatedAt)}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Tooltip title="Изменить">
                                                    <IconButton
                                                        color="primary"
                                                        size="small"
                                                        onClick={() => handleOpenDialog(org)}
                                                    >
                                                        <EditOutlined fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Удалить">
                                                    <IconButton
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleOpenDelete(org)}
                                                    >
                                                        <DeleteOutline fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Dialog open={Boolean(selectedOrg)} onClose={handleCloseDialog} fullWidth maxWidth="sm">
                <DialogTitle>Изменить тариф</DialogTitle>
                <DialogContent dividers>
                    {selectedOrg ? (
                        <Stack spacing={2}>
                            <Typography variant="subtitle1">
                                {selectedOrg.name} · {selectedOrg.orgSlug}
                            </Typography>
                            <FormControl fullWidth size="small">
                                <InputLabel id="admin-plan-label">Тариф</InputLabel>
                                <Select
                                    labelId="admin-plan-label"
                                    label="Тариф"
                                    value={selectedPlan}
                                    onChange={(event) =>
                                        setSelectedPlan(event.target.value as Plan)
                                    }
                                >
                                    {PLAN_OPTIONS.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel id="admin-status-label">Статус</InputLabel>
                                <Select
                                    labelId="admin-status-label"
                                    label="Статус"
                                    value={selectedStatus}
                                    onChange={(event) =>
                                        setSelectedStatus(event.target.value as SubStatus)
                                    }
                                >
                                    {STATUS_OPTIONS.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Typography variant="body2" color="text.secondary">
                                Текущий баланс:{' '}
                                {Number.isFinite(selectedOrg.walletBalance)
                                    ? `${selectedOrg.walletBalance} ${selectedOrg.walletCurrency || 'RUB'}`
                                    : '—'}
                            </Typography>
                            <TextField
                                label="Сумма пополнения (RUB)"
                                type="number"
                                value={walletTopUpInput}
                                onChange={(event) => setWalletTopUpInput(event.target.value)}
                                size="small"
                                inputProps={{ min: 1, step: 1 }}
                            />
                            {dialogError && <Alert severity="error">{dialogError}</Alert>}
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} disabled={saving}>
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleApply}
                        disabled={saving}
                        startIcon={
                            saving ? <CircularProgress size={16} color="inherit" /> : null
                        }
                    >
                        {saving ? 'Сохраняем…' : 'Применить'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(orgToDelete)}
                onClose={handleCloseDelete}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>Удалить организацию?</DialogTitle>
                <DialogContent dividers>
                    {orgToDelete ? (
                        <Stack spacing={1.5}>
                            <Typography variant="subtitle1">
                                {orgToDelete.name} · {orgToDelete.orgSlug}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Организация, ее проекты, задачи и связанные данные будут удалены без возможности восстановления.
                            </Typography>
                            {deleteError && <Alert severity="error">{deleteError}</Alert>}
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDelete} disabled={deleting}>
                        Отмена
                    </Button>
                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleDelete}
                        disabled={deleting}
                        startIcon={
                            deleting ? <CircularProgress size={16} color="inherit" /> : null
                        }
                    >
                        {deleting ? 'Удаляем…' : 'Удалить'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
