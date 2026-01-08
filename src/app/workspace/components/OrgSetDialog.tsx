'use client';

import * as React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Stack,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton,
    Tooltip,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DoneIcon from '@mui/icons-material/Done';
import { UI_RADIUS } from '@/config/uiTokens';

export type OrgSettingsFormValues = {
    plan: 'basic' | 'pro' | 'business' | 'enterprise';
    legalForm: 'ООО' | 'ИП' | 'АО' | 'ЗАО';
    organizationName: string;
    legalAddress: string;
    inn: string;
    kpp: string;
    ogrn: string;
    okpo?: string;
    bik: string;
    bankName: string;
    correspondentAccount: string;
    settlementAccount: string;
    directorTitle: string;
    directorName: string;
    directorBasis: string;
    contacts: string;
};

export const defaultOrgSettings: OrgSettingsFormValues = {
    plan: 'basic',
    legalForm: 'ООО',
    organizationName: '',
    legalAddress: '',
    inn: '',
    kpp: '',
    ogrn: '',
    okpo: '',
    bik: '',
    bankName: '',
    correspondentAccount: '',
    settlementAccount: '',
    directorTitle: '',
    directorName: '',
    directorBasis: '',
    contacts: '',
};

type OrgSetDialogProps = {
    open: boolean;
    loading?: boolean;
    initialValues?: OrgSettingsFormValues | null;
    onCloseAction: () => void;
    onSubmit: (values: OrgSettingsFormValues) => void;
};

const LEGAL_FORMS: OrgSettingsFormValues['legalForm'][] = ['ООО', 'ИП', 'АО', 'ЗАО'];
const PLAN_OPTIONS: { value: OrgSettingsFormValues['plan']; label: string }[] = [
    { value: 'basic', label: 'Basic' },
    { value: 'pro', label: 'Pro' },
    { value: 'business', label: 'Business' },
    { value: 'enterprise', label: 'Enterprise' },
];

export default function OrgSetDialog({
                                         open,
                                         loading = false,
                                         initialValues,
                                         onCloseAction,
                                         onSubmit,
                                     }: OrgSetDialogProps) {
    const [form, setForm] = React.useState<OrgSettingsFormValues>(defaultOrgSettings);
    const [isEditing, setIsEditing] = React.useState(false);
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const paperBg = isDark ? 'rgba(10,13,20,0.92)' : 'rgba(255,255,255,0.9)';
    const paperBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const paperShadow = isDark ? '0 40px 80px rgba(0,0,0,0.7)' : '0 30px 70px rgba(15,23,42,0.2)';
    const sectionBg = isDark ? 'rgba(16,21,32,0.9)' : 'rgba(248,250,252,0.92)';
    const sectionBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';

    React.useEffect(() => {
        if (!open) return;
        const hasInitial = Boolean(initialValues);
        setForm({ ...defaultOrgSettings, ...(initialValues ?? {}) });
        setIsEditing(!hasInitial);
    }, [open, initialValues]);

    const handleChange = (field: keyof OrgSettingsFormValues) =>
        (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const { value } = event.target;
            setForm((prev) => ({ ...prev, [field]: value }));
        };

    const handleLegalFormChange = (event: SelectChangeEvent<OrgSettingsFormValues['legalForm']>) => {
        setForm((prev) => ({ ...prev, legalForm: event.target.value as OrgSettingsFormValues['legalForm'] }));
    };

    const handleSubmit = () => {
        onSubmit(form);
    };

    const disableSubmit = loading || !form.organizationName.trim() || !form.inn.trim();
    const submitDisabled = !isEditing || disableSubmit;

    const hasExistingData = Boolean(initialValues);
    const requisitesTitle = form.organizationName?.trim() || initialValues?.organizationName?.trim() || 'организации';

    const isIndividualEntrepreneur = form.legalForm === 'ИП';
    const requisitesComplete = React.useMemo(() => {
        const requiredBase = [
            form.organizationName,
            form.legalAddress,
            form.inn,
            form.ogrn,
            form.bik,
            form.bankName,
            form.correspondentAccount,
            form.settlementAccount,
            form.contacts,
        ];
        if (!isIndividualEntrepreneur) {
            requiredBase.push(form.kpp, form.directorTitle, form.directorName, form.directorBasis);
        }
        return requiredBase.every((value) => value?.trim());
    }, [
        form.organizationName,
        form.legalAddress,
        form.inn,
        form.ogrn,
        form.bik,
        form.bankName,
        form.correspondentAccount,
        form.settlementAccount,
        form.contacts,
        form.kpp,
        form.directorTitle,
        form.directorName,
        form.directorBasis,
        isIndividualEntrepreneur,
    ]);

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onCloseAction}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    backdropFilter: 'blur(20px)',
                    backgroundColor: paperBg,
                    border: `1px solid ${paperBorder}`,
                    boxShadow: paperShadow,
                    borderRadius: UI_RADIUS.surface,
                },
            }}
        >
            <DialogTitle>Настройки организации</DialogTitle>
            <DialogContent
                dividers
                sx={{
                    backgroundColor: sectionBg,
                    borderTop: `1px solid ${sectionBorder}`,
                }}
            >
                <Stack spacing={1.5} sx={{ mb: 2 }} />

                {isEditing ? (
                    <Stack
                        spacing={3}
                        sx={{
                            mt: 1,
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                            },
                        }}
                    >
                        <Stack spacing={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="plan-label">Тариф</InputLabel>
                                <Select
                                    labelId="plan-label"
                                    label="Тариф"
                                    value={form.plan}
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            plan: event.target.value as OrgSettingsFormValues['plan'],
                                        }))
                                    }
                                    disabled={loading}
                                >
                                    {PLAN_OPTIONS.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel id="legal-form-label">Форма</InputLabel>
                                <Select
                                    labelId="legal-form-label"
                                    label="Форма"
                                    value={form.legalForm}
                                    onChange={handleLegalFormChange}
                                    disabled={loading}
                                >
                                    {LEGAL_FORMS.map((option) => (
                                        <MenuItem key={option} value={option}>
                                            {option}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                label="Наименование организации"
                                value={form.organizationName}
                                onChange={handleChange('organizationName')}
                                fullWidth
                                size="small"
                                disabled={loading}
                            />
                            <TextField
                                label="Юридический адрес"
                                value={form.legalAddress}
                                onChange={handleChange('legalAddress')}
                                fullWidth
                                size="small"
                                disabled={loading}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="ИНН"
                                    value={form.inn}
                                    onChange={handleChange('inn')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                                <TextField
                                    label="КПП"
                                    value={form.kpp}
                                    onChange={handleChange('kpp')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="ОГРН / ОГРНИП"
                                    value={form.ogrn}
                                    onChange={handleChange('ogrn')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                                <TextField
                                    label="ОКПО (необязательно)"
                                    value={form.okpo}
                                    onChange={handleChange('okpo')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                            </Stack>
                        </Stack>

                        <Stack spacing={2}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="БИК"
                                    value={form.bik}
                                    onChange={handleChange('bik')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                                <TextField
                                    label="Банк"
                                    value={form.bankName}
                                    onChange={handleChange('bankName')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                            </Stack>
                            <TextField
                                label="Корреспондентский счёт"
                                value={form.correspondentAccount}
                                onChange={handleChange('correspondentAccount')}
                                fullWidth
                                size="small"
                                disabled={loading}
                            />
                            <TextField
                                label="Расчётный счёт"
                                value={form.settlementAccount}
                                onChange={handleChange('settlementAccount')}
                                fullWidth
                                size="small"
                                disabled={loading}
                            />
                        </Stack>

                        {!isIndividualEntrepreneur && (
                            <Stack spacing={2}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                    <TextField
                                        label="Должность"
                                        value={form.directorTitle}
                                        onChange={handleChange('directorTitle')}
                                        fullWidth
                                        size="small"
                                        disabled={loading}
                                    />
                                    <TextField
                                        label="ФИО"
                                        value={form.directorName}
                                        onChange={handleChange('directorName')}
                                        fullWidth
                                        size="small"
                                        disabled={loading}
                                    />
                                </Stack>
                                <TextField
                                    label="Основание действий"
                                    value={form.directorBasis}
                                    onChange={handleChange('directorBasis')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                            </Stack>
                        )}

                        <TextField
                            label="Контактные данные"
                            value={form.contacts}
                            onChange={handleChange('contacts')}
                            fullWidth
                            multiline
                            minRows={3}
                            disabled={loading}
                        />
                    </Stack>
                ) : (
                    <Accordion
                        disableGutters
                        sx={{
                            backgroundColor: sectionBg,
                            border: `1px solid ${sectionBorder}`,
                            borderRadius: UI_RADIUS.item,
                            '&::before': { display: 'none' },
                        }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                                <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    Реквизиты {requisitesTitle}
                                    {hasExistingData && (
                                        <Tooltip title="Изменить реквизиты">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setIsEditing(true);
                                                    }}
                                                >
                                                    <EditNoteIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    )}
                                </Typography>
                                {hasExistingData && requisitesComplete && (
                                    <DoneIcon color="success" fontSize="small" />
                                )}
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                            {hasExistingData ? (
                                <Stack spacing={1.5} sx={{ mt: 1 }}>
                                    <Typography variant="body2"><strong>Тариф:</strong> {form.plan?.toUpperCase() || '—'}</Typography>
                                    <Typography variant="body2"><strong>Форма:</strong> {form.legalForm || '—'}</Typography>
                                    <Typography variant="body2"><strong>Наименование:</strong> {form.organizationName || '—'}</Typography>
                                    <Typography variant="body2"><strong>Юр. адрес:</strong> {form.legalAddress || '—'}</Typography>
                                    <Typography variant="body2"><strong>ИНН / КПП:</strong> {form.inn || '—'} / {form.kpp || '—'}</Typography>
                                    <Typography variant="body2"><strong>ОГРН / ОГРНИП:</strong> {form.ogrn || '—'}</Typography>
                                    <Typography variant="body2"><strong>ОКПО:</strong> {form.okpo || '—'}</Typography>
                                    <Typography variant="body2"><strong>Банк:</strong> {form.bankName || '—'}</Typography>
                                    <Typography variant="body2"><strong>БИК:</strong> {form.bik || '—'}</Typography>
                                    <Typography variant="body2"><strong>К/с:</strong> {form.correspondentAccount || '—'}</Typography>
                                    <Typography variant="body2"><strong>Р/с:</strong> {form.settlementAccount || '—'}</Typography>
                                    {!isIndividualEntrepreneur && (
                                        <>
                                            <Typography variant="body2">
                                                <strong>Руководитель:</strong> {form.directorTitle || '—'} — {form.directorName || '—'}
                                            </Typography>
                                            <Typography variant="body2">
                                                <strong>Основание:</strong> {form.directorBasis || '—'}
                                            </Typography>
                                        </>
                                    )}
                                    <Typography variant="body2"><strong>Контакты:</strong> {form.contacts || '—'}</Typography>
                                </Stack>
                            ) : (
                                <Typography color="text.secondary">
                                    Реквизиты ещё не заполнены. Нажмите «Изменить реквизиты», чтобы добавить данные.
                                </Typography>
                            )}
                        </AccordionDetails>
                    </Accordion>
                )}
            </DialogContent>
            <DialogActions
                sx={{
                    backgroundColor: paperBg,
                    borderTop: `1px solid ${sectionBorder}`,
                }}
            >
                <Button onClick={onCloseAction} disabled={loading}>
                    Закрыть
                </Button>
                <Button variant="contained" disabled={submitDisabled} onClick={handleSubmit}>
                    Сохранить
                </Button>
            </DialogActions>
        </Dialog>
    );
}
