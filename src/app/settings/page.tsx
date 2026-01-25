'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Typography,
} from '@mui/material';
import ProfileEditForm from '@/features/profile/ProfileEditForm';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

interface CurrentUserResponse {
    name?: string;
    email?: string;
    platformRole?: string;
    locale?: string;
    error?: string;
}

interface EditableProfileResponse {
    name: string;
    email: string;
    phone: string;
    regionCode: string;
    profileType?: 'employer' | 'contractor';
    bio?: string;
}

type MessageState = { type: 'success' | 'error'; text: string } | null;

type SettingsMessage = { text: string; severity: 'success' | 'error' } | null;

export default function SettingsPage() {
    const { t, locale, setLocale } = useI18n();
    const [currentUser, setCurrentUser] = useState<CurrentUserResponse | null>(null);
    const [currentUserError, setCurrentUserError] = useState<string | null>(null);
    const [profile, setProfile] = useState<EditableProfileResponse | null>(null);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [language, setLanguage] = useState(locale);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsMessage, setSettingsMessage] = useState<SettingsMessage>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [bio, setBio] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<MessageState>(null);
    const tRef = useRef(t);

    useEffect(() => {
        tRef.current = t;
    }, [t]);

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

    useEffect(() => {
        let active = true;

        const loadCurrentUser = async () => {
            setLoadingCurrent(true);
            try {
                const res = await fetch(withBasePath('/api/current-user'), { cache: 'no-store' });
                const data: CurrentUserResponse = await res.json();
                if (!active) return;
                if (res.ok) {
                    setCurrentUser(data);
                    const resolvedLocale = data.locale === 'en' ? 'en' : 'ru';
                    setLanguage(resolvedLocale);
                    setLocale(resolvedLocale);
                    setCurrentUserError(null);
                } else {
                    setCurrentUserError(
                        data.error ||
                            tRef.current('settings.profileLoadError', 'Не удалось загрузить профиль')
                    );
                }
            } catch (error) {
                if (!active) return;
                setCurrentUserError(
                    error instanceof Error
                        ? error.message
                        : tRef.current('settings.profileLoadError', 'Не удалось загрузить профиль')
                );
            } finally {
                if (active) {
                    setLoadingCurrent(false);
                }
            }
        };

        void loadCurrentUser();

        return () => {
            active = false;
        };
    }, [setLocale]);

    useEffect(() => {
        let active = true;

        const loadProfile = async () => {
            setLoadingProfile(true);
            try {
                const res = await fetch(withBasePath('/api/profile'), { cache: 'no-store' });
                const data = await res.json();
                if (!active) return;
                if (!res.ok) {
                    setProfileError(
                        data.error || tRef.current('profile.error.load', 'Не удалось загрузить профиль')
                    );
                    return;
                }
                const payload = data as EditableProfileResponse;
                setProfile(payload);
                setProfileError(null);
                deriveNames(payload.name);
                setBio(payload.bio || '');
            } catch (error) {
                if (!active) return;
                setProfileError(
                    error instanceof Error
                        ? error.message
                        : tRef.current('profile.error.load', 'Не удалось загрузить профиль')
                );
            } finally {
                if (active) {
                    setLoadingProfile(false);
                }
            }
        };

        void loadProfile();

        return () => {
            active = false;
        };
    }, [deriveNames]);

    useEffect(() => {
        setLanguage(locale);
    }, [locale]);

    const handleSave = async () => {
        setSettingsSaving(true);
        setSettingsMessage(null);
        try {
            const res = await fetch(withBasePath('/api/current-user'), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ locale: language }),
            });
            const data = await res.json();
            if (!res.ok) {
                setSettingsMessage({
                    text: data.error || t('settings.profileUpdateError', 'Не удалось обновить профиль'),
                    severity: 'error',
                });
                return;
            }
            setSettingsMessage({ text: t('settings.saved', 'Настройки сохранены'), severity: 'success' });
        } catch (error) {
            setSettingsMessage({
                text:
                    error instanceof Error
                        ? error.message
                        : t('settings.profileUpdateError', 'Ошибка обновления профиля'),
                severity: 'error',
            });
        } finally {
            setSettingsSaving(false);
        }
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!profile) return;

        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch(withBasePath('/api/profile'), {
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
                    text: data.error || t('profile.update.error', 'Не удалось обновить профиль'),
                });
                return;
            }
            if (data.profile) {
                setProfile((prev) => (prev ? { ...prev, ...data.profile } : data.profile));
                deriveNames(data.profile.name);
                setBio(data.profile.bio || '');
            }
            setMessage({ type: 'success', text: t('profile.update.success', 'Профиль обновлён') });
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : t('common.error.unknown', 'Неизвестная ошибка'),
            });
        } finally {
            setSaving(false);
        }
    };

    if (loadingCurrent || loadingProfile) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (currentUserError || profileError) {
        return (
            <Box sx={{ p: 4 }}>
                <Alert severity="error">
                    {currentUserError || profileError || t('common.error.unknown', 'Неизвестная ошибка')}
                </Alert>
            </Box>
        );
    }

    if (!currentUser || !profile) {
        return null;
    }

    const isContractor = profile.profileType === 'contractor';

    return (
        <Box sx={{ p: 4, maxWidth: 760, mx: 'auto' }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
                {t('settings.title', 'Настройки профиля')}
            </Typography>
            <Paper sx={{ p: 3 }}>
                <Typography variant="subtitle1">
                    {t('settings.userLabel', '{name} ({email})', {
                        name: currentUser.name ?? '',
                        email: currentUser.email ?? '',
                    })}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {t('settings.roleLabel', 'Роль в платформе: {role}', {
                        role: currentUser.platformRole ?? '',
                    })}
                </Typography>

                <FormControl fullWidth>
                    <InputLabel id="language-select-label">
                        {t('settings.language.label', 'Язык интерфейса')}
                    </InputLabel>
                    <Select
                        labelId="language-select-label"
                        label={t('settings.language.label', 'Язык интерфейса')}
                        value={language}
                        onChange={(e) => {
                            const next = e.target.value === 'en' ? 'en' : 'ru';
                            setLanguage(next);
                            setLocale(next);
                        }}
                    >
                        <MenuItem value="ru">{t('settings.language.ru', 'Русский')}</MenuItem>
                        <MenuItem value="en">{t('settings.language.en', 'English')}</MenuItem>
                    </Select>
                    <FormHelperText>
                        {t('settings.language.helper', 'Изменения применяются сразу и сохраняются для вашего аккаунта.')}
                    </FormHelperText>
                </FormControl>

                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                    <Button variant="contained" onClick={handleSave} disabled={settingsSaving}>
                        {settingsSaving ? <CircularProgress size={20} /> : t('common.save', 'Сохранить')}
                    </Button>
                </Box>

                {settingsMessage && (
                    <Alert sx={{ mt: 2 }} severity={settingsMessage.severity}>
                        {settingsMessage.text}
                    </Alert>
                )}
            </Paper>

            <ProfileEditForm
                firstName={firstName}
                lastName={lastName}
                phone={profile.phone}
                regionCode={profile.regionCode}
                email={profile.email}
                bio={bio}
                isContractor={isContractor}
                readOnly={false}
                saving={saving}
                uploading={false}
                canEdit
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
                    setProfile((prev) => (prev ? { ...prev, phone: value } : prev))
                }
                onRegionChange={(value) =>
                    setProfile((prev) => (prev ? { ...prev, regionCode: value } : prev))
                }
                onBioChange={(value) => setBio(value)}
                onMessageClose={() => setMessage(null)}
            />
        </Box>
    );
}
