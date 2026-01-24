'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  FormHelperText,
} from '@mui/material';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import { withBasePath } from '@/utils/basePath';
import { useI18n } from '@/i18n/I18nProvider';

interface ProfileResponse {
  name?: string;
  email?: string;
  platformRole?: string;
  regionCode?: string;
  locale?: string;
  error?: string;
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [regionCode, setRegionCode] = useState('');
  const [language, setLanguage] = useState(locale);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const tRef = useRef(t);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    (async () => {
      const res = await fetch(withBasePath('/api/current-user'), { cache: 'no-store' });
      const data: ProfileResponse = await res.json();
      if (res.ok) {
        setProfile(data);
        setRegionCode(data.regionCode ?? '');
        const resolvedLocale = data.locale === 'en' ? 'en' : 'ru';
        setLanguage(resolvedLocale);
        setLocale(resolvedLocale);
      } else {
        setProfile({
          error: data.error || tRef.current('settings.profileLoadError', 'Не удалось загрузить профиль'),
        });
      }
    })();
  }, [setLocale]);

  useEffect(() => {
    setLanguage(locale);
  }, [locale]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(withBasePath('/api/current-user'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionCode, locale: language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          text: data.error || t('settings.profileUpdateError', 'Не удалось обновить профиль'),
          severity: 'error',
        });
        setSaving(false);
        return;
      }
      setMessage({ text: t('settings.saved', 'Настройки сохранены'), severity: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : t('settings.profileUpdateError', 'Ошибка обновления профиля'),
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (profile.error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{profile.error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4, maxWidth: 640, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {t('settings.title', 'Настройки профиля')}
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1">
          {t('settings.userLabel', '{name} ({email})', { name: profile.name ?? '', email: profile.email ?? '' })}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('settings.roleLabel', 'Роль в платформе: {role}', { role: profile.platformRole ?? '' })}
        </Typography>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel id="region-select-label">{t('settings.region', 'Регион')}</InputLabel>
          <Select
            labelId="region-select-label"
            label={t('settings.region', 'Регион')}
            value={regionCode}
            onChange={(e) => setRegionCode(e.target.value)}
          >
            {RUSSIAN_REGIONS.map((region) => (
              <MenuItem key={region.code} value={region.code}>
                {region.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel id="language-select-label">{t('settings.language.label', 'Язык интерфейса')}</InputLabel>
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
          <FormHelperText>{t('settings.language.helper', 'Изменения применяются сразу и сохраняются для вашего аккаунта.')}</FormHelperText>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!regionCode || saving}
          >
            {saving ? <CircularProgress size={20} /> : t('common.save', 'Сохранить')}
          </Button>
        </Box>

        {message && (
          <Alert sx={{ mt: 2 }} severity={message.severity}>
            {message.text}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
