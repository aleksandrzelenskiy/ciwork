'use client';

import * as React from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    ButtonBase,
    CircularProgress,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    MenuItem,
    Paper,
    FormControl,
    InputLabel,
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
import GavelOutlined from '@mui/icons-material/GavelOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ProfileDialog from '@/features/profile/ProfileDialog';
import { UI_RADIUS } from '@/config/uiTokens';
import { withBasePath } from '@/utils/basePath';

type UserRow = {
    clerkUserId: string;
    name?: string;
    email?: string;
    role?: string;
    profilePic?: string;
    walletBalance?: number;
    walletCurrency?: string;
    moderationStatus?: 'pending' | 'approved' | 'rejected';
    moderationComment?: string;
    profileType?: string;
};

type UsersResponse = { users?: UserRow[]; error?: string };

const normalizeValue = (value?: string | null) => {
    if (!value) return '';
    return value.trim();
};

type UsersAdminProps = {
    focusUserId?: string | null;
};

export default function UsersAdmin({ focusUserId }: UsersAdminProps) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
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
    const iconText = textPrimary;
    const tableBg = isDarkMode ? 'rgba(10,13,20,0.92)' : '#ffffff';
    const headBg = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(248,250,252,0.95)';
    const cellBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';
    const tableShadow = isDarkMode ? '0 25px 70px rgba(0,0,0,0.55)' : '0 20px 50px rgba(15,23,42,0.12)';
    const normalizedFocusUserId = normalizeValue(focusUserId);
    const focusRowRef = React.useRef<HTMLTableRowElement | null>(null);
    const focusAppliedRef = React.useRef<string | null>(null);
    const focusScrolledRef = React.useRef<string | null>(null);
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
    const [moderationTarget, setModerationTarget] = React.useState<UserRow | null>(
        null
    );
    const [moderationStatus, setModerationStatus] = React.useState<
        'pending' | 'approved' | 'rejected'
    >('pending');
    const [moderationComment, setModerationComment] = React.useState('');
    const [moderationError, setModerationError] = React.useState<string | null>(null);
    const [moderating, setModerating] = React.useState(false);
    const [filterStatus, setFilterStatus] = React.useState<
        'all' | 'pending' | 'approved' | 'rejected'
    >('all');

    const fetchUsers = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(withBasePath('/api/admin/users'), { cache: 'no-store' });
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

    React.useEffect(() => {
        if (!normalizedFocusUserId) {
            focusAppliedRef.current = null;
            return;
        }
        if (focusAppliedRef.current === normalizedFocusUserId) return;
        focusAppliedRef.current = normalizedFocusUserId;
        if (filterStatus !== 'all') {
            setFilterStatus('all');
        }
    }, [filterStatus, normalizedFocusUserId]);

    const filteredUsers = React.useMemo(() => {
        if (filterStatus === 'all') return users;
        return users.filter((user) => user.moderationStatus === filterStatus);
    }, [filterStatus, users]);

    React.useEffect(() => {
        if (!normalizedFocusUserId || loading) return;
        if (!focusRowRef.current) return;
        if (focusScrolledRef.current === normalizedFocusUserId) return;
        focusScrolledRef.current = normalizedFocusUserId;
        focusRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [filteredUsers, loading, normalizedFocusUserId]);

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

    const handleOpenModeration = (user: UserRow) => {
        setModerationTarget(user);
        setModerationStatus(user.moderationStatus ?? 'pending');
        setModerationComment(user.moderationComment ?? '');
        setModerationError(null);
    };

    const handleCloseModeration = () => {
        if (moderating) return;
        setModerationTarget(null);
        setModerationError(null);
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

    const handleModerationSave = async () => {
        if (!moderationTarget) return;
        if (moderationStatus === 'rejected' && !moderationComment.trim()) {
            setModerationError('Укажите комментарий для отказа');
            return;
        }
        setModerating(true);
        setModerationError(null);
        try {
            const response = await fetch(
                `/api/admin/users/${encodeURIComponent(
                    moderationTarget.clerkUserId
                )}/moderation`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: moderationStatus,
                        comment: moderationComment,
                    }),
                }
            );
            const payload = (await response.json().catch(() => null)) as
                | { ok?: true; status?: string; comment?: string; error?: string }
                | null;

            if (!response.ok || !payload || !payload.ok) {
                const message =
                    payload?.error || 'Не удалось обновить статус модерации';
                setModerationError(message);
                return;
            }

            setUsers((prev) =>
                prev.map((item) =>
                    item.clerkUserId === moderationTarget.clerkUserId
                        ? {
                              ...item,
                              moderationStatus: moderationStatus,
                              moderationComment: moderationComment.trim(),
                          }
                        : item
                )
            );
            handleCloseModeration();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Ошибка обновления';
            setModerationError(message);
        } finally {
            setModerating(false);
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

    const userCount = users.length;

    return (
        <Box
            sx={{
                minHeight: '100%',
                py: { xs: 4, md: 6 },
                px: { xs: 0.25, md: 6 },
            }}
        >
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
                                Администрирование пользователей
                            </Typography>
                            <Typography
                                variant="body2"
                                color={textSecondary}
                                sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, mt: 0.5 }}
                            >
                                {loading
                                    ? 'Загружаем пользователей...'
                                    : `Всего пользователей: ${userCount}.`}
                            </Typography>
                            {error && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                                    {error}
                                </Typography>
                            )}
                        </Box>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                                <InputLabel id="user-moderation-filter-label">
                                    Модерация
                                </InputLabel>
                                <Select
                                    labelId="user-moderation-filter-label"
                                    label="Модерация"
                                    value={filterStatus}
                                    onChange={(event) =>
                                        setFilterStatus(
                                            event.target.value as
                                                | 'all'
                                                | 'pending'
                                                | 'approved'
                                                | 'rejected'
                                        )
                                    }
                                >
                                    <MenuItem value="all">Все</MenuItem>
                                    <MenuItem value="pending">На модерации</MenuItem>
                                    <MenuItem value="approved">Подтвержден</MenuItem>
                                    <MenuItem value="rejected">Отклонен</MenuItem>
                                </Select>
                            </FormControl>
                            <Tooltip title="Обновить">
                                <span>
                                    <IconButton
                                        onClick={() => void fetchUsers()}
                                        disabled={loading}
                                        sx={{
                                            borderRadius: UI_RADIUS.overlay,
                                            border: `1px solid ${iconBorderColor}`,
                                            backgroundColor: iconBg,
                                            color: iconText,
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
                    <TableContainer sx={{ borderRadius: UI_RADIUS.panel, boxShadow: tableShadow, bgcolor: tableBg }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow sx={{ '& th': { bgcolor: headBg, borderColor: cellBorder } }}>
                                    <TableCell>Пользователь</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Роль</TableCell>
                                    <TableCell>Модерация</TableCell>
                                    <TableCell>Баланс</TableCell>
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
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            Нет пользователей
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow
                                            key={user.clerkUserId}
                                            ref={
                                                user.clerkUserId === normalizedFocusUserId
                                                    ? focusRowRef
                                                    : undefined
                                            }
                                            hover
                                            selected={user.clerkUserId === normalizedFocusUserId}
                                            sx={{
                                                '& td': { borderColor: cellBorder },
                                                ...(user.clerkUserId === normalizedFocusUserId
                                                    ? {
                                                          animation: 'focusPulse 2.4s ease-out 1',
                                                      }
                                                    : {}),
                                                '@keyframes focusPulse': {
                                                    '0%': {
                                                        boxShadow: '0 0 0 rgba(14,116,144,0)',
                                                    },
                                                    '40%': {
                                                        boxShadow: isDarkMode
                                                            ? '0 0 0 4px rgba(14,116,144,0.35)'
                                                            : '0 0 0 4px rgba(14,116,144,0.22)',
                                                    },
                                                    '100%': {
                                                        boxShadow: '0 0 0 rgba(14,116,144,0)',
                                                    },
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: isDarkMode
                                                        ? 'rgba(14,116,144,0.22)'
                                                        : 'rgba(14,116,144,0.12)',
                                                },
                                                '&.Mui-selected:hover': {
                                                    backgroundColor: isDarkMode
                                                        ? 'rgba(14,116,144,0.3)'
                                                        : 'rgba(14,116,144,0.18)',
                                                },
                                                '&:hover': {
                                                    backgroundColor: isDarkMode
                                                        ? 'rgba(255,255,255,0.08)'
                                                        : '#fffde7',
                                                },
                                            }}
                                        >
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
                                                <Chip
                                                    size="small"
                                                    label={
                                                        user.moderationStatus === 'approved'
                                                            ? 'Подтвержден'
                                                            : user.moderationStatus === 'rejected'
                                                                ? 'Отклонен'
                                                                : 'На модерации'
                                                    }
                                                    color={
                                                        user.moderationStatus === 'approved'
                                                            ? 'success'
                                                            : user.moderationStatus === 'rejected'
                                                                ? 'error'
                                                                : 'primary'
                                                    }
                                                    variant={
                                                        user.moderationStatus === 'pending'
                                                            ? 'outlined'
                                                            : 'filled'
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {Number.isFinite(user.walletBalance)
                                                    ? `${user.walletBalance} ${user.walletCurrency || 'RUB'}`
                                                    : '—'}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                    <Tooltip title="Модерация профиля">
                                                        <IconButton
                                                            color="secondary"
                                                            size="small"
                                                            onClick={() => handleOpenModeration(user)}
                                                        >
                                                            <GavelOutlined fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
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
            </Box>

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
            <Dialog
                open={Boolean(moderationTarget)}
                onClose={handleCloseModeration}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>Модерация профиля</DialogTitle>
                <DialogContent dividers>
                    {moderationTarget ? (
                        <Stack spacing={2}>
                            <Typography variant="subtitle1">
                                {normalizeValue(moderationTarget.name) || '—'} ·{' '}
                                {moderationTarget.clerkUserId}
                            </Typography>
                            <TextField
                                select
                                label="Статус"
                                value={moderationStatus}
                                onChange={(event) =>
                                    setModerationStatus(
                                        event.target.value as 'pending' | 'approved' | 'rejected'
                                    )
                                }
                                size="small"
                            >
                                <MenuItem value="pending">На модерации</MenuItem>
                                <MenuItem value="approved">Подтвержден</MenuItem>
                                <MenuItem value="rejected">Отклонен</MenuItem>
                            </TextField>
                            <TextField
                                label="Комментарий модератора"
                                value={moderationComment}
                                onChange={(event) =>
                                    setModerationComment(event.target.value)
                                }
                                multiline
                                minRows={3}
                                placeholder="Добавьте пояснение для пользователя"
                            />
                            {moderationError && (
                                <Alert severity="error">{moderationError}</Alert>
                            )}
                        </Stack>
                    ) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseModeration} disabled={moderating}>
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleModerationSave}
                        disabled={moderating}
                        startIcon={
                            moderating ? <CircularProgress size={16} color="inherit" /> : null
                        }
                    >
                        {moderating ? 'Сохраняем…' : 'Применить'}
                    </Button>
                </DialogActions>
            </Dialog>
            <ProfileDialog
                open={Boolean(profileTarget)}
                onClose={handleCloseProfile}
                clerkUserId={profileTarget?.clerkUserId}
            />
        </Box>
    );
}
