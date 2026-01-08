// src/app/org/new/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Paper,
    TextField,
    Typography,
    Alert,
    Stack,
    Container,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { UI_RADIUS } from '@/config/uiTokens';

type CreateOrgSuccess = { ok: true; org: { orgSlug: string } };
type CreateOrgError = { error: string };

// простая клиентская slugify (латиница/цифры/дефис, минимум 3 символа)
function makeSlug(input: string): string {
    return input
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 48);
}

export default function NewOrgPage() {
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [touchedSlug, setTouchedSlug] = useState(false); // если юзер редактировал slug вручную
    const [loading, setLoading] = useState(false);
    const [resultAlert, setResultAlert] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);
    const router = useRouter();

    // автогенерация slug из name, если пользователь не редактировал вручную
    useEffect(() => {
        if (!touchedSlug) {
            const s = makeSlug(name);
            setSlug(s);
        }
    }, [name, touchedSlug]);

    const slugError = useMemo(() => {
        if (!slug) return null;
        if (slug.length < 3) return 'Минимум 3 символа';
        if (!/^[a-z0-9-]+$/.test(slug)) return 'Разрешены только латиница, цифры, дефис';
        return null;
    }, [slug]);

    const handleCreate = async () => {
        setLoading(true);
        setResultAlert(null);
        try {
            const res = await fetch('/api/org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, orgSlug: slug || undefined }),
            });

            const data: CreateOrgSuccess | CreateOrgError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                setResultAlert({
                    type: 'warning',
                    message: 'error' in data && data.error ? data.error : 'Ошибка создания организации',
                });
                return;
            }

            const orgName = name.trim() || data.org.orgSlug;
            setResultAlert({
                type: 'success',
                message: `Организация «${orgName}» создана`,
            });
            setTimeout(() => {
                router.push(`/org/${data.org.orgSlug}`);
            }, 1500);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setResultAlert({ type: 'warning', message: msg });
        } finally {
            setLoading(false);
        }
    };

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
            <Container maxWidth="md" sx={{ position: 'relative' }}>
                <Box
                    sx={{
                        position: 'absolute',
                        top: -80,
                        right: -60,
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
                        bottom: -120,
                        left: -40,
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
                        <Typography variant="h3" fontWeight={700}>
                            Создайте организацию
                        </Typography>
                    </Stack>

                    <Stack spacing={4} sx={{ mt: { xs: 3, md: 5 } }}>
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
                            <Stack spacing={3}>
                                <Box>
                                    <Typography variant="h6" fontWeight={700}>
                                        Параметры организации
                                    </Typography>
                                    <Typography color="text.secondary">
                                        Название увидят сотрудники, а slug попадёт в ссылку на рабочее пространство.
                                    </Typography>
                                </Box>
                                <TextField
                                    label="Название организации"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    fullWidth
                                />
                                <TextField
                                    label="Slug (URL-идентификатор)"
                                    value={slug}
                                    onChange={(e) => {
                                        setTouchedSlug(true);
                                        setSlug(makeSlug(e.target.value));
                                    }}
                                    helperText={slugError ?? 'Идентификатор названия на латинице'}
                                    error={Boolean(slugError)}
                                    fullWidth
                                />
                                {resultAlert && (
                                    <Alert variant="filled" severity={resultAlert.type === 'success' ? 'success' : 'warning'}>
                                        {resultAlert.message}
                                    </Alert>
                                )}
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        onClick={() => void handleCreate()}
                                        variant="contained"
                                        size="large"
                                        disabled={loading || name.trim().length < 2 || Boolean(slugError)}
                                    >
                                        {loading ? 'Создаём…' : 'Создать'}
                                    </Button>
                                </Box>
                            </Stack>
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
                                Организацию можно переименовать позже: все изменения синхронизируются с рабочим
                                пространством и приглашениями.
                            </Typography>
                        </Paper>
                    </Stack>
                </Box>
            </Container>
        </Box>
    );
}
