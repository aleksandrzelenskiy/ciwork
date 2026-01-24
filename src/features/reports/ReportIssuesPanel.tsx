import { Box, Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddCircleOutlineOutlinedIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useEffect, useState } from 'react';
import { normalizeStatusTitle } from '@/utils/statusLabels';
import { useI18n } from '@/i18n/I18nProvider';

type ReportIssuesPanelProps = {
    issues: string[];
    canEdit: boolean;
    onSave: (issues: string[]) => Promise<void>;
    status?: string;
};

export default function ReportIssuesPanel({
    issues,
    canEdit,
    onSave,
    status,
}: ReportIssuesPanelProps) {
    const { t } = useI18n();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<string[]>(issues.length ? issues : ['']);
    const [saving, setSaving] = useState(false);
    const isAgreed = normalizeStatusTitle(status) === 'Agreed';
    const canEditIssues = canEdit && !isAgreed;

    useEffect(() => {
        if (!editing) {
            setDraft(issues.length ? issues : ['']);
        }
    }, [issues, editing]);

    useEffect(() => {
        if (isAgreed && editing) {
            setEditing(false);
        }
    }, [isAgreed, editing]);

    const handleStartEdit = () => {
        setDraft(issues.length ? issues : ['']);
        setEditing(true);
    };

    const handleCancel = () => {
        if (saving) return;
        setEditing(false);
    };

    const handleChange = (index: number, value: string) => {
        setDraft((prev) => prev.map((item, idx) => (idx === index ? value : item)));
    };

    const handleAdd = () => {
        setDraft((prev) => [...prev, '']);
    };

    const handleRemove = (index: number) => {
        setDraft((prev) => {
            const next = prev.filter((_, idx) => idx !== index);
            return next.length ? next : [''];
        });
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        const cleaned = draft.map((i) => i.trim()).filter(Boolean);
        await onSave(cleaned);
        setSaving(false);
        setEditing(false);
    };

    return (
        <Box
            sx={(theme) => ({
                borderRadius: 4,
                border:
                    theme.palette.mode === 'dark'
                        ? '1px solid rgba(148,163,184,0.18)'
                        : '1px solid rgba(15,23,42,0.08)',
                p: 3,
                background:
                    theme.palette.mode === 'dark'
                        ? 'rgba(15,18,26,0.92)'
                        : 'rgba(255,255,255,0.9)',
            })}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                    {t('reports.issues.title', 'Замечания')}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    {canEditIssues && !editing && (
                        <Button size="small" variant="text" onClick={handleStartEdit}>
                            {issues.length
                                ? t('reports.issues.edit', 'Редактировать')
                                : t('reports.issues.add', 'Добавить')}
                        </Button>
                    )}
                </Stack>
            </Stack>

            {(!editing || isAgreed) && (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                    {issues.length ? (
                        issues.map((issue, idx) => (
                            <Typography key={`issue-${idx}`} variant="body2">
                                {idx + 1}. {issue}
                            </Typography>
                        ))
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            {t('reports.issues.empty', 'Замечаний нет.')}
                        </Typography>
                    )}
                </Stack>
            )}

            {editing && !isAgreed && (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                    {draft.map((issue, idx) => (
                        <Stack key={`draft-${idx}`} direction="row" spacing={1} alignItems="center">
                            <TextField
                                value={issue}
                                onChange={(event) => handleChange(idx, event.target.value)}
                                label={t('reports.issues.item', 'Замечание {index}', { index: idx + 1 })}
                                size="small"
                                fullWidth
                            />
                            <Tooltip title={t('reports.issues.remove', 'Удалить замечание')}>
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleRemove(idx)}
                                        aria-label={t('reports.issues.remove', 'Удалить замечание')}
                                        disabled={saving}
                                    >
                                        <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </Stack>
                    ))}
                    <Stack direction="row" spacing={1}>
                        <Tooltip title={t('reports.issues.add', 'Добавить замечание')}>
                            <span>
                                <IconButton
                                    onClick={handleAdd}
                                    aria-label={t('reports.issues.add', 'Добавить замечание')}
                                    disabled={saving}
                                >
                                    <AddCircleOutlineOutlinedIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Button variant="contained" onClick={handleSave} disabled={saving}>
                            {saving ? t('reports.issues.saving', 'Сохраняем…') : t('common.save', 'Сохранить')}
                        </Button>
                        <Button variant="text" onClick={handleCancel} disabled={saving}>
                            {t('common.cancel', 'Отмена')}
                        </Button>
                    </Stack>
                </Stack>
            )}
        </Box>
    );
}
