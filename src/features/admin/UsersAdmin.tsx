'use client';

import * as React from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    ButtonBase,
    CircularProgress,
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
import { useTheme } from '@mui/material/styles';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import EditOutlined from '@mui/icons-material/EditOutlined';
import ProfileDialog from '@/features/profile/ProfileDialog';

type UserRow = {
    clerkUserId: string;
    name?: string;
    email?: string;
    role?: string;
    profilePic?: string;
    walletBalance?: number;
    walletCurrency?: string;
};

type UsersResponse = { users?: UserRow[]; error?: string };

const normalizeValue = (value?: string | null) => {
    if (!value) return '';
    return value.trim();
};

export default function UsersAdmin() {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const [users, setUsers] = React.useState<UserRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [selectedUser, setSelectedUser] = React.useState<UserRow | null>(null);
    const [walletTopUpInput, setWalletTopUpInput] = React.useState('0');
    const [dialogError, setDialogError] = React.useState<string | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [userToDelete, setUserToDelete] = React.useState<UserRow | null>(null);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [deleting, setDeleting] = React.useState(false);
    const [profileTarget, setProfileTarget] = React.useState<UserRow | null>(null);

    const fetchUsers = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/admin/users', { cache: 'no-store' });
            const payload = (await response.json().catch(() => null)) as UsersResponse | null;

            if (!response.ok || !payload || !payload.users) {
                const message =
                    payload?.error || 'Не удалось загрузить пользователей';
                setError(message);
                return;
            }

            setUsers(payload.users);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Сервер не ответил';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void fetchUsers();
    }, [fetchUsers]);

    const handleOpenDialog = (user: UserRow) => {
        setSelectedUser(user);
        setWalletTopUpInput('0');
        setDialogError(null);
    };

    const handleCloseDialog = () => {
        if (saving) return;
        setSelectedUser(null);
        setDialogError(null);
    };

    const handleOpenDelete = (user: UserRow) => {
        setUserToDelete(user);
        setDeleteError(null);
    };

    const handleCloseDelete = () => {
        if (deleting) return;
        setUserToDelete(null);
        setDeleteError(null);
    };

    const handleOpenProfile = (user: UserRow) => {
        if (!user.clerkUserId) {
            setError('Не удалось открыть профиль пользователя');
            return;
        }
        setProfileTarget(user);
    };

    const handleCloseProfile = () => {
        setProfileTarget(null);
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            const response = await fetch(
                `/api/admin/users/${encodeURIComponent(userToDelete.clerkUserId)}`,
                { method: 'DELETE' }
            );
            const payload = (await response.json().catch(() => null)) as
                | { ok?: true; clerkDeleted?: boolean; clerkError?: string; error?: string }
                | null;

            if (!response.ok || !payload || !payload.ok) {
                const message = payload?.error || 'Не удалось удалить пользователя';
                setDeleteError(message);
                return;
            }

            setUsers((prev) =>
                prev.filter((item) => item.clerkUserId !== userToDelete.clerkUserId)
            );
            setUserToDelete(null);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Ошибка удаления';
            setDeleteError(message);
        } finally {
            setDeleting(false);
        }
    };

    const handleApply = async () => {
        if (!selectedUser) return;
        const topUpAmount = Number(walletTopUpInput);
        if (!Number.isFinite(topUpAmount) || topUpAmount <= 0) {
            setDialogError('Введите сумму пополнения');
            return;
        }
        setSaving(true);
        setDialogError(null);
        try {
            const response = await fetch(
                `/api/admin/users/${encodeURIComponent(selectedUser.clerkUserId)}/wallet`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ delta: topUpAmount }),
                }
            );
            const payload = (await response.json().catch(() => null)) as
                | { ok?: true; balance?: number; currency?: string; error?: string }
                | null;

            if (!response.ok || !payload || !payload.ok) {
                const message = payload?.error || 'Не удалось обновить баланс';
                setDialogError(message);
                return;
            }

            setUsers((prev) =>
                prev.map((item) =>
                    item.clerkUserId === selectedUser.clerkUserId
                        ? {
                              ...item,
                              walletBalance:
                                  payload.balance ??
                                  (item.walletBalance ?? 0) + topUpAmount,
                              walletCurrency: payload.currency ?? item.walletCurrency ?? 'RUB',
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
                        Администрирование пользователей
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                        Список пользователей платформы и их текущие роли.
                    </Typography>
                </Stack>
                <Button
                    variant="outlined"
                    onClick={() => void fetchUsers()}
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
                                <TableCell>Пользователь</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Роль</TableCell>
                                <TableCell>Баланс</TableCell>
                                <TableCell>ID</TableCell>
                                <TableCell align="right">Действия</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center">
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
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center">
                                        Нет пользователей
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.clerkUserId} hover>
                                        <TableCell>
                                            <ButtonBase
                                                onClick={() => handleOpenProfile(user)}
                                                aria-label={`Открыть профиль ${normalizeValue(user.name) || user.clerkUserId}`}
                                                sx={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'flex-start',
                                                    textAlign: 'left',
                                                    borderRadius: 1,
                                                    py: 0.5,
                                                    px: 0.5,
                                                    '&:hover': {
                                                        backgroundColor: 'action.hover',
                                                    },
                                                }}
                                            >
                                                <Stack direction="row" spacing={1.5} alignItems="center">
                                                    <Avatar
                                                        src={user.profilePic || undefined}
                                                        alt={normalizeValue(user.name) || 'User'}
                                                    >
                                                        {normalizeValue(user.name).slice(0, 1).toUpperCase()}
                                                    </Avatar>
                                                    <Typography fontWeight={600}>
                                                        {normalizeValue(user.name) || '—'}
                                                    </Typography>
                                                </Stack>
                                            </ButtonBase>
                                        </TableCell>
                                        <TableCell>{normalizeValue(user.email) || '—'}</TableCell>
                                        <TableCell>
                                            {normalizeValue(user.role) ? (
                                                <Typography fontWeight={600}>
                                                    {normalizeValue(user.role)}
                                                </Typography>
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {Number.isFinite(user.walletBalance)
                                                ? `${user.walletBalance} ${user.walletCurrency || 'RUB'}`
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="caption" color="text.secondary">
                                                {user.clerkUserId}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Tooltip title="Изменить">
                                                    <IconButton
                                                        color="primary"
                                                        size="small"
                                                        onClick={() => handleOpenDialog(user)}
                                                    >
                                                        <EditOutlined fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Удалить">
                                                    <IconButton
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleOpenDelete(user)}
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

            <Dialog open={Boolean(selectedUser)} onClose={handleCloseDialog} fullWidth maxWidth="sm">
                <DialogTitle>Пополнить кошелек</DialogTitle>
                <DialogContent dividers>
                    {selectedUser ? (
                        <Stack spacing={2}>
                            <Typography variant="subtitle1">
                                {normalizeValue(selectedUser.name) || '—'} · {selectedUser.clerkUserId}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Текущий баланс:{' '}
                                {Number.isFinite(selectedUser.walletBalance)
                                    ? `${selectedUser.walletBalance} ${selectedUser.walletCurrency || 'RUB'}`
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
                open={Boolean(userToDelete)}
                onClose={handleCloseDelete}
                fullWidth
                maxWidth="xs"
            >
                <DialogTitle>Удалить пользователя?</DialogTitle>
                <DialogContent dividers>
                    {userToDelete ? (
                        <Stack spacing={1.5}>
                            <Typography variant="subtitle1">
                                {normalizeValue(userToDelete.name) || '—'} · {userToDelete.clerkUserId}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Пользователь будет удален из базы данных и, по возможности, из Clerk.
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
            <ProfileDialog
                open={Boolean(profileTarget)}
                onClose={handleCloseProfile}
                clerkUserId={profileTarget?.clerkUserId}
                title={
                    normalizeValue(profileTarget?.name)
                        ? `Профиль: ${normalizeValue(profileTarget?.name)}`
                        : 'Профиль пользователя'
                }
            />
        </Box>
    );
}
