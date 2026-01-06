'use client';

import {
    ChangeEvent,
    FormEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
    Divider,
} from '@mui/material';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';

type ProfileResponse = {
    id?: string;
    name: string;
    email: string;
    phone: string;
    profilePic: string;
    regionCode: string;
    profileType?: 'employer' | 'contractor';
    desiredRate?: number | null;
    bio?: string;
    portfolioLinks?: string[];
    portfolioStatus?: 'pending' | 'approved' | 'rejected';
    moderationComment?: string;
    completedCount?: number;
    rating?: number | null;
    error?: string;
};

type MessageState = { type: 'success' | 'error'; text: string } | null;

type ProfilePageContentProps = {
    mode: 'self' | 'public';
    userId?: string;
};

export default function ProfilePageContent({ mode, userId }: ProfilePageContentProps) {
    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<MessageState>(null);
    const [error, setError] = useState<string | null>(null);
    const [canEdit, setCanEdit] = useState(mode === 'self');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [desiredRate, setDesiredRate] = useState<string>('');
    const [bio, setBio] = useState('');
    const [portfolioLinks, setPortfolioLinks] = useState<string>('');

    const isPublicView = mode === 'public';
    const readOnly = !canEdit;

    const deriveNames = useCallback((fullName?: string) => {
        const parts = (fullName ?? '')
            .split(' ')
            .map((chunk) => chunk.trim())
            .filter(Boolean);
        if (!parts.length) {
            setFirstName('');
            setLastName('');
            return;
        }
        setFirstName(parts[0] ?? '');
        setLastName(parts.slice(1).join(' '));
    }, []);

    const buildFullName = useCallback(
        (first?: string, last?: string) =>
            [first?.trim(), last?.trim()].filter(Boolean).join(' ').trim(),
        []
    );

    const loadProfile = useCallback(async () => {
        if (isPublicView && !userId) {
            setError('Пользователь не указан');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);

        const endpoint =
            mode === 'self'
                ? '/api/profile'
                : `/api/profile/${encodeURIComponent(userId ?? '')}`;

        try {
            const res = await fetch(endpoint, { cache: 'no-store' });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Не удалось загрузить профиль');
                return;
            }

            const payload: ProfileResponse | null =
                mode === 'self' ? data : (data.profile as ProfileResponse | null);

            if (!payload) {
                setError('Профиль не найден');
                return;
            }

            setProfile(payload);
            setCanEdit(mode === 'self' ? true : Boolean(data.canEdit));
            deriveNames(payload.name);
            setDesiredRate(
                typeof payload.desiredRate === 'number'
                    ? String(payload.desiredRate)
                    : ''
            );
            setBio(payload.bio || '');
            setPortfolioLinks(
                Array.isArray(payload.portfolioLinks)
                    ? payload.portfolioLinks.join('\n')
                    : ''
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    }, [deriveNames, isPublicView, mode, userId]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!profile || readOnly) return;

        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: buildFullName(firstName, lastName),
                    phone: profile.phone,
                    regionCode: profile.regionCode,
                    desiredRate: desiredRate.trim() ? Number(desiredRate.trim()) : null,
                    bio,
                    portfolioLinks: portfolioLinks
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage({
                    type: 'error',
                    text: data.error || 'Не удалось обновить профиль',
                });
                return;
            }
            if (data.profile) {
                setProfile((prev) =>
                    prev ? { ...prev, ...data.profile } : data.profile
                );
                deriveNames(data.profile.name);
                setDesiredRate(
                    typeof data.profile.desiredRate === 'number'
                        ? String(data.profile.desiredRate)
                        : ''
                );
                setBio(data.profile.bio || '');
                setPortfolioLinks(
                    Array.isArray(data.profile.portfolioLinks)
                        ? data.profile.portfolioLinks.join('\n')
                        : ''
                );
            }
            setMessage({ type: 'success', text: 'Профиль обновлён' });
        } catch (err) {
            setMessage({
                type: 'error',
                text: err instanceof Error ? err.message : 'Неизвестная ошибка',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (readOnly) {
            setMessage({
                type: 'error',
                text: 'Редактирование доступно только владельцу профиля',
            });
            event.target.value = '';
            return;
        }

        setUploading(true);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const res = await fetch('/api/profile/avatar', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage({
                    type: 'error',
                    text: data.error || 'Не удалось загрузить аватар',
                });
                return;
            }
            setProfile((prev) =>
                prev ? { ...prev, profilePic: data.imageUrl } : prev
            );
            setMessage({ type: 'success', text: 'Аватар обновлён' });
        } catch (err) {
            setMessage({
                type: 'error',
                text: err instanceof Error ? err.message : 'Неизвестная ошибка',
            });
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const triggerAvatarSelect = () => {
        if (readOnly) return;
        fileInputRef.current?.click();
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !profile) {
        return (
            <Box sx={{ p: 4, maxWidth: 640, mx: 'auto' }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error || 'Не удалось загрузить профиль'}
                </Alert>
                <Button variant="contained" onClick={loadProfile}>
                    Повторить попытку
                </Button>
            </Box>
        );
    }

    const title = isPublicView ? 'Публичный профиль' : 'Профиль пользователя';

    return (
        <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom>
                {title}
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
                {profile.name || 'Пользователь'}
            </Typography>

            {!canEdit && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Это публичный профиль. Редактировать может только владелец.
                </Alert>
            )}

            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ mb: 2 }}
            >
                <Paper
                    sx={{
                        flex: 1,
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                    }}
                >
                    <Typography variant="subtitle2" color="text.secondary">
                        Выполненные задачи
                    </Typography>
                    <Typography variant="h5" fontWeight={700}>
                        {typeof profile.completedCount === 'number'
                            ? profile.completedCount
                            : 0}
                    </Typography>
                </Paper>
                <Paper
                    sx={{
                        flex: 1,
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                    }}
                >
                    <Typography variant="subtitle2" color="text.secondary">
                        Рейтинг
                    </Typography>
                    <Typography variant="h5" fontWeight={700}>
                        {typeof profile.rating === 'number'
                            ? profile.rating.toFixed(1)
                            : '—'}
                    </Typography>
                </Paper>
            </Stack>

            <Paper
                component="form"
                onSubmit={handleSubmit}
                sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}
            >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
                    <Avatar
                        src={profile.profilePic}
                        alt={profile.name}
                        sx={{ width: 120, height: 120 }}
                    />
                    <Box>
                        {canEdit && (
                            <Button
                                variant="outlined"
                                onClick={triggerAvatarSelect}
                                disabled={uploading}
                                sx={{ textTransform: 'none' }}
                            >
                                {uploading ? 'Загрузка...' : 'Изменить аватар'}
                            </Button>
                        )}
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                        >
                            JPG или PNG до 5 МБ
                        </Typography>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png, image/jpeg"
                            hidden
                            onChange={handleAvatarUpload}
                        />
                    </Box>
                </Stack>

                <Divider />

                <TextField
                    label="Имя"
                    value={firstName}
                    onChange={(e) => {
                        const value = e.target.value;
                        setFirstName(value);
                        setProfile((prev) =>
                            prev
                                ? {
                                    ...prev,
                                    name: buildFullName(value, lastName),
                                }
                                : prev
                        );
                    }}
                    required
                    disabled={readOnly}
                />

                <TextField
                    label="Фамилия"
                    value={lastName}
                    onChange={(e) => {
                        const value = e.target.value;
                        setLastName(value);
                        setProfile((prev) =>
                            prev
                                ? {
                                    ...prev,
                                    name: buildFullName(firstName, value),
                                }
                                : prev
                        );
                    }}
                    disabled={readOnly}
                />

                <TextField
                    label="Телефон"
                    value={profile.phone}
                    onChange={(e) =>
                        setProfile((prev) =>
                            prev ? { ...prev, phone: e.target.value } : prev
                        )
                    }
                    disabled={readOnly}
                />

                <FormControl fullWidth disabled={readOnly}>
                    <InputLabel id="profile-region-label">Регион</InputLabel>
                    <Select
                        labelId="profile-region-label"
                        label="Регион"
                        value={profile.regionCode}
                        onChange={(e) =>
                            setProfile((prev) =>
                                prev ? { ...prev, regionCode: e.target.value } : prev
                            )
                        }
                    >
                        {RUSSIAN_REGIONS.map((region) => (
                            <MenuItem key={region.code} value={region.code}>
                                {region.code} — {region.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <TextField label="Email" value={profile.email} disabled />

                {profile.profileType === 'contractor' && (
                    <Stack spacing={2}>
                        <Typography variant="h6" fontWeight={600}>
                            Профиль подрядчика
                        </Typography>
                        <TextField
                            label="Ставка за задачу, ₽"
                            type="number"
                            value={desiredRate}
                            onChange={(e) => setDesiredRate(e.target.value)}
                            inputProps={{ min: 0 }}
                            helperText="Фиксированная ставка для типовых задач"
                            disabled={readOnly}
                        />

                        <TextField
                            label="О себе"
                            multiline
                            minRows={3}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Кратко опишите опыт и специализацию"
                            disabled={readOnly}
                        />

                        <TextField
                            label="Портфолио/ссылки (по строке на ссылку)"
                            multiline
                            minRows={3}
                            value={portfolioLinks}
                            onChange={(e) => setPortfolioLinks(e.target.value)}
                            placeholder="https://site.com/example"
                            disabled={readOnly}
                        />

                        <Alert
                            severity={
                                profile.portfolioStatus === 'approved'
                                    ? 'success'
                                    : profile.portfolioStatus === 'rejected'
                                        ? 'error'
                                        : 'info'
                            }
                        >
                            Статус модерации: {profile.portfolioStatus || 'pending'}
                            {profile.moderationComment ? ` — ${profile.moderationComment}` : ''}
                        </Alert>
                    </Stack>
                )}

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {canEdit && (
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={saving || uploading}
                        >
                            {saving ? <CircularProgress size={22} /> : 'Сохранить'}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant={canEdit ? 'outlined' : 'contained'}
                        onClick={loadProfile}
                        disabled={saving || uploading}
                    >
                        Обновить данные
                    </Button>
                </Box>

                {message && (
                    <Alert severity={message.type} onClose={() => setMessage(null)}>
                        {message.text}
                    </Alert>
                )}
            </Paper>
        </Box>
    );
}
