import * as React from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Stack,
    TextField,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import type { ProjectDTO } from '@/types/org';
import { useI18n } from '@/i18n/I18nProvider';

type IntegrationDialogProps = {
    open: boolean;
    mode: 'create' | 'edit';
    submitting: boolean;
    canRequestIntegrations: boolean;
    integrationType: string;
    integrationName: string;
    integrationWebhookUrl: string;
    integrationProjectId: string;
    integrationConfigJson: string;
    projects: ProjectDTO[];
    onClose: () => void;
    onSubmit: () => void;
    onChangeType: (value: string) => void;
    onChangeName: (value: string) => void;
    onChangeWebhookUrl: (value: string) => void;
    onChangeProjectId: (value: string) => void;
    onChangeConfigJson: (value: string) => void;
    cardHeaderSx: SxProps<Theme>;
    cardContentSx: SxProps<Theme>;
    dialogPaperSx: SxProps<Theme>;
    dialogActionsSx: SxProps<Theme>;
};

export default function IntegrationDialog({
    open,
    mode,
    submitting,
    canRequestIntegrations,
    integrationType,
    integrationName,
    integrationWebhookUrl,
    integrationProjectId,
    integrationConfigJson,
    projects,
    onClose,
    onSubmit,
    onChangeType,
    onChangeName,
    onChangeWebhookUrl,
    onChangeProjectId,
    onChangeConfigJson,
    cardHeaderSx,
    cardContentSx,
    dialogPaperSx,
    dialogActionsSx,
}: IntegrationDialogProps) {
    const { t } = useI18n();
    return (
        <Dialog
            open={open}
            onClose={submitting ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: dialogPaperSx,
                },
            }}
        >
            <DialogTitle sx={cardHeaderSx}>
                {mode === 'edit'
                    ? t('org.integrations.dialog.editTitle', 'Редактирование интеграции')
                    : t('org.integrations.dialog.createTitle', 'Запрос на подключение интеграции')}
            </DialogTitle>
            <DialogContent dividers sx={cardContentSx}>
                <Stack spacing={2}>
                    <TextField
                        select
                        label={t('org.integrations.fields.type', 'Тип интеграции')}
                        value={integrationType}
                        onChange={(event) => onChangeType(event.target.value)}
                        fullWidth
                        disabled={mode === 'edit'}
                    >
                        <MenuItem value="google_sheets">Google Sheets</MenuItem>
                        <MenuItem value="telegram">Telegram</MenuItem>
                        <MenuItem value="erp_1c">1C ERP</MenuItem>
                    </TextField>
                    <TextField
                        label={t('org.integrations.fields.name', 'Название (опционально)')}
                        value={integrationName}
                        onChange={(event) => onChangeName(event.target.value)}
                        fullWidth
                    />
                    <TextField
                        label={t('org.integrations.fields.webhook', 'Webhook URL')}
                        value={integrationWebhookUrl}
                        onChange={(event) => onChangeWebhookUrl(event.target.value)}
                        fullWidth
                        required
                    />
                    <TextField
                        select
                        label={t('org.integrations.fields.project', 'Проект (опционально)')}
                        value={integrationProjectId}
                        onChange={(event) => onChangeProjectId(event.target.value)}
                        fullWidth
                    >
                        <MenuItem value="">{t('org.integrations.allProjects', 'Все проекты')}</MenuItem>
                        {projects.map((project) => (
                            <MenuItem key={project._id} value={project._id}>
                                {project.name}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        label={t('org.integrations.fields.config', 'Config JSON (опционально)')}
                        value={integrationConfigJson}
                        onChange={(event) => onChangeConfigJson(event.target.value)}
                        fullWidth
                        multiline
                        minRows={3}
                        placeholder='{"sheetId":"...","sheetName":"...","keyField":"taskId"}'
                        helperText={
                            mode === 'edit'
                                ? t(
                                      'org.integrations.fields.configHint',
                                      'Оставьте пустым, чтобы не менять конфигурацию'
                                  )
                                : undefined
                        }
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={dialogActionsSx}>
                <Button onClick={onClose} disabled={submitting}>
                    {t('common.cancel', 'Отмена')}
                </Button>
                <Button
                    variant="contained"
                    onClick={onSubmit}
                    disabled={submitting || !canRequestIntegrations}
                >
                    {submitting
                        ? t('common.saving', 'Сохраняем…')
                        : mode === 'edit'
                            ? t('common.save', 'Сохранить')
                            : t('common.create', 'Создать')}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
