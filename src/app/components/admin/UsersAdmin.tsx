'use client';

import * as React from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    CircularProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

type UserRow = {
    clerkUserId: string;
    name?: string;
    email?: string;
    role?: string;
    profilePic?: string;
};

type UsersResponse = UserRow[] | { error?: string };

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

    const fetchUsers = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/users', { cache: 'no-store' });
            const payload = (await response.json().catch(() => null)) as UsersResponse | null;

            if (!response.ok || !payload || !Array.isArray(payload)) {
                const message =
                    payload && !Array.isArray(payload) && payload.error
                        ? payload.error
                        : 'Не удалось загрузить пользователей';
                setError(message);
                return;
            }

            setUsers(payload);
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
                                <TableCell>ID</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} align="center">
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
                                    <TableCell colSpan={4} align="center">
                                        Нет пользователей
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.clerkUserId} hover>
                                        <TableCell>
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
                                            <Typography variant="caption" color="text.secondary">
                                                {user.clerkUserId}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}
