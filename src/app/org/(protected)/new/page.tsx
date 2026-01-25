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
    CircularProgress,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { useRouter } from 'next/navigation';
import { UI_RADIUS } from '@/config/uiTokens';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

type CreateOrgSuccess = { ok: true; org: { orgSlug: string } };
type CreateOrgError = { error: string };
type OrgSearchItem = {
    _id: string;
    name: string;
    orgSlug: string;
    membershipStatus?: 'active' | 'invited' | 'requested';
    requestedAt?: string;
};

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
    const { t } = useI18n();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [touchedSlug, setTouchedSlug] = useState(false); // если юзер редактировал slug вручную
    const [loading, setLoading] = useState(false);
    const [resultAlert, setResultAlert] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);
    const [orgQuery, setOrgQuery] = useState('');
    const [orgOptions, setOrgOptions] = useState<OrgSearchItem[]>([]);
    const [orgLoading, setOrgLoading] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState<OrgSearchItem | null>(null);
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinAlert, setJoinAlert] = useState<{ type: 'success' | 'warning'; message: string } | null>(null);
    const router = useRouter();

    const formatRequestedAt = (value?: string | null) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    };

    // автогенерация slug из name, если пользователь не редактировал вручную
    useEffect(() => {
        if (!touchedSlug) {
            const s = makeSlug(name);
            setSlug(s);
        }
    }, [name, touchedSlug]);

    const slugError = useMemo(() => {
        if (!slug) return null;
        if (slug.length < 3) return t('org.create.slug.minLength', 'Минимум 3 символа');
        if (!/^[a-z0-9-]+$/.test(slug)) {
            return t('org.create.slug.allowed', 'Разрешены только латиница, цифры, дефис');
        }
        return null;
    }, [slug, t]);

    useEffect(() => {
        const q = orgQuery.trim();
        if (q.length < 2) {
            setOrgOptions([]);
            setOrgLoading(false);
            return;
        }
        const ctrl = new AbortController();
        setOrgLoading(true);
        const timeout = setTimeout(async () => {
            try {
                const res = await fetch(
                    withBasePath(`/api/org/search?q=${encodeURIComponent(q)}&limit=8`),
                    { signal: ctrl.signal }
                );
                const data = (await res.json().catch(() => ({}))) as { orgs?: OrgSearchItem[] };
                setOrgOptions(Array.isArray(data.orgs) ? data.orgs : []);
            } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                    setOrgOptions([]);
                }
            } finally {
                setOrgLoading(false);
            }
        }, 250);

        return () => {
            clearTimeout(timeout);
            ctrl.abort();
        };
    }, [orgQuery]);

    const handleCreate = async () => {
        setLoading(true);
        setResultAlert(null);
        try {
            const res = await fetch(withBasePath('/api/org'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, orgSlug: slug || undefined }),
            });

            const data: CreateOrgSuccess | CreateOrgError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                setResultAlert({
                    type: 'warning',
                    message:
                        'error' in data && data.error
                            ? data.error
                            : t('org.create.error.create', 'Ошибка создания организации'),
                });
                return;
            }

            const orgName = name.trim() || data.org.orgSlug;
            setResultAlert({
                type: 'success',
                message: t('org.create.success', 'Организация «{orgName}» создана', { orgName }),
            });
            setTimeout(() => {
                router.push(`/org/${data.org.orgSlug}`);
            }, 1500);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : t('common.error.network', 'Ошибка сети');
            setResultAlert({ type: 'warning', message: msg });
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRequest = async () => {
        if (!selectedOrg) return;
        setJoinLoading(true);
        setJoinAlert(null);
        try {
            const res = await fetch(withBasePath(`/api/org/${encodeURIComponent(selectedOrg.orgSlug)}/members/request`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'manager' }),
            });
            const data = (await res.json().catch(() => ({}))) as { ok?: true; error?: string };
            if (!res.ok || !data.ok) {
                setJoinAlert({
                    type: 'warning',
                    message: data.error || t('org.join.request.error', 'Не удалось отправить запрос'),
                });
                return;
            }

            setJoinAlert({
                type: 'success',
                message: t('org.join.request.success', 'Запрос отправлен. Владелец организации получит уведомление.'),
            });
            const requestedAt = new Date().toISOString();
            setSelectedOrg((prev) => (prev ? { ...prev, membershipStatus: 'requested', requestedAt } : prev));
            setOrgOptions((prev) =>
                prev.map((org) =>
                    org.orgSlug === selectedOrg.orgSlug
                        ? { ...org, membershipStatus: 'requested', requestedAt }
                        : org
                )
            );
            setTimeout(() => {
                router.push('/');
            }, 3000);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : t('common.error.network', 'Ошибка сети');
            setJoinAlert({ type: 'warning', message: msg });
        } finally {
            setJoinLoading(false);
        }
    };

    const joinStatusLabel = useMemo(() => {
        if (!selectedOrg?.membershipStatus) return null;
        if (selectedOrg.membershipStatus === 'active') {
            return t('org.join.request.status.active', 'Вы уже в этой организации');
        }
        if (selectedOrg.membershipStatus === 'invited') {
            return t('org.join.request.status.invited', 'Для вас уже есть приглашение');
        }
        return t('org.join.request.status.requested', 'Запрос уже отправлен');
    }, [selectedOrg?.membershipStatus, t]);

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
                            {t('org.create.title', 'Создайте организацию')}
                        </Typography>
                        <Typography variant="h6" fontWeight={700}>
                            {t('org.create.subtitle', 'или присоединитесь к существующей.')}
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
                                        {t('org.create.section.title', 'Параметры организации')}
                                    </Typography>
                                    <Typography color="text.secondary">
                                        {t(
                                            'org.create.section.subtitle',
                                            'Название увидят сотрудники, а slug попадёт в ссылку на рабочее пространство.'
                                        )}
                                    </Typography>
                                </Box>
                                <TextField
                                    label={t('org.create.fields.name', 'Название организации')}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    fullWidth
                                />
                                <TextField
                                    label={t('org.create.fields.slug', 'Slug (URL-идентификатор)')}
                                    value={slug}
                                    onChange={(e) => {
                                        setTouchedSlug(true);
                                        setSlug(makeSlug(e.target.value));
                                    }}
                                    helperText={
                                        slugError ??
                                        t('org.create.slug.helper', 'Выберите короткий идентификатор организации на латинице')
                                    }
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
                                        {loading
                                            ? t('org.create.creating', 'Создаём…')
                                            : t('org.create.submit', 'Создать организацию')}
                                    </Button>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    {t(
                                        'org.create.renameHint',
                                        'Организацию можно переименовать позже: все изменения синхронизируются с рабочим пространством и приглашениями.'
                                    )}
                                </Typography>
                            </Stack>
                        </Paper>

                        <Stack direction="row" alignItems="center" spacing={2} sx={{ px: { xs: 1, md: 2 } }}>
                            <Box
                                sx={{
                                    flex: 1,
                                    height: 1,
                                    bgcolor: (theme) =>
                                        theme.palette.mode === 'dark'
                                            ? 'rgba(255,255,255,0.12)'
                                            : 'rgba(15,23,42,0.12)',
                                }}
                            />
                            <Typography
                                variant="overline"
                                fontWeight={700}
                                letterSpacing="0.2em"
                                color="text.secondary"
                            >
                                {t('org.create.or', 'ИЛИ')}
                            </Typography>
                            <Box
                                sx={{
                                    flex: 1,
                                    height: 1,
                                    bgcolor: (theme) =>
                                        theme.palette.mode === 'dark'
                                            ? 'rgba(255,255,255,0.12)'
                                            : 'rgba(15,23,42,0.12)',
                                }}
                            />
                        </Stack>

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
                                        {t('org.join.request.title', 'Присоединиться к организации')}
                                    </Typography>
                                    <Typography color="text.secondary">
                                        {t(
                                            'org.join.request.subtitle',
                                            'Найдите организацию по названию или slug и отправьте запрос на роль менеджера проекта.'
                                        )}
                                    </Typography>
                                </Box>

                                <Autocomplete<OrgSearchItem, false, false, false>
                                    options={orgOptions}
                                    loading={orgLoading}
                                    value={selectedOrg}
                                    onChange={(_, value) => {
                                        setSelectedOrg(value);
                                        setJoinAlert(null);
                                    }}
                                    inputValue={orgQuery}
                                    onInputChange={(_, value) => setOrgQuery(value)}
                                    filterOptions={(items) => items}
                                    getOptionLabel={(option) => option?.name ?? option?.orgSlug ?? ''}
                                    isOptionEqualToValue={(option, value) => option.orgSlug === value.orgSlug}
                                    noOptionsText={
                                        orgQuery.length >= 2
                                            ? t('org.join.request.search.empty', 'Ничего не найдено')
                                            : t('org.join.request.search.hint', 'Начните вводить название или slug')
                                    }
                                    renderOption={(props, option) => {
                                        const { key, ...liProps } = props as React.HTMLAttributes<HTMLLIElement> & { key?: string };
                                        const isRequested = option.membershipStatus === 'requested';
                                        return (
                                            <li key={key} {...liProps}>
                                                <Stack spacing={0.5}>
                                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {option.name}
                                                        </Typography>
                                                        {isRequested && (
                                                            <Typography variant="caption" color="info.main">
                                                                {t('org.join.request.option.requested', 'Запрос отправлен')}
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {option.orgSlug}
                                                    </Typography>
                                                </Stack>
                                            </li>
                                        );
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={t('org.join.request.search.label', 'Поиск организации')}
                                            placeholder={t('org.join.request.search.placeholder', 'Например, acme или acme-labs')}
                                            fullWidth
                                            helperText={
                                                joinStatusLabel ??
                                                t('org.join.request.search.helper', 'Организация должна подтвердить запрос.')
                                            }
                                            InputProps={{
                                                ...params.InputProps,
                                                endAdornment: (
                                                    <>
                                                        {orgLoading ? <CircularProgress size={16} /> : null}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
                                            }}
                                        />
                                    )}
                                />

                                {selectedOrg?.membershipStatus === 'requested' && (
                                    <Alert severity="info" variant="outlined">
                                        {t(
                                            'org.join.request.sentInfo',
                                            'Запрос в «{orgName}» отправлен {date}.',
                                            {
                                                orgName: selectedOrg.name ?? selectedOrg.orgSlug,
                                                date:
                                                    formatRequestedAt(selectedOrg.requestedAt) ??
                                                    t('org.join.request.date.unknown', 'неизвестно'),
                                            }
                                        )}
                                    </Alert>
                                )}

                                {joinAlert && (
                                    <Alert variant="filled" severity={joinAlert.type === 'success' ? 'success' : 'warning'}>
                                        {joinAlert.message}
                                    </Alert>
                                )}

                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        onClick={() => void handleJoinRequest()}
                                        variant="contained"
                                        size="large"
                                        disabled={
                                            joinLoading ||
                                            !selectedOrg ||
                                            Boolean(selectedOrg?.membershipStatus)
                                        }
                                    >
                                        {joinLoading
                                            ? t('org.join.request.sending', 'Отправляем…')
                                            : t('org.join.request.submit', 'Отправить запрос')}
                                    </Button>
                                </Box>
                            </Stack>
                        </Paper>

                    </Stack>
                </Box>
            </Container>
        </Box>
    );
}
