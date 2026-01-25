import * as React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Autocomplete,
    MenuItem,
    Stack,
    Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import TopicIcon from '@mui/icons-material/Topic';
import { RUSSIAN_REGIONS, REGION_MAP, REGION_ISO_MAP } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';
import { UI_RADIUS } from '@/config/uiTokens';
import { useI18n } from '@/i18n/I18nProvider';

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';

export type ProjectManagerOption = {
    email: string;
    name?: string;
    role?: OrgRole;
};

export type ProjectDialogValues = {
    projectId?: string;
    name: string;
    key: string;
    description?: string;
    projectType: 'installation' | 'document';
    regionCode: string;
    operator: string;
    managers: string[];
};

type Props = {
    open: boolean;
    mode: 'create' | 'edit';
    loading?: boolean;
    members: ProjectManagerOption[];
    initialData?: Partial<ProjectDialogValues>;
    onClose: () => void;
    onSubmit: (payload: ProjectDialogValues) => Promise<void> | void;
};

const REGION_LABEL = (code: string): string => {
    const region = RUSSIAN_REGIONS.find((item) => item.code === code);
    return region ? `${region.code} — ${region.label}` : code;
};

const REGION_OPTIONS = RUSSIAN_REGIONS;
const PROJECT_KEY_PATTERN = /^[A-Z0-9-]+$/;

const normalizeProjectKey = (value: string): string => value.trim().toUpperCase();
const normalizeProjectTypeValue = (
    value?: string | null
): ProjectDialogValues['projectType'] => {
    if (value === 'document' || value === 'documents') return 'document';
    if (value === 'construction') return 'installation';
    return 'installation';
};

const managerOptionLabel = (option: ProjectManagerOption) => {
    if (option.name && option.email) {
        return `${option.name} (${option.email})`;
    }
    return option.email;
};

export default function ProjectDialog({
    open,
    mode,
    loading = false,
    members,
    initialData,
    onClose,
    onSubmit,
}: Props) {
    const { t } = useI18n();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const dialogPaperBg = isDarkMode ? 'rgba(12,16,26,0.92)' : 'rgba(255,255,255,0.85)';
    const dialogPaperBorder = isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.4)';
    const dialogShadow = isDarkMode ? '0 40px 90px rgba(0,0,0,0.7)' : '0 40px 80px rgba(15,23,42,0.25)';
    const headerBg = isDarkMode
        ? 'linear-gradient(120deg, rgba(20,28,45,0.95), rgba(30,41,59,0.88))'
        : 'linear-gradient(120deg, rgba(255,255,255,0.95), rgba(243,244,255,0.85))';
    const headerBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)';
    const contentBg = isDarkMode
        ? 'linear-gradient(180deg, rgba(13,18,30,0.9), rgba(15,23,42,0.92))'
        : 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,255,0.8))';
    const actionsBg = isDarkMode ? 'rgba(15,18,28,0.9)' : 'rgba(255,255,255,0.85)';
    const inputBg = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)';
    const inputBorder = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.6)';
    const inputHoverBorder = isDarkMode ? 'rgba(125,211,252,0.6)' : 'rgba(147,197,253,0.9)';
    const inputFocusBorder = isDarkMode ? 'rgba(59,130,246,0.85)' : 'rgba(59,130,246,0.8)';

    const [name, setName] = React.useState('');
    const [key, setKey] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [projectType, setProjectType] = React.useState<ProjectDialogValues['projectType']>('installation');
    const [regionCode, setRegionCode] = React.useState<string>(REGION_OPTIONS[0]?.code ?? '');
    const [operator, setOperator] = React.useState<string>('');
    const [managerOptions, setManagerOptions] = React.useState<ProjectManagerOption[]>([]);
    const [selectedManagers, setSelectedManagers] = React.useState<ProjectManagerOption[]>([]);
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        setManagerOptions(members);
    }, [members]);

    const resolveRegionCode = React.useCallback((code?: string | null): string => {
        if (!code) return '';
        if (REGION_MAP.has(code)) return code;
        const match = REGION_ISO_MAP.get(code);
        if (match) return match.code;
        return '';
    }, []);

    const resolveRegionOption = React.useCallback(
        (code?: string | null) => {
            const resolvedCode = resolveRegionCode(code);
            if (!resolvedCode) return null;
            return REGION_OPTIONS.find((option) => option.code === resolvedCode) ?? null;
        },
        [resolveRegionCode]
    );

    React.useEffect(() => {
        if (!open) return;
        setName(initialData?.name ?? '');
        setKey(initialData?.key ?? '');
        setDescription(initialData?.description ?? '');
        setProjectType(normalizeProjectTypeValue(initialData?.projectType));
        const normalizedRegion = resolveRegionCode(initialData?.regionCode);
        const fallbackRegion = REGION_OPTIONS[0]?.code ?? '';
        setRegionCode(normalizedRegion || fallbackRegion);
        setOperator(initialData?.operator ?? '');

        const initialManagers = Array.isArray(initialData?.managers) ? initialData?.managers : [];
        const resolved = initialManagers.map((email) => {
            const option = members.find((item) => item.email === email);
            return option ?? { email };
        });
        setSelectedManagers(resolved);
    }, [open, initialData, members, resolveRegionCode]);

    const isCreate = mode === 'create';
    const busy = submitting || loading;
    const normalizedKey = key.trim();
    const normalizedKeyUpper = normalizeProjectKey(key);
    const isKeyValid = normalizedKey ? PROJECT_KEY_PATTERN.test(normalizedKeyUpper) : false;
    const isSubmitDisabled =
        !name.trim() || !normalizedKey || !isKeyValid || !regionCode || !operator || !projectType || busy;
    const keyHelperText = !normalizedKey
        ? 'Только латинские A-Z, цифры и дефис. Пример: ALPHA-1.'
        : isKeyValid
            ? `Будет сохранено как: ${normalizedKeyUpper}`
            : 'Код может содержать только латинские A-Z, цифры и дефис.';
    const glassInputSx = {
        '& .MuiOutlinedInput-root': {
            backgroundColor: inputBg,
            borderRadius: UI_RADIUS.tooltip,
            '& fieldset': { borderColor: inputBorder },
            '&:hover fieldset': { borderColor: inputHoverBorder },
            '&.Mui-focused fieldset': { borderColor: inputFocusBorder },
        },
    };

    const handleSubmit = async () => {
        if (isSubmitDisabled) return;
        setSubmitting(true);
        try {
            const payload: ProjectDialogValues = {
                projectId: initialData?.projectId,
                name: name.trim(),
                key: normalizedKeyUpper,
                description: description.trim(),
                projectType,
                regionCode,
                operator,
                managers: Array.from(
                    new Set(
                        selectedManagers
                            .map((option) => option.email?.trim().toLowerCase())
                            .filter((email): email is string => Boolean(email))
                    )
                ),
            };
            await onSubmit(payload);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    backdropFilter: 'blur(28px)',
                    backgroundColor: dialogPaperBg,
                    border: `1px solid ${dialogPaperBorder}`,
                    borderRadius: UI_RADIUS.surface,
                    boxShadow: dialogShadow,
                },
            }}
        >
            <DialogTitle
                sx={{
                    background: headerBg,
                    borderBottom: `1px solid ${headerBorder}`,
                    fontWeight: 600,
                }}
            >
                <Stack direction="row" spacing={1.5} alignItems="center">
                    {isCreate && <TopicIcon color="primary" />}
                    <span>{isCreate ? 'Новый проект' : 'Редактировать проект'}</span>
                </Stack>
            </DialogTitle>
            <DialogContent
                dividers
                sx={{
                    background: contentBg,
                }}
            >
                <TextField
                    label="Название"
                    fullWidth
                    sx={{ mt: 1, ...glassInputSx }}
                    value={name}
                    disabled={busy}
                    onChange={(e) => setName(e.target.value)}
                />
                <TextField
                    label="Код (KEY)"
                    fullWidth
                    sx={{ mt: 2, ...glassInputSx }}
                    value={key}
                    disabled={busy}
                    error={Boolean(normalizedKey) && !isKeyValid}
                    helperText={keyHelperText}
                    onChange={(e) => setKey(e.target.value)}
                />
                <TextField
                    label="Описание"
                    fullWidth
                    multiline
                    minRows={3}
                    sx={{ mt: 2, ...glassInputSx }}
                    value={description}
                    disabled={busy}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <Box sx={{ mt: 2 }}>
                    <TextField
                        select
                        label={t('project.type.label', 'Тип проекта')}
                        fullWidth
                        sx={glassInputSx}
                        value={projectType}
                        disabled={busy}
                        onChange={(e) => setProjectType(e.target.value as ProjectDialogValues['projectType'])}
                    >
                        <MenuItem value="installation">
                            {t('project.type.installation', 'Монтаж / строительство')}
                        </MenuItem>
                        <MenuItem value="document">
                            {t('project.type.document', 'Документация')}
                        </MenuItem>
                    </TextField>
                </Box>
                <Box sx={{ mt: 3 }}>
                    <Autocomplete
                        options={REGION_OPTIONS}
                        value={resolveRegionOption(regionCode)}
                        onChange={(_, value) => setRegionCode(value?.code ?? '')}
                        getOptionLabel={(option) => REGION_LABEL(option.code)}
                        renderOption={(props, option) => (
                            <li {...props} key={option.code}>
                                <Typography>{REGION_LABEL(option.code)}</Typography>
                            </li>
                        )}
                        disabled={busy}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Регион (код — название)"
                                sx={glassInputSx}
                            />
                        )}
                    />
                </Box>
                <Box sx={{ mt: 2 }}>
                    <Autocomplete
                        options={OPERATORS}
                        value={OPERATORS.find((item) => item.value === operator) ?? null}
                        onChange={(_, value) => setOperator(value?.value ?? '')}
                        getOptionLabel={(option) => option.label}
                        disabled={busy}
                        renderInput={(params) => (
                            <TextField {...params} label="Оператор" sx={glassInputSx} />
                        )}
                    />
                </Box>
                <Box sx={{ mt: 2 }}>
                    <Autocomplete
                        multiple
                        options={managerOptions}
                        value={selectedManagers}
                        getOptionLabel={managerOptionLabel}
                        isOptionEqualToValue={(option, value) => option.email === value.email}
                        disabled={busy}
                        onChange={(_, value) => setSelectedManagers(value)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Менеджеры проекта"
                                placeholder="Выберите участников"
                                sx={glassInputSx}
                            />
                        )}
                        renderOption={(props, option) => (
                            <li {...props} key={option.email}>
                                <Stack>
                                    <Typography>{managerOptionLabel(option)}</Typography>
                                    {option.role && (
                                        <Typography variant="caption" color="text.secondary">
                                            Роль: {option.role}
                                        </Typography>
                                    )}
                                </Stack>
                            </li>
                        )}
                    />
                </Box>
            </DialogContent>
            <DialogActions
                sx={{
                    backgroundColor: actionsBg,
                    borderTop: `1px solid ${headerBorder}`,
                }}
            >
                <Button onClick={onClose} disabled={busy} sx={{ borderRadius: UI_RADIUS.pill, px: 2 }}>
                    Отмена
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                    sx={{
                        borderRadius: UI_RADIUS.pill,
                        px: 3,
                        textTransform: 'none',
                        boxShadow: '0 15px 35px rgba(59,130,246,0.45)',
                    }}
                >
                    {isCreate ? 'Создать' : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
