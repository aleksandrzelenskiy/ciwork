'use client';

import type { FormEvent } from 'react';
import {
    Alert,
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
} from '@mui/material';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';

type MessageState = { type: 'success' | 'error'; text: string } | null;

type ProfileEditFormProps = {
    firstName: string;
    lastName: string;
    phone: string;
    regionCode: string;
    email: string;
    bio: string;
    isContractor: boolean;
    readOnly: boolean;
    saving: boolean;
    uploading: boolean;
    canEdit: boolean;
    message: MessageState;
    onSubmit: (event: FormEvent) => void;
    onFirstNameChange: (value: string) => void;
    onLastNameChange: (value: string) => void;
    onPhoneChange: (value: string) => void;
    onRegionChange: (value: string) => void;
    onBioChange: (value: string) => void;
    onMessageClose: () => void;
};

export default function ProfileEditForm({
    firstName,
    lastName,
    phone,
    regionCode,
    email,
    bio,
    isContractor,
    readOnly,
    saving,
    uploading,
    canEdit,
    message,
    onSubmit,
    onFirstNameChange,
    onLastNameChange,
    onPhoneChange,
    onRegionChange,
    onBioChange,
    onMessageClose,
}: ProfileEditFormProps) {
    return (
        <Paper
            component="form"
            onSubmit={onSubmit}
            sx={{ p: { xs: 3, sm: 4 }, mt: 3 }}
        >
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Данные профиля
            </Typography>
            <Box sx={{ display: 'grid', gap: 2.5 }}>
                <TextField
                    label="Имя"
                    value={firstName}
                    onChange={(e) => onFirstNameChange(e.target.value)}
                    required
                    disabled={readOnly}
                />

                <TextField
                    label="Фамилия"
                    value={lastName}
                    onChange={(e) => onLastNameChange(e.target.value)}
                    disabled={readOnly}
                />

                <TextField
                    label="Телефон"
                    value={phone}
                    onChange={(e) => onPhoneChange(e.target.value)}
                    disabled={readOnly}
                />

                <FormControl fullWidth disabled={readOnly}>
                    <InputLabel id="profile-region-label">Регион</InputLabel>
                    <Select
                        labelId="profile-region-label"
                        label="Регион"
                        value={regionCode}
                        onChange={(e) => onRegionChange(e.target.value)}
                    >
                        {RUSSIAN_REGIONS.map((region) => (
                            <MenuItem key={region.code} value={region.code}>
                                {region.code} — {region.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <TextField label="Email" value={email} disabled />

                {isContractor && (
                    <Stack spacing={2}>
                        <Typography variant="subtitle1" fontWeight={600}>
                            Профиль подрядчика
                        </Typography>
                        <TextField
                            label="О себе"
                            multiline
                            minRows={3}
                            value={bio}
                            onChange={(e) => onBioChange(e.target.value)}
                            placeholder="Кратко опишите опыт и специализацию"
                            disabled={readOnly}
                        />
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
                </Box>

                {message && (
                    <Alert severity={message.type} onClose={onMessageClose}>
                        {message.text}
                    </Alert>
                )}
            </Box>
        </Paper>
    );
}
