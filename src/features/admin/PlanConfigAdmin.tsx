'use client';

import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Paper,
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
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';

type PlanCode = 'basic' | 'pro' | 'business' | 'enterprise';

type PlanConfig = {
    plan: PlanCode;
    title: string;
    priceRubMonthly: number;
    projectsLimit: number | null;
    seatsLimit: number | null;
    tasksWeeklyLimit: number | null;
    publicTasksMonthlyLimit: number | null;
    storageIncludedGb: number | null;
    storageOverageRubPerGbMonth: number;
    storagePackageGb: number | null;
    storagePackageRubMonthly: number | null;
    features: string[];
};

type PlanResponse = { plans: PlanConfig[] } | { error: string };
type BillingConfig = { taskPublishCostRub: number; bidCostRub: number };
type BillingResponse = { config: BillingConfig } | { error: string };

const formatLimit = (value: number | null) => (typeof value === 'number' ? value : '—');

export default function PlanConfigAdmin() {
    const [plans, setPlans] = React.useState<PlanConfig[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [selected, setSelected] = React.useState<PlanConfig | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [dialogError, setDialogError] = React.useState<string | null>(null);
    const [planToDelete, setPlanToDelete] = React.useState<PlanConfig | null>(null);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [deleting, setDeleting] = React.useState(false);
    const [billingConfig, setBillingConfig] = React.useState<BillingConfig | null>(null);
    const [billingLoading, setBillingLoading] = React.useState(true);
    const [billingError, setBillingError] = React.useState<string | null>(null);
    const [billingSaving, setBillingSaving] = React.useState(false);

    const loadPlans = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/plans', { cache: 'no-store' });
            const payload = (await res.json().catch(() => null)) as PlanResponse | null;
            if (!res.ok || !payload || !('plans' in payload)) {
                setError(payload && 'error' in payload ? payload.error ?? 'Не удалось загрузить тарифы' : 'Не удалось загрузить тарифы');
                return;
            }
            setPlans(payload.plans);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось загрузить тарифы');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadBillingConfig = React.useCallback(async () => {
        setBillingLoading(true);
        setBillingError(null);
        try {
            const res = await fetch('/api/admin/billing', { cache: 'no-store' });
            const payload = (await res.json().catch(() => null)) as BillingResponse | null;
            if (!res.ok || !payload || !('config' in payload)) {
                setBillingError(payload && 'error' in payload ? payload.error ?? 'Не удалось загрузить настройки' : 'Не удалось загрузить настройки');
                return;
            }
            setBillingConfig(payload.config);
        } catch (err) {
            setBillingError(err instanceof Error ? err.message : 'Не удалось загрузить настройки');
        } finally {
            setBillingLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadPlans();
        void loadBillingConfig();
    }, [loadPlans, loadBillingConfig]);

    const saveBillingConfig = async () => {
        if (!billingConfig) return;
        setBillingSaving(true);
        setBillingError(null);
        try {
            const res = await fetch('/api/admin/billing', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(billingConfig),
            });
            const payload = (await res.json().catch(() => null)) as BillingResponse | null;
            if (!res.ok || !payload || !('config' in payload)) {
                setBillingError(payload && 'error' in payload ? payload.error ?? 'Не удалось сохранить настройки' : 'Не удалось сохранить настройки');
                return;
            }
            setBillingConfig(payload.config);
        } catch (err) {
            setBillingError(err instanceof Error ? err.message : 'Не удалось сохранить настройки');
        } finally {
            setBillingSaving(false);
        }
    };

    const handleOpen = (plan: PlanConfig) => {
        setSelected({ ...plan });
        setDialogError(null);
    };

    const handleClose = () => {
        if (saving) return;
        setSelected(null);
        setDialogError(null);
    };

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        setDialogError(null);
        try {
            const res = await fetch('/api/admin/plans', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...selected,
                    features: selected.features.filter(Boolean),
                }),
            });
            const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!res.ok || !payload?.ok) {
                setDialogError(payload?.error || 'Не удалось сохранить тариф');
                return;
            }
            await loadPlans();
            handleClose();
        } catch (err) {
            setDialogError(err instanceof Error ? err.message : 'Не удалось сохранить тариф');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenDelete = (plan: PlanConfig) => {
        setPlanToDelete(plan);
        setDeleteError(null);
    };

    const handleCloseDelete = () => {
        if (deleting) return;
        setPlanToDelete(null);
        setDeleteError(null);
    };

    const handleDelete = async () => {
        if (!planToDelete) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const res = await fetch(`/api/admin/plans/${encodeURIComponent(planToDelete.plan)}`, {
                method: 'DELETE',
            });
            const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!res.ok || !payload?.ok) {
                setDeleteError(payload?.error || 'Не удалось удалить тариф');
                return;
            }
            await loadPlans();
            handleCloseDelete();
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : 'Не удалось удалить тариф');
        } finally {
            setDeleting(false);
        }
    };

    const updateField = <K extends keyof PlanConfig>(key: K, value: PlanConfig[K]) => {
        if (!selected) return;
        setSelected({ ...selected, [key]: value });
    };

    const updateBillingField = <K extends keyof BillingConfig>(key: K, value: BillingConfig[K]) => {
        if (!billingConfig) return;
        setBillingConfig({ ...billingConfig, [key]: value });
    };

    return (
        <Box>
            <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
                <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                        Стоимость публикации и отклика
                    </Typography>
                    {billingError && <Alert severity="error">{billingError}</Alert>}
                    {billingLoading || !billingConfig ? (
                        <Typography>Загрузка…</Typography>
                    ) : (
                        <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }}>
                            <TextField
                                label="Публикация задачи, ₽"
                                type="number"
                                value={billingConfig.taskPublishCostRub}
                                onChange={(e) => updateBillingField('taskPublishCostRub', Number(e.target.value))}
                                fullWidth
                            />
                            <TextField
                                label="Отклик исполнителя, ₽"
                                type="number"
                                value={billingConfig.bidCostRub}
                                onChange={(e) => updateBillingField('bidCostRub', Number(e.target.value))}
                                fullWidth
                            />
                            <Button
                                variant="contained"
                                onClick={saveBillingConfig}
                                disabled={billingSaving}
                                sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}
                            >
                                {billingSaving ? 'Сохраняем…' : 'Сохранить'}
                            </Button>
                        </Stack>
                    )}
                </Stack>
            </Paper>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <TableContainer component={Paper} variant="outlined">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Тариф</TableCell>
                            <TableCell>Цена/мес</TableCell>
                            <TableCell>Проекты</TableCell>
                            <TableCell>Места</TableCell>
                            <TableCell>Задачи/нед</TableCell>
                            <TableCell>Хранилище, GB</TableCell>
                            <TableCell>Овередж/GB/мес</TableCell>
                            <TableCell>Пакет GB</TableCell>
                            <TableCell>Пакет/мес</TableCell>
                            <TableCell align="right">Действия</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {!loading && plans.map((plan) => (
                            <TableRow key={plan.plan}>
                                <TableCell>{plan.title}</TableCell>
                                <TableCell>{plan.priceRubMonthly}</TableCell>
                                <TableCell>{formatLimit(plan.projectsLimit)}</TableCell>
                                <TableCell>{formatLimit(plan.seatsLimit)}</TableCell>
                                <TableCell>{formatLimit(plan.tasksWeeklyLimit)}</TableCell>
                                <TableCell>{formatLimit(plan.storageIncludedGb)}</TableCell>
                                <TableCell>{plan.storageOverageRubPerGbMonth}</TableCell>
                                <TableCell>{formatLimit(plan.storagePackageGb)}</TableCell>
                                <TableCell>{formatLimit(plan.storagePackageRubMonthly)}</TableCell>
                                <TableCell align="right">
                                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                                        <Tooltip title="Изменить">
                                            <IconButton
                                                color="primary"
                                                size="small"
                                                onClick={() => handleOpen(plan)}
                                            >
                                                <EditOutlined fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Удалить">
                                            <IconButton
                                                color="error"
                                                size="small"
                                                onClick={() => handleOpenDelete(plan)}
                                            >
                                                <DeleteOutline fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={10}>
                                    <Typography>Загрузка…</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={Boolean(selected)} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>Параметры тарифа</DialogTitle>
                <DialogContent dividers>
                    {dialogError && <Alert severity="error" sx={{ mb: 2 }}>{dialogError}</Alert>}
                    {selected && (
                        <Stack spacing={2}>
                            <TextField
                                label="Название"
                                value={selected.title}
                                onChange={(e) => updateField('title', e.target.value)}
                                fullWidth
                            />
                            <TextField
                                label="Цена, ₽/мес"
                                type="number"
                                value={selected.priceRubMonthly}
                                onChange={(e) => updateField('priceRubMonthly', Number(e.target.value))}
                                fullWidth
                            />
                            <TextField
                                label="Лимит проектов"
                                type="number"
                                value={selected.projectsLimit ?? ''}
                                onChange={(e) => updateField('projectsLimit', e.target.value === '' ? null : Number(e.target.value))}
                                fullWidth
                            />
                            <TextField
                                label="Лимит мест"
                                type="number"
                                value={selected.seatsLimit ?? ''}
                                onChange={(e) => updateField('seatsLimit', e.target.value === '' ? null : Number(e.target.value))}
                                fullWidth
                            />
                            <TextField
                                label="Задачи в неделю"
                                type="number"
                                value={selected.tasksWeeklyLimit ?? ''}
                                onChange={(e) => updateField('tasksWeeklyLimit', e.target.value === '' ? null : Number(e.target.value))}
                                fullWidth
                            />
                            <TextField
                                label="Публичные задачи/мес"
                                type="number"
                                value={selected.publicTasksMonthlyLimit ?? ''}
                                onChange={(e) => updateField('publicTasksMonthlyLimit', e.target.value === '' ? null : Number(e.target.value))}
                                fullWidth
                            />
                            <TextField
                                label="Хранилище включено, GB"
                                type="number"
                                value={selected.storageIncludedGb ?? ''}
                                onChange={(e) => updateField('storageIncludedGb', e.target.value === '' ? null : Number(e.target.value))}
                                fullWidth
                            />
                            <TextField
                                label="Овередж ₽/GB/мес"
                                type="number"
                                value={selected.storageOverageRubPerGbMonth}
                                onChange={(e) => updateField('storageOverageRubPerGbMonth', Number(e.target.value))}
                                fullWidth
                            />
                            <TextField
                                label="Пакет, GB"
                                type="number"
                                value={selected.storagePackageGb ?? ''}
                                onChange={(e) => updateField('storagePackageGb', e.target.value === '' ? null : Number(e.target.value))}
                                fullWidth
                            />
                            <TextField
                                label="Цена пакета ₽/мес"
                                type="number"
                                value={selected.storagePackageRubMonthly ?? ''}
                                onChange={(e) => updateField('storagePackageRubMonthly', e.target.value === '' ? null : Number(e.target.value))}
                                fullWidth
                            />
                            <TextField
                                label="Особенности (по строкам)"
                                value={selected.features.join('\n')}
                                onChange={(e) => updateField('features', e.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
                                multiline
                                minRows={3}
                                fullWidth
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={saving}>Отмена</Button>
                    <Button onClick={handleSave} disabled={saving} variant="contained">
                        {saving ? 'Сохраняем…' : 'Сохранить'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(planToDelete)} onClose={handleCloseDelete} maxWidth="xs" fullWidth>
                <DialogTitle>Удалить тариф?</DialogTitle>
                <DialogContent dividers>
                    {planToDelete ? (
                        <Stack spacing={1.5}>
                            <Typography variant="subtitle1">
                                {planToDelete.title} · {planToDelete.plan}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Конфигурация тарифа будет удалена и сброшена к значениям по умолчанию.
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
                        onClick={handleDelete}
                        disabled={deleting}
                        variant="contained"
                        color="error"
                    >
                        {deleting ? 'Удаляем…' : 'Удалить'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
