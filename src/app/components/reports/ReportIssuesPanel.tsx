import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

type ReportIssuesPanelProps = {
    issues: string[];
    canEdit: boolean;
    onSave: (issues: string[]) => Promise<void>;
    canUploadFix?: boolean;
    onUploadFix?: () => void;
};

export default function ReportIssuesPanel({
    issues,
    canEdit,
    onSave,
    canUploadFix,
    onUploadFix,
}: ReportIssuesPanelProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<string[]>(issues.length ? issues : ['']);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!editing) {
            setDraft(issues.length ? issues : ['']);
        }
    }, [issues, editing]);

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
            sx={{
                borderRadius: 4,
                border: '1px solid rgba(15,23,42,0.08)',
                p: 3,
                background: 'rgba(255,255,255,0.9)',
            }}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                    Замечания
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    {canUploadFix && !editing && issues.length > 0 && (
                        <Button size="small" variant="contained" onClick={onUploadFix}>
                            Загрузить исправления
                        </Button>
                    )}
                    {canEdit && !editing && (
                        <Button size="small" variant="text" onClick={handleStartEdit}>
                            {issues.length ? 'Редактировать' : 'Добавить'}
                        </Button>
                    )}
                </Stack>
            </Stack>

            {!editing && (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                    {issues.length ? (
                        issues.map((issue, idx) => (
                            <Typography key={`issue-${idx}`} variant="body2">
                                {idx + 1}. {issue}
                            </Typography>
                        ))
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            Замечаний нет.
                        </Typography>
                    )}
                </Stack>
            )}

            {editing && (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                    {draft.map((issue, idx) => (
                        <TextField
                            key={`draft-${idx}`}
                            value={issue}
                            onChange={(event) => handleChange(idx, event.target.value)}
                            label={`Замечание ${idx + 1}`}
                            size="small"
                            fullWidth
                        />
                    ))}
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" onClick={handleAdd}>
                            Добавить
                        </Button>
                        <Button variant="contained" onClick={handleSave} disabled={saving}>
                            {saving ? 'Сохраняем…' : 'Сохранить'}
                        </Button>
                        <Button variant="text" onClick={handleCancel} disabled={saving}>
                            Отмена
                        </Button>
                    </Stack>
                </Stack>
            )}
        </Box>
    );
}
