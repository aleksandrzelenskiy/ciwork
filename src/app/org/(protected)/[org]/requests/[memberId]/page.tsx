'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    Paper,
    Snackbar,
    Stack,
    Typography,
} from '@mui/material';
import { UI_RADIUS } from '@/config/uiTokens';
import { formatDateShort } from '@/utils/date';
import { roleLabel } from '@/utils/org';
import type { MemberDTO } from '@/types/org';
import useOrgAccess from '@/app/org/(protected)/[org]/hooks/useOrgAccess';
import { useI18n } from '@/i18n/I18nProvider';

type SnackState = { open: boolean; msg: string; sev: 'success' | 'error' | 'info' };

type ActionResult =
    | { type: 'approved'; message: string }
    | { type: 'declined'; message: string };

export default function OrgJoinRequestPage() {
    const { t } = useI18n();
    const router = useRouter();
    const params = useParams() as Record<string, string> | null;
    const org = params?.org ?? null;
    const memberId = params?.memberId ?? null;

    const { myRole, orgName, accessChecked } = useOrgAccess(org ?? undefined);
    const isOwner = myRole === 'owner';

    const [member, setMember] = React.useState<MemberDTO | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [actionPending, setActionPending] = React.useState<'approve' | 'decline' | null>(null);
    const [actionResult, setActionResult] = React.useState<ActionResult | null>(null);
    const [snack, setSnack] = React.useState<SnackState>({
        open: false,
        msg: '',
        sev: 'success',
    });

    const loadRequest = React.useCallback(async () => {
        if (!org || !memberId || !isOwner) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/members?status=requested`,
                { cache: 'no-store' }
            );
            const data = (await res.json().catch(() => ({}))) as { members?: MemberDTO[]; error?: string };
            if (!res.ok) {
                setError(data?.error || res.statusText);
                setMember(null);
                return;
            }
            const match = Array.isArray(data.members)
                ? data.members.find((item) => String(item._id) === String(memberId))
                : null;
            if (!match) {
                setError(
                    t(
                        'org.join.request.owner.notFound',
                        'Запрос не найден или уже обработан.'
                    )
                );
                setMember(null);
                return;
            }
            setMember(match);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
            setMember(null);
        } finally {
            setLoading(false);
        }
    }, [isOwner, memberId, org, t]);

    React.useEffect(() => {
        if (!accessChecked || !isOwner) return;
        void loadRequest();
    }, [accessChecked, isOwner, loadRequest]);

    const handleApprove = React.useCallback(async () => {
        if (!org || !memberId) return;
        setActionPending('approve');
        try {
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/members/requests/${encodeURIComponent(memberId)}`,
                { method: 'PATCH' }
            );
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSnack({
                    open: true,
                    msg: data?.error || t('org.members.request.approveError', 'Ошибка одобрения запроса'),
                    sev: 'error',
                });
                return;
            }
            const displayOrg = orgName || org || '—';
            setActionResult({
                type: 'approved',
                message: t(
                    'org.join.request.owner.approved',
                    'Запрос подтверждён. Пользователь добавлен в организацию «{orgName}».',
                    { orgName: displayOrg }
                ),
            });
            setTimeout(() => {
                router.replace(`/org/${encodeURIComponent(org)}`);
            }, 1600);
        } finally {
            setActionPending(null);
        }
    }, [memberId, org, orgName, router, t]);

    const handleDecline = React.useCallback(async () => {
        if (!org || !memberId) return;
        setActionPending('decline');
        try {
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/members/requests/${encodeURIComponent(memberId)}`,
                { method: 'DELETE' }
            );
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSnack({
                    open: true,
                    msg: data?.error || t('org.members.request.declineError', 'Ошибка отклонения запроса'),
                    sev: 'error',
                });
                return;
            }
            const displayOrg = orgName || org || '—';
            setActionResult({
                type: 'declined',
                message: t(
                    'org.join.request.owner.declined',
                    'Запрос отклонён. Пользователь не добавлен в «{orgName}».',
                    { orgName: displayOrg }
                ),
            });
            setTimeout(() => {
                router.replace(`/org/${encodeURIComponent(org)}`);
            }, 1600);
        } finally {
            setActionPending(null);
        }
    }, [memberId, org, orgName, router, t]);

    const actionsDisabled = actionPending !== null || Boolean(actionResult) || loading;

    if (!org || !memberId) {
        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
                <Typography color="text.secondary">
                    {t('org.join.request.owner.missingParams', 'Некорректная ссылка на запрос.')}
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: (theme) =>
                    theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, #0b0d11 0%, #151b24 60%, #0c1017 100%)'
                        : 'linear-gradient(135deg, #f6f7fa 0%, #e8ecf4 50%, #f5f7fb 100%)',
                pt: { xs: 3, md: 5 },
                pb: { xs: 6, md: 10 },
            }}
        >
            <Container maxWidth="sm" sx={{ position: 'relative' }}>
                <Box
                    sx={{
                        position: 'absolute',
                        top: -60,
                        right: -80,
                        width: 220,
                        height: 220,
                        bgcolor: 'primary.main',
                        opacity: 0.25,
                        filter: 'blur(120px)',
                        zIndex: 0,
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: -100,
                        left: -60,
                        width: 240,
                        height: 240,
                        bgcolor: 'secondary.main',
                        opacity: 0.18,
                        filter: 'blur(130px)',
                        zIndex: 0,
                    }}
                />

                <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Stack spacing={2} textAlign="center" alignItems="center">
                        <Typography
                            variant="h3"
                            fontWeight={700}
                            sx={{
                                fontSize: { xs: '2.1rem', sm: '2.6rem', md: '3rem' },
                                lineHeight: 1.1,
                            }}
                        >
                            {t('org.join.request.owner.title', 'Запрос на присоединение')}
                        </Typography>
                        <Typography variant="h6" color="text.secondary" maxWidth={560}>
                            {t(
                                'org.join.request.owner.subtitle',
                                'Подтвердите или отклоните доступ нового пользователя.'
                            )}
                        </Typography>
                    </Stack>

                    <Stack spacing={3} sx={{ mt: { xs: 3, md: 4 } }}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: { xs: 3, md: 4 },
                                borderRadius: UI_RADIUS.surface,
                                border: '1px solid',
                                borderColor: (theme) =>
                                    theme.palette.mode === 'dark'
                                        ? 'rgba(255,255,255,0.08)'
                                        : 'rgba(15,23,42,0.08)',
                                backgroundColor: (theme) =>
                                    theme.palette.mode === 'dark'
                                        ? 'rgba(13,16,23,0.85)'
                                        : 'rgba(255,255,255,0.9)',
                                backdropFilter: 'blur(18px)',
                            }}
                        >
                            {!accessChecked || loading ? (
                                <Stack spacing={2} alignItems="center">
                                    <CircularProgress size={24} />
                                    <Typography color="text.secondary">
                                        {t('org.join.request.owner.loading', 'Загружаем запрос…')}
                                    </Typography>
                                </Stack>
                            ) : !isOwner ? (
                                <Alert severity="warning" variant="outlined">
                                    {t(
                                        'org.join.request.owner.notAllowed',
                                        'Доступен только владельцу организации.'
                                    )}
                                </Alert>
                            ) : error ? (
                                <Alert severity="warning" variant="outlined">{error}</Alert>
                            ) : !member ? (
                                <Typography color="text.secondary">
                                    {t(
                                        'org.join.request.owner.empty',
                                        'Запрос на присоединение не найден.'
                                    )}
                                </Typography>
                            ) : (
                                <Stack spacing={3}>
                                    <Box>
                                        <Typography variant="h6" fontWeight={700}>
                                            {t(
                                                'org.join.request.owner.requestTitle',
                                                'Пользователь хочет присоединиться к «{orgName}»',
                                                { orgName: orgName || org || '—' }
                                            )}
                                        </Typography>
                                        <Typography color="text.secondary">
                                            {t(
                                                'org.join.request.owner.requestHint',
                                                'Проверьте данные и выберите действие.'
                                            )}
                                        </Typography>
                                    </Box>

                                    <Stack spacing={1.2}>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('org.join.request.owner.nameLabel', 'Имя')}
                                        </Typography>
                                        <Typography variant="subtitle1">
                                            {member.userName || '—'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('org.join.request.owner.emailLabel', 'E-mail')}
                                        </Typography>
                                        <Typography variant="subtitle1">
                                            {member.userEmail || '—'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('org.join.request.owner.roleLabel', 'Роль')}
                                        </Typography>
                                        <Typography variant="subtitle1">
                                            {roleLabel(member.role, t)}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {t('org.join.request.owner.requestedAtLabel', 'Запрос отправлен')}
                                        </Typography>
                                        <Typography variant="subtitle1">
                                            {member.requestedAt
                                                ? formatDateShort(member.requestedAt)
                                                : t('org.join.request.owner.requestedAtUnknown', 'неизвестно')}
                                        </Typography>
                                    </Stack>

                                    {actionResult && (
                                        <Alert
                                            variant="filled"
                                            severity={actionResult.type === 'approved' ? 'success' : 'warning'}
                                        >
                                            {actionResult.message}
                                        </Alert>
                                    )}

                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                        <Button
                                            variant="contained"
                                            fullWidth
                                            onClick={() => void handleApprove()}
                                            disabled={actionsDisabled}
                                            size="large"
                                        >
                                            {actionPending === 'approve' ? (
                                                <CircularProgress size={18} />
                                            ) : (
                                                t('org.join.request.owner.approve', 'Одобрить')
                                            )}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            fullWidth
                                            onClick={() => void handleDecline()}
                                            disabled={actionsDisabled}
                                            size="large"
                                        >
                                            {actionPending === 'decline' ? (
                                                <CircularProgress size={18} />
                                            ) : (
                                                t('org.join.request.owner.decline', 'Отклонить')
                                            )}
                                        </Button>
                                    </Stack>
                                </Stack>
                            )}
                        </Paper>

                        <Paper
                            variant="outlined"
                            sx={{
                                borderRadius: UI_RADIUS.tooltip,
                                p: { xs: 2.5, md: 3 },
                                textAlign: 'center',
                                backgroundColor: (theme) =>
                                    theme.palette.mode === 'dark'
                                        ? 'rgba(15, 20, 30, 0.6)'
                                        : 'rgba(255,255,255,0.85)',
                                borderColor: (theme) =>
                                    theme.palette.mode === 'dark'
                                        ? 'rgba(255,255,255,0.08)'
                                        : 'rgba(15,23,42,0.08)',
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                {t(
                                    'org.join.request.owner.footerHint',
                                    'Если запрос уже обработан, обновите список участников в настройках организации.'
                                )}
                            </Typography>
                        </Paper>
                    </Stack>
                </Box>
            </Container>

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
            >
                <Alert
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    severity={snack.sev}
                    variant="filled"
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
