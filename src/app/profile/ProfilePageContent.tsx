'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
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
import ReviewDialog from '@/features/profile/ReviewDialog';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';
import { useRouter } from 'next/navigation';

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
    canReview?: boolean;
    reviewBlockReason?: string | null;
    error?: string;
};

type MessageState = { type: 'success' | 'error'; text: string } | null;

type ProfilePageContentProps = {
    mode: 'self' | 'public';
    userId?: string;
};

export default function ProfilePageContent({ mode, userId }: ProfilePageContentProps) {
    const { t } = useI18n();
    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<MessageState>(null);
    const [error, setError] = useState<string | null>(null);
    const [canEdit, setCanEdit] = useState(mode === 'self');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [reviewOpen, setReviewOpen] = useState(false);
    const router = useRouter();
    const [chatToast, setChatToast] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'error' | 'info';
        targetEmail?: string;
    }>({ open: false, message: '', severity: 'info' });

    const isPublicView = mode === 'public';
    const readOnly = !canEdit;

    const loadProfile = useCallback(async () => {
        if (isPublicView && !userId) {
            setError(t('profile.error.missingUser', 'Пользователь не указан'));
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
                setError(data.error || t('profile.error.load', 'Не удалось загрузить профиль'));
                return;
            }

            const payload: ProfileResponse | null =
                mode === 'self' ? data : (data.profile as ProfileResponse | null);

            if (!payload) {
                setError(t('profile.error.notFound', 'Профиль не найден'));
                return;
            }

            setProfile(payload);
            setCanEdit(mode === 'self' ? true : Boolean(data.canEdit));
        } catch (err) {
            setError(err instanceof Error ? err.message : t('common.error.unknown', 'Неизвестная ошибка'));
        } finally {
            setLoading(false);
        }
    }, [isPublicView, mode, t, userId]);

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
                    message: t('profile.chat.opened', 'Чат открыт'),
                    severity: 'success',
                    targetEmail,
                });
            } else {
                setChatToast({
                    open: true,
                    message:
                        customEvent.detail?.error ||
                        t('profile.chat.error', 'Не удалось открыть чат. Попробуйте еще раз.'),
                    severity: 'error',
                    targetEmail,
                });
            }
        };
        window.addEventListener('messenger:direct:result', handleChatResult);
        return () => {
            window.removeEventListener('messenger:direct:result', handleChatResult);
        };
    }, [chatToast.targetEmail, t]);

    const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (readOnly) {
            setMessage({
                type: 'error',
                text: t('profile.edit.ownerOnly', 'Редактирование доступно только владельцу профиля'),
            });
            event.target.value = '';
            return;
        }

        setUploading(true);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const res = await fetch(withBasePath('/api/profile/avatar'), {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage({
                    type: 'error',
                    text: data.error || t('profile.avatar.error', 'Не удалось загрузить аватар'),
                });
                return;
            }
            setProfile((prev) =>
                prev ? { ...prev, profilePic: data.imageUrl } : prev
            );
            setMessage({ type: 'success', text: t('profile.avatar.success', 'Аватар обновлён') });
        } catch (err) {
            setMessage({
                type: 'error',
                text: err instanceof Error ? err.message : t('common.error.unknown', 'Неизвестная ошибка'),
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
                    {error || t('profile.error.load', 'Не удалось загрузить профиль')}
                </Alert>
                <Button variant="contained" onClick={loadProfile}>
                    {t('common.retry', 'Повторить попытку')}
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
        ? t('profile.role.contractor', 'Подрядчик')
        : isEmployer
            ? t('profile.role.employer', 'Работодатель')
            : t('profile.role.profile', 'Профиль');
    const organizationRoleLabel = profile.organizationRole
        ? (() => {
            switch (profile.organizationRole) {
                case 'owner':
                    return t('org.roles.owner', 'Владелец');
                case 'org_admin':
                    return t('org.roles.admin', 'Администратор');
                case 'manager':
                    return t('org.roles.manager', 'Менеджер');
                case 'executor':
                    return t('org.roles.executor', 'Исполнитель');
                case 'viewer':
                    return t('org.roles.viewer', 'Наблюдатель');
                default:
                    return profile.organizationRole;
            }
        })()
        : null;
    const moderationLabel =
        profile.moderationStatus === 'approved'
            ? t('profile.moderation.approved', 'Подтвержден')
            : profile.moderationStatus === 'rejected'
                ? t('profile.moderation.rejected', 'Отклонен')
                : t('profile.moderation.pending', 'На модерации');
    const moderationColor =
        profile.moderationStatus === 'approved'
            ? 'success'
            : profile.moderationStatus === 'rejected'
                ? 'error'
                : 'primary';
    const highlightItems = isContractor
        ? [
            {
                label: t('profile.highlights.completed', 'Выполненные задачи'),
                value: String(
                    typeof profile.completedCount === 'number'
                        ? profile.completedCount
                        : 0
                ),
            },
            {
                label: t('profile.highlights.rating', 'Рабочий рейтинг'),
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
                    label: t('profile.highlights.profile', 'Профиль'),
                    value: roleLabel,
                },
                {
                    label: t('profile.highlights.region', 'Регион'),
                    value: regionName ? `${profile.regionCode} — ${regionName}` : '—',
                },
                {
                    label: t('profile.highlights.contact', 'Контакт'),
                    value: profile.email || '—',
                },
            ];
    const canMessage = Boolean(profile.email) && !canEdit;
    const canReview =
        typeof profile.canReview === 'boolean'
            ? profile.canReview
            : Boolean(profile.clerkUserId) && !canEdit;
    const reviewBlockReason = profile.reviewBlockReason ?? null;
    const canOpenReviews = Boolean(profile.clerkUserId);
    const ratingValue = typeof profile.rating === 'number' ? profile.rating : 0;
    const ratingLabel =
        typeof profile.rating === 'number' ? profile.rating.toFixed(1) : '—';
    const profileBio = profile.bio ?? '';

    const handleOpenMessage = () => {
        if (!profile.email || typeof window === 'undefined') return;
        setChatToast({
            open: true,
            message: t('profile.chat.opening', 'Открываем чат...'),
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
                                {profile.name || t('common.user', 'Пользователь')}
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
                        {!canReview && reviewBlockReason && !canEdit && (
                            <Typography variant="caption" color="text.secondary">
                                {reviewBlockReason}
                            </Typography>
                        )}
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
                                        {t('profile.actions.message', 'Отправить сообщение')}
                                    </Button>
                                )}
                                {canEdit && (
                                    <Button
                                        variant="outlined"
                                        onClick={() => router.push(withBasePath('/settings'))}
                                        sx={{ textTransform: 'none', borderRadius: 999 }}
                                    >
                                        {t('profile.actions.edit', 'Редактировать')}
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
                                        {uploading
                                            ? t('profile.avatar.uploading', 'Загрузка...')
                                            : t('profile.avatar.change', 'Изменить аватар')}
                                    </Button>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ display: 'block', mt: 1 }}
                                    >
                                        {t('profile.avatar.hint', 'JPG или PNG до 5 МБ')}
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
                                {t(
                                    'profile.employer.hint',
                                    'Работодатель управляет задачами, проектами и формирует команды подрядчиков.'
                                )}
                            </Typography>
                            {profile.organizationName && (
                                <Typography variant="body2" color="text.secondary">
                                    {t('profile.employer.organization', 'Организация: {name}', {
                                        name: profile.organizationName,
                                    })}
                                </Typography>
                            )}
                            {organizationRoleLabel && (
                                <Typography variant="body2" color="text.secondary">
                                    {t('profile.employer.role', 'Роль: {role}', { role: organizationRoleLabel })}
                                </Typography>
                            )}
                            {profile.managedProjects && profile.managedProjects.length > 0 && (
                                <Box>
                                    <Typography variant="body2" color="text.secondary">
                                        {t('profile.employer.projects', 'Проекты управления:')}
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
                                {t('profile.about', 'О себе')}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ whiteSpace: 'pre-line' }}
                            >
                                {profileBio || t('profile.about.empty', 'Пока нет описания.')}
                            </Typography>
                            {isAdminViewer && profile.phone && (
                                <Typography variant="body2" color="text.secondary">
                                    {t('profile.phone', 'Телефон: {value}', { value: profile.phone })}
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
                                            {label || t('profile.portfolio', 'Портфолио')}
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
                                {t('profile.recentTasks.title', 'Последние выполненные задачи')}
                            </Typography>
                            <Stack spacing={0.5}>
                                {profile.recentTasks.map((task, index) => (
                                    <Typography
                                        key={`${task.taskName}-${task.bsNumber}-${index}`}
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {t('profile.recentTasks.item', '{task} — БС {bs}', {
                                            task: task.taskName,
                                            bs: task.bsNumber,
                                        })}
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
                            {t(
                                'profile.adminNote',
                                'Администратор платформы имеет доступ к модерации и управлению данными.'
                            )}
                        </Typography>
                    )}
                </Box>
            </Paper>
            <ReviewDialog
                open={reviewOpen}
                onClose={() => setReviewOpen(false)}
                targetClerkUserId={profile.clerkUserId}
                targetName={profile.name}
                onSubmitted={loadProfile}
                canReview={canReview}
                reviewBlockReason={reviewBlockReason ?? undefined}
            />
            <Snackbar
                open={Boolean(message)}
                autoHideDuration={4000}
                onClose={() => setMessage(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                {message ? (
                    <Alert severity={message.type} onClose={() => setMessage(null)}>
                        {message.text}
                    </Alert>
                ) : null}
            </Snackbar>
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
