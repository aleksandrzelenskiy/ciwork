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
    Collapse,
    CircularProgress,
    Paper,
    Rating,
    Snackbar,
    Stack,
    Typography,
    Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import type { PlatformRole } from '@/app/types/roles';
import SendIcon from '@mui/icons-material/Send';
import ProfileEditForm from '@/features/profile/ProfileEditForm';
import ReviewDialog from '@/features/profile/ReviewDialog';

type ProfileResponse = {
    id?: string;
    name: string;
    email: string;
    phone: string;
    profilePic: string;
    regionCode: string;
    profileType?: 'employer' | 'contractor';
    platformRole?: PlatformRole;
    viewerPlatformRole?: PlatformRole;
    bio?: string;
    portfolioLinks?: string[];
    moderationStatus?: 'pending' | 'approved' | 'rejected';
    moderationComment?: string;
    clerkUserId?: string;
    completedCount?: number;
    rating?: number | null;
    workRating?: number | null;
    organizationName?: string;
    organizationRole?: string;
    managedProjects?: { name: string; key?: string | null }[];
    recentTasks?: { taskName: string; bsNumber: string }[];
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
    const [showEditForm, setShowEditForm] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [bio, setBio] = useState('');
    const [reviewOpen, setReviewOpen] = useState(false);
    const [chatToast, setChatToast] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info';
        targetEmail?: string;
    }>({ open: false, message: '', severity: 'info' });

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
            setBio(payload.bio || '');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    }, [deriveNames, isPublicView, mode, userId]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    useEffect(() => {
        const handleChatResult = (event: Event) => {
            const customEvent = event as CustomEvent<{
                targetEmail?: string;
                ok?: boolean;
                error?: string;
            }>;
            const targetEmail = customEvent.detail?.targetEmail;
            if (!targetEmail || targetEmail !== chatToast.targetEmail) return;
            if (customEvent.detail?.ok) {
                setChatToast({
                    open: true,
                    message: 'Чат открыт',
                    severity: 'success',
                    targetEmail,
                });
            } else {
                setChatToast({
                    open: true,
                    message:
                        customEvent.detail?.error ||
                        'Не удалось открыть чат. Попробуйте еще раз.',
                    severity: 'error',
                    targetEmail,
                });
            }
        };
        window.addEventListener('messenger:direct:result', handleChatResult);
        return () => {
            window.removeEventListener('messenger:direct:result', handleChatResult);
        };
    }, [chatToast.targetEmail]);

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
                    bio,
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
                setBio(data.profile.bio || '');
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

    const isContractor = profile.profileType === 'contractor';
    const isEmployer = profile.profileType === 'employer';
    const isAdminViewer =
        profile.viewerPlatformRole === 'super_admin' ||
        profile.viewerPlatformRole === 'staff';
    const regionName = profile.regionCode
        ? RUSSIAN_REGIONS.find((region) => region.code === profile.regionCode)?.name
        : '';
    const roleLabel = isContractor
        ? 'Подрядчик'
        : isEmployer
            ? 'Работодатель'
            : 'Профиль';
    const orgRoleLabels: Record<string, string> = {
        owner: 'Владелец',
        org_admin: 'Администратор',
        manager: 'Менеджер',
        executor: 'Исполнитель',
        viewer: 'Наблюдатель',
    };
    const organizationRoleLabel = profile.organizationRole
        ? orgRoleLabels[profile.organizationRole] || profile.organizationRole
        : null;
    const moderationLabel =
        profile.moderationStatus === 'approved'
            ? 'Подтвержден'
            : profile.moderationStatus === 'rejected'
                ? 'Отклонен'
                : 'На модерации';
    const moderationColor =
        profile.moderationStatus === 'approved'
            ? 'success'
            : profile.moderationStatus === 'rejected'
                ? 'error'
                : 'primary';
    const highlightItems = isContractor
        ? [
            {
                label: 'Выполненные задачи',
                value: String(
                    typeof profile.completedCount === 'number'
                        ? profile.completedCount
                        : 0
                ),
            },
            {
                label: 'Рабочий рейтинг',
                value:
                    typeof profile.workRating === 'number'
                        ? profile.workRating.toFixed(1)
                        : '—',
            },
        ]
        : isEmployer
            ? []
            : [
                {
                    label: 'Профиль',
                    value: roleLabel,
                },
                {
                    label: 'Регион',
                    value: regionName ? `${profile.regionCode} — ${regionName}` : '—',
                },
                {
                    label: 'Контакт',
                    value: profile.email || '—',
                },
            ];
    const canMessage = Boolean(profile.email) && !canEdit;
    const canReview = Boolean(profile.clerkUserId) && !canEdit;
    const canOpenReviews = Boolean(profile.clerkUserId);
    const ratingValue = typeof profile.rating === 'number' ? profile.rating : 0;
    const ratingLabel =
        typeof profile.rating === 'number' ? profile.rating.toFixed(1) : '—';

    const handleOpenMessage = () => {
        if (!profile.email || typeof window === 'undefined') return;
        setChatToast({
            open: true,
            message: 'Открываем чат...',
            severity: 'info',
            targetEmail: profile.email,
        });
        window.dispatchEvent(
            new CustomEvent('messenger:open', {
                detail: { targetEmail: profile.email },
            })
        );
    };

    return (
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 960, mx: 'auto' }}>
            <Paper
                sx={(theme) => ({
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor:
                        theme.palette.mode === 'dark'
                            ? alpha(theme.palette.common.white, 0.12)
                            : alpha(theme.palette.common.black, 0.08),
                    boxShadow:
                        theme.palette.mode === 'dark'
                            ? '0 24px 80px rgba(0, 0, 0, 0.5)'
                            : '0 24px 80px rgba(15, 23, 42, 0.12)',
                    overflow: 'hidden',
                    background:
                        theme.palette.mode === 'dark'
                            ? `linear-gradient(180deg, ${alpha(
                                theme.palette.grey[900],
                                0.95
                            )} 0%, ${alpha(theme.palette.grey[800], 0.98)} 100%)`
                            : `linear-gradient(180deg, ${alpha(
                                theme.palette.background.paper,
                                0.98
                            )} 0%, ${alpha(theme.palette.grey[50], 0.92)} 100%)`,
                })}
            >
                <Box
                    sx={(theme) => ({
                        position: 'relative',
                        p: { xs: 3, sm: 4 },
                        display: 'flex',
                        gap: { xs: 2.5, sm: 3.5 },
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        background:
                            theme.palette.mode === 'dark'
                                ? `linear-gradient(135deg, ${alpha(
                                    theme.palette.primary.dark,
                                    0.35
                                )}, ${alpha(theme.palette.grey[900], 0.85)})`
                                : `linear-gradient(135deg, ${alpha(
                                    theme.palette.primary.light,
                                    0.16
                                )}, ${alpha(theme.palette.background.paper, 0.95)})`,
                    })}
                >
                    <Box
                        sx={(theme) => ({
                            position: 'absolute',
                            top: -90,
                            right: -70,
                            width: 200,
                            height: 200,
                            borderRadius: '50%',
                            background: alpha(theme.palette.primary.light, 0.25),
                            filter: 'blur(2px)',
                        })}
                    />
                    <Avatar
                        src={profile.profilePic}
                        alt={profile.name}
                        sx={(theme) => ({
                            width: 128,
                            height: 128,
                            border: '4px solid',
                            borderColor: theme.palette.background.paper,
                            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
                            zIndex: 1,
                        })}
                    />
                    <Stack spacing={1} sx={{ zIndex: 1, flex: 1 }}>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.5}
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                        >
                            <Typography variant="h4" fontWeight={700}>
                                {profile.name || 'Пользователь'}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                <Chip
                                    label={roleLabel}
                                    color={
                                        isContractor
                                            ? 'info'
                                            : isEmployer
                                                ? 'success'
                                                : 'default'
                                    }
                                    size="small"
                                />
                                <Chip
                                    label={moderationLabel}
                                    color={moderationColor}
                                    variant={
                                        profile.moderationStatus === 'pending'
                                            ? 'outlined'
                                            : 'filled'
                                    }
                                    size="small"
                                />
                            </Stack>
                        </Stack>
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            onClick={() => {
                                if (canOpenReviews) {
                                    setReviewOpen(true);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (
                                    canOpenReviews &&
                                    (event.key === 'Enter' || event.key === ' ')
                                ) {
                                    event.preventDefault();
                                    setReviewOpen(true);
                                }
                            }}
                            role={canOpenReviews ? 'button' : undefined}
                            tabIndex={canOpenReviews ? 0 : -1}
                            sx={{
                                cursor: canOpenReviews ? 'pointer' : 'default',
                                width: 'fit-content',
                            }}
                        >
                            <Rating value={ratingValue} precision={0.1} readOnly />
                            <Typography variant="body2" color="text.secondary">
                                {ratingLabel}
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={2} flexWrap="wrap">
                            <Typography variant="body2" color="text.secondary">
                                {profile.email}
                            </Typography>
                            {profile.regionCode && (
                                <Typography variant="body2" color="text.secondary">
                                    {regionName
                                        ? `${profile.regionCode} — ${regionName}`
                                        : profile.regionCode}
                                </Typography>
                            )}
                            {profile.clerkUserId && isAdminViewer && (
                                <Typography variant="caption" color="text.secondary">
                                    ID: {profile.clerkUserId}
                                </Typography>
                            )}
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                            {canMessage && (
                                <Button
                                    variant="contained"
                                    startIcon={<SendIcon />}
                                    onClick={handleOpenMessage}
                                    sx={{ textTransform: 'none', borderRadius: 999 }}
                                >
                                    Отправить сообщение
                                </Button>
                            )}
                            {canEdit && (
                                <Button
                                    variant="outlined"
                                    onClick={() => setShowEditForm((prev) => !prev)}
                                    sx={{ textTransform: 'none', borderRadius: 999 }}
                                >
                                    {showEditForm ? 'Скрыть редактирование' : 'Редактировать'}
                                </Button>
                            )}
                        </Stack>
                        {canEdit && (
                            <Box>
                                <Button
                                    variant="outlined"
                                    onClick={triggerAvatarSelect}
                                    disabled={uploading}
                                    sx={{
                                        textTransform: 'none',
                                        borderRadius: 999,
                                        px: 2.5,
                                        mt: 1,
                                    }}
                                >
                                    {uploading ? 'Загрузка...' : 'Изменить аватар'}
                                </Button>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: 'block', mt: 1 }}
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
                        )}
                    </Stack>
                </Box>

                {isEmployer && (
                    <Box
                        sx={(theme) => ({
                            px: { xs: 3, sm: 4 },
                            pt: 2,
                            pb: 1,
                            borderTop: '1px solid',
                            borderColor:
                                theme.palette.mode === 'dark'
                                    ? alpha(theme.palette.common.white, 0.08)
                                    : alpha(theme.palette.common.black, 0.08),
                            ...(theme.palette.mode === 'dark' && {
                                backgroundColor: alpha(
                                    theme.palette.background.default,
                                    0.55
                                ),
                            }),
                        })}
                    >
                        <Stack spacing={1}>
                            <Typography variant="body2" color="text.secondary">
                                Работодатель управляет задачами, проектами и формирует
                                команды подрядчиков.
                            </Typography>
                            {profile.organizationName && (
                                <Typography variant="body2" color="text.secondary">
                                    Организация: {profile.organizationName}
                                </Typography>
                            )}
                            {organizationRoleLabel && (
                                <Typography variant="body2" color="text.secondary">
                                    Роль: {organizationRoleLabel}
                                </Typography>
                            )}
                            {profile.managedProjects && profile.managedProjects.length > 0 && (
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        Проекты управления:
                                    </Typography>
                                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                        {profile.managedProjects.map((project) => (
                                            <Typography
                                                key={`${project.key ?? project.name}`}
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                {project.name}
                                                {project.key ? ` (${project.key})` : ''}
                                            </Typography>
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                        </Stack>
                    </Box>
                )}

                {(profile.moderationStatus === 'rejected' && profile.moderationComment) ||
                !canEdit ? (
                    <Box sx={{ px: { xs: 3, sm: 4 }, pt: 2 }}>
                        {profile.moderationStatus === 'rejected' &&
                            profile.moderationComment && (
                                <Alert severity="warning" sx={{ mb: 1.5 }}>
                                    {profile.moderationComment}
                                </Alert>
                            )}
                    </Box>
                ) : null}

                <Box
                    sx={(theme) => ({
                        px: { xs: 3, sm: 4 },
                        pb: 3,
                        pt: { xs: 2, sm: 3 },
                        ...(theme.palette.mode === 'dark' && {
                            backgroundColor: alpha(
                                theme.palette.background.default,
                                0.6
                            ),
                        }),
                    })}
                >
                    {highlightItems.length > 0 && (
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={2}
                            sx={{ mb: isContractor ? 2.5 : 2 }}
                        >
                            {highlightItems.map((item) => (
                                <Box
                                    key={item.label}
                                    sx={(theme) => ({
                                        flex: 1,
                                        p: 2.5,
                                        borderRadius: 3,
                                        backgroundColor: alpha(
                                            theme.palette.background.paper,
                                            0.8
                                        ),
                                        border: '1px solid',
                                        borderColor: alpha(
                                            theme.palette.common.black,
                                            0.08
                                        ),
                                        boxShadow:
                                            '0 12px 30px rgba(15, 23, 42, 0.08)',
                                        ...(theme.palette.mode === 'dark' && {
                                            backgroundColor: alpha(
                                                theme.palette.background.default,
                                                0.7
                                            ),
                                            borderColor: alpha(
                                                theme.palette.common.white,
                                                0.08
                                            ),
                                            boxShadow:
                                                '0 12px 30px rgba(0, 0, 0, 0.35)',
                                        }),
                                    })}
                                >
                                    <Typography
                                        variant="subtitle2"
                                        color="text.secondary"
                                    >
                                        {item.label}
                                    </Typography>
                                    <Typography variant="h5" fontWeight={700}>
                                        {item.value}
                                    </Typography>
                                </Box>
                            ))}
                        </Stack>
                    )}
                    {isContractor && (
                        <Stack spacing={1}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                О себе
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ whiteSpace: 'pre-line' }}
                            >
                                {bio || 'Пока нет описания.'}
                            </Typography>
                            {isAdminViewer && profile.phone && (
                                <Typography variant="body2" color="text.secondary">
                                    Телефон: {profile.phone}
                                </Typography>
                            )}
                            {profile.portfolioLinks?.length ? (
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                    {profile.portfolioLinks.map((link) => {
                                        const label = link
                                            .replace(/^https?:\/\//, '')
                                            .replace(/\/$/, '')
                                            .split('/')[0];
                                        return (
                                        <Button
                                            key={link}
                                            href={link}
                                            target="_blank"
                                            rel="noreferrer"
                                            size="small"
                                            variant="outlined"
                                            sx={{ borderRadius: 999, textTransform: 'none' }}
                                        >
                                            {label || 'Портфолио'}
                                        </Button>
                                        );
                                    })}
                                </Stack>
                            ) : null}
                        </Stack>
                    )}
                    {isContractor && profile.recentTasks && profile.recentTasks.length > 0 && (
                        <Stack spacing={1} sx={{ mt: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600}>
                                Последние выполненные задачи
                            </Typography>
                            <Stack spacing={0.5}>
                                {profile.recentTasks.map((task, index) => (
                                    <Typography
                                        key={`${task.taskName}-${task.bsNumber}-${index}`}
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {task.taskName} — БС {task.bsNumber}
                                    </Typography>
                                ))}
                            </Stack>
                        </Stack>
                    )}
                    {profile.platformRole === 'super_admin' && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                        >
                            Администратор платформы имеет доступ к модерации и
                            управлению данными.
                        </Typography>
                    )}
                </Box>
            </Paper>
            {canEdit && (
                <Collapse in={showEditForm} timeout={300} unmountOnExit>
                    <ProfileEditForm
                        firstName={firstName}
                        lastName={lastName}
                        phone={profile.phone}
                        regionCode={profile.regionCode}
                        email={profile.email}
                        bio={bio}
                        isContractor={isContractor}
                        readOnly={readOnly}
                        saving={saving}
                        uploading={uploading}
                        canEdit={canEdit}
                        message={message}
                        onSubmit={handleSubmit}
                        onFirstNameChange={(value) => {
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
                        onLastNameChange={(value) => {
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
                        onPhoneChange={(value) =>
                            setProfile((prev) =>
                                prev ? { ...prev, phone: value } : prev
                            )
                        }
                        onRegionChange={(value) =>
                            setProfile((prev) =>
                                prev ? { ...prev, regionCode: value } : prev
                            )
                        }
                        onBioChange={(value) => setBio(value)}
                        onMessageClose={() => setMessage(null)}
                    />
                </Collapse>
            )}
            <ReviewDialog
                open={reviewOpen}
                onClose={() => setReviewOpen(false)}
                targetClerkUserId={profile.clerkUserId}
                targetName={profile.name}
                onSubmitted={loadProfile}
                canReview={canReview}
            />
            <Snackbar
                open={chatToast.open}
                autoHideDuration={4000}
                onClose={() =>
                    setChatToast((prev) => ({
                        ...prev,
                        open: false,
                    }))
                }
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={chatToast.severity}
                    onClose={() =>
                        setChatToast((prev) => ({
                            ...prev,
                            open: false,
                        }))
                    }
                >
                    {chatToast.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
