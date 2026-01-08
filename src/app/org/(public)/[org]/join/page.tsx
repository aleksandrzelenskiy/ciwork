// src/app/org/[org]/join/page.tsx
'use client';

import * as React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
    Box,
    Stack,
    Button,
    Typography,
    Snackbar,
    Alert,
    CircularProgress,
    Container,
    Paper,
} from '@mui/material';
import { UI_RADIUS } from '@/config/uiTokens';

type ApiOk = { ok: true };
type ApiErr = { error: string };
type ApiResp = ApiOk | ApiErr;
type InvitePreview =
    | { ok: true; orgName: string; expiresAt: string | null }
    | { error: string };

export default function OrgJoinPage() {
    const params = useParams() as Record<string, string> | null;
    const org = params?.org ?? null;

    const sp = useSearchParams();
    const router = useRouter();

    const token = sp?.get('token') ?? null;

    const [snack, setSnack] = React.useState<{ open: boolean; msg: string; sev: 'success' | 'error' | 'info' }>({
        open: false, msg: '', sev: 'success'
    });
    const [actionPending, setActionPending] = React.useState<'accept' | 'decline' | null>(null);
    const [actionResult, setActionResult] = React.useState<{ type: 'success' | 'declined'; message: string } | null>(null);
    const [inviteInfo, setInviteInfo] = React.useState<{ orgName: string; expiresAt: string | null } | null>(null);
    const [previewError, setPreviewError] = React.useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = React.useState(false);

    React.useEffect(() => {
        if (!org || !token) {
            setInviteInfo(null);
            setPreviewError(null);
            setPreviewLoading(false);
            return;
        }
        const controller = new AbortController();
        let cancelled = false;
        setPreviewLoading(true);
        setPreviewError(null);
        (async () => {
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(org)}/members/invite/preview?token=${encodeURIComponent(token)}`,
                    { signal: controller.signal }
                );
                const data = (await res.json().catch(() => ({}))) as InvitePreview;

                if (!res.ok || !('ok' in data)) {
                    if (!cancelled) {
                        setInviteInfo(null);
                        setPreviewError('error' in data && data.error ? data.error : res.statusText);
                    }
                    return;
                }
                if (!cancelled) {
                    setInviteInfo({ orgName: data.orgName, expiresAt: data.expiresAt });
                }
            } catch (err) {
                if (!cancelled && !(err instanceof DOMException && err.name === 'AbortError')) {
                    setPreviewError(err instanceof Error ? err.message : 'Не удалось загрузить приглашение');
                }
            } finally {
                if (!cancelled) {
                    setPreviewLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [org, token]);

    const accept = React.useCallback(async () => {
        if (!org || !token) return;
        setActionPending('accept');
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = (await res.json().catch(() => ({}) as ApiErr)) as ApiResp;

            if (res.status === 401) {
                setSnack({ open: true, msg: 'Нужно войти в аккаунт, чтобы принять приглашение', sev: 'error' });
                return;
            }

            if (!res.ok || ('error' in data && data.error)) {
                const msg = ('error' in data && data.error) ? data.error : res.statusText;
                setSnack({ open: true, msg, sev: 'error' });
                return;
            }

            const orgName = inviteInfo?.orgName ?? org ?? '—';
            setActionResult({
                type: 'success',
                message: `Вы успешно добавлены в организацию «${orgName}»`,
            });
            setTimeout(() => {
                router.replace('/');
            }, 1600);
        } finally {
            setActionPending(null);
        }
    }, [org, token, router, inviteInfo?.orgName]);

    const decline = React.useCallback(async () => {
        if (!org || !token) return;
        setActionPending('decline');
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members/decline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            if (res.status === 401) {
                setSnack({ open: true, msg: 'Нужно войти в аккаунт, чтобы отклонить приглашение', sev: 'error' });
                return;
            }
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}) as ApiErr)) as ApiResp;
                const msg = 'error' in data && data.error ? data.error : res.statusText;
                setSnack({ open: true, msg, sev: 'error' });
                return;
            }

            const orgName = inviteInfo?.orgName ?? org ?? '—';
            setActionResult({
                type: 'declined',
                message: `Вы отказались от приглашения от организации «${orgName}»`,
            });
            setTimeout(() => {
                router.replace('/');
            }, 1600);
        } finally {
            setActionPending(null);
        }
    }, [org, token, router, inviteInfo?.orgName]);

    const actionsDisabled = actionPending !== null || Boolean(actionResult);

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
                                fontSize: { xs: '2.25rem', sm: '2.75rem', md: '3.25rem' },
                                lineHeight: 1.1,
                            }}
                        >
                            Вы приглашены!
                        </Typography>
                        <Typography variant="h6" color="text.secondary" maxWidth={560}>
                            Подтвердите участие, чтобы получить доступ к задачам и рабочему пространству.
                        </Typography>
                    </Stack>

                    <Stack spacing={4} sx={{ mt: { xs: 3, md: 4 } }}>
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
                            {!token ? (
                                <Typography color="text.secondary">
                                    Токен приглашения не найден. Проверьте ссылку у пригласившего.
                                </Typography>
                            ) : !org ? (
                                <Typography color="text.secondary">
                                    Параметр организации отсутствует в URL.
                                </Typography>
                            ) : (
                                <Stack spacing={3}>
                                    <Box>
                                        <Typography variant="h6" fontWeight={700}>
                                            Вы приглашены в организацию «{inviteInfo?.orgName ?? org ?? '—'}»
                                        </Typography>
                                        <Typography color="text.secondary">
                                            Нажмите кнопку ниже, чтобы принять приглашение, или откажитесь, если оно неактуально.
                                        </Typography>
                                    </Box>
                                    {previewLoading && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CircularProgress size={16} />
                                            <Typography variant="body2" color="text.secondary">
                                                Загружаем детали приглашения…
                                            </Typography>
                                        </Box>
                                    )}
                                    {previewError && (
                                        <Alert severity="warning" variant="outlined">
                                            {previewError}
                                        </Alert>
                                    )}
                                    {inviteInfo?.expiresAt && (
                                        <Alert severity="info" variant="outlined">
                                            Приглашение действительно до{' '}
                                            {new Date(inviteInfo.expiresAt).toLocaleString('ru-RU')}
                                        </Alert>
                                    )}
                                    {actionResult && (
                                        <Alert
                                            variant="filled"
                                            severity={actionResult.type === 'success' ? 'success' : 'warning'}
                                        >
                                            {actionResult.message}
                                        </Alert>
                                    )}
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                        <Button
                                            variant="contained"
                                            fullWidth
                                            onClick={() => void accept()}
                                            disabled={actionsDisabled}
                                            size="large"
                                        >
                                            {actionPending === 'accept' ? <CircularProgress size={18} /> : 'Принять'}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            fullWidth
                                            onClick={() => void decline()}
                                            disabled={actionsDisabled}
                                            size="large"
                                        >
                                            Отказаться
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
                                Если ссылка устарела, попросите организатора отправить новый инвайт — срок действия ограничен.
                            </Typography>
                        </Paper>
                    </Stack>
                </Box>
            </Container>

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
            >
                <Alert
                    onClose={() => setSnack(s => ({ ...s, open: false }))}
                    severity={snack.sev}
                    variant="filled"
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}
