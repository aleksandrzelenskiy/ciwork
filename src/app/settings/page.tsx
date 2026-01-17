'use client';

import { useEffect, useState } from 'react';
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
} from '@mui/material';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import { withBasePath } from '@/utils/basePath';

interface ProfileResponse {
  name?: string;
  email?: string;
  platformRole?: string;
  regionCode?: string;
  error?: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [regionCode, setRegionCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(withBasePath('/api/current-user'), { cache: 'no-store' });
      const data: ProfileResponse = await res.json();
      if (res.ok) {
        setProfile(data);
        setRegionCode(data.regionCode ?? '');
      } else {
        setProfile({ error: data.error || 'Не удалось загрузить профиль' });
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(withBasePath('/api/current-user'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Не удалось обновить профиль');
      }
      setMessage({ text: 'Регион обновлён', severity: 'success' });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Ошибка обновления профиля',
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
        Настройки профиля
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="subtitle1">
          {profile.name} ({profile.email})
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Роль в платформе: {profile.platformRole}
        </Typography>

        <FormControl fullWidth>
          <InputLabel id="region-select-label">Регион</InputLabel>
          <Select
            labelId="region-select-label"
            label="Регион"
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

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!regionCode || saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Сохранить'}
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
