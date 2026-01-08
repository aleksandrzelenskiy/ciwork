import * as React from 'react';

import type { IntegrationDTO } from '@/types/org';

type SnackSetter = (state: { open: boolean; msg: string; sev: 'success' | 'error' | 'info' }) => void;

type UseIntegrationManagerState = {
    integrationDialogOpen: boolean;
    integrationSubmitting: boolean;
    integrationDialogMode: 'create' | 'edit';
    integrationType: string;
    integrationName: string;
    integrationWebhookUrl: string;
    integrationProjectId: string;
    integrationConfigJson: string;
    integrationToEdit: IntegrationDTO | null;
    integrationToDelete: IntegrationDTO | null;
    integrationDeleting: boolean;
    integrationSecretDialogOpen: boolean;
    integrationWebhookSecret: string;
    integrationKeyDialogOpen: boolean;
    generatedKeyId: string;
    generatedKeySecret: string;
    setIntegrationDialogOpen: (open: boolean) => void;
    setIntegrationToDelete: (integration: IntegrationDTO | null) => void;
    openIntegrationDialog: () => void;
    openEditIntegrationDialog: (integration: IntegrationDTO) => void;
    submitIntegrationRequest: () => Promise<void>;
    toggleIntegrationStatus: (integration: IntegrationDTO) => Promise<void>;
    confirmDeleteIntegration: () => Promise<void>;
    generateIntegrationKey: () => Promise<void>;
    setIntegrationType: (value: string) => void;
    setIntegrationName: (value: string) => void;
    setIntegrationWebhookUrl: (value: string) => void;
    setIntegrationProjectId: (value: string) => void;
    setIntegrationConfigJson: (value: string) => void;
    setIntegrationSecretDialogOpen: (open: boolean) => void;
    setIntegrationKeyDialogOpen: (open: boolean) => void;
};

export default function useIntegrationManager(
    org: string | undefined,
    canRequestIntegrations: boolean,
    isSuperAdmin: boolean,
    setSnack: SnackSetter,
    refreshIntegrations: () => Promise<void>
): UseIntegrationManagerState {
    const [integrationDialogOpen, setIntegrationDialogOpen] = React.useState(false);
    const [integrationSubmitting, setIntegrationSubmitting] = React.useState(false);
    const [integrationDialogMode, setIntegrationDialogMode] = React.useState<'create' | 'edit'>('create');
    const [integrationType, setIntegrationType] = React.useState('google_sheets');
    const [integrationName, setIntegrationName] = React.useState('');
    const [integrationWebhookUrl, setIntegrationWebhookUrl] = React.useState('');
    const [integrationProjectId, setIntegrationProjectId] = React.useState('');
    const [integrationConfigJson, setIntegrationConfigJson] = React.useState('');
    const [integrationToEdit, setIntegrationToEdit] = React.useState<IntegrationDTO | null>(null);
    const [integrationToDelete, setIntegrationToDelete] = React.useState<IntegrationDTO | null>(null);
    const [integrationDeleting, setIntegrationDeleting] = React.useState(false);
    const [integrationSecretDialogOpen, setIntegrationSecretDialogOpen] = React.useState(false);
    const [integrationWebhookSecret, setIntegrationWebhookSecret] = React.useState('');
    const [integrationKeyDialogOpen, setIntegrationKeyDialogOpen] = React.useState(false);
    const [generatedKeyId, setGeneratedKeyId] = React.useState('');
    const [generatedKeySecret, setGeneratedKeySecret] = React.useState('');

    const openIntegrationDialog = () => {
        setIntegrationType('google_sheets');
        setIntegrationName('');
        setIntegrationWebhookUrl('');
        setIntegrationProjectId('');
        setIntegrationConfigJson('');
        setIntegrationToEdit(null);
        setIntegrationDialogMode('create');
        setIntegrationDialogOpen(true);
    };

    const openEditIntegrationDialog = (integration: IntegrationDTO) => {
        setIntegrationType(integration.type);
        setIntegrationName(integration.name || '');
        setIntegrationWebhookUrl(integration.webhookUrl || '');
        setIntegrationProjectId(integration.projectId || '');
        setIntegrationConfigJson('');
        setIntegrationToEdit(integration);
        setIntegrationDialogMode('edit');
        setIntegrationDialogOpen(true);
    };

    const submitIntegrationRequest = async () => {
        if (!org || !canRequestIntegrations) return;
        if (!integrationWebhookUrl.trim()) {
            setSnack({ open: true, msg: 'Укажите URL вебхука', sev: 'error' });
            return;
        }
        let parsedConfig: Record<string, unknown> = {};
        if (integrationConfigJson.trim()) {
            try {
                parsedConfig = JSON.parse(integrationConfigJson);
            } catch {
                setSnack({ open: true, msg: 'Некорректный JSON в конфигурации', sev: 'error' });
                return;
            }
        }
        setIntegrationSubmitting(true);
        try {
            const isEdit = integrationDialogMode === 'edit' && integrationToEdit;
            const endpoint = isEdit
                ? `/api/org/${encodeURIComponent(org)}/integrations/${integrationToEdit?._id}`
                : `/api/org/${encodeURIComponent(org)}/integrations`;
            const method = isEdit ? 'PATCH' : 'POST';
            const body = isEdit
                ? {
                    name: integrationName.trim() || '',
                    webhookUrl: integrationWebhookUrl.trim(),
                    projectId: integrationProjectId || null,
                    ...(integrationConfigJson.trim() ? { config: parsedConfig } : {}),
                }
                : {
                    type: integrationType,
                    name: integrationName.trim() || undefined,
                    webhookUrl: integrationWebhookUrl.trim(),
                    projectId: integrationProjectId || undefined,
                    config: parsedConfig,
                };
            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = (await res.json().catch(() => ({}))) as { webhookSecret?: string; error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data.error || res.statusText, sev: 'error' });
                return;
            }
            if (data.webhookSecret) {
                setIntegrationWebhookSecret(data.webhookSecret);
                setIntegrationSecretDialogOpen(true);
            }
            setSnack({
                open: true,
                msg: isEdit ? 'Интеграция обновлена' : 'Интеграция создана',
                sev: 'success',
            });
            setIntegrationDialogOpen(false);
            await refreshIntegrations();
        } finally {
            setIntegrationSubmitting(false);
        }
    };

    const toggleIntegrationStatus = async (integration: IntegrationDTO) => {
        if (!org || !canRequestIntegrations) return;
        const nextStatus = integration.status === 'active' ? 'paused' : 'active';
        try {
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/integrations/${integration._id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: nextStatus }),
                }
            );
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data.error || res.statusText, sev: 'error' });
                return;
            }
            setSnack({
                open: true,
                msg: nextStatus === 'active' ? 'Интеграция включена' : 'Интеграция приостановлена',
                sev: 'success',
            });
            await refreshIntegrations();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Ошибка обновления интеграции';
            setSnack({ open: true, msg, sev: 'error' });
        }
    };

    const confirmDeleteIntegration = async () => {
        if (!org || !integrationToDelete || !canRequestIntegrations) return;
        setIntegrationDeleting(true);
        try {
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/integrations/${integrationToDelete._id}`,
                { method: 'DELETE' }
            );
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data.error || res.statusText, sev: 'error' });
                return;
            }
            setSnack({ open: true, msg: 'Интеграция удалена', sev: 'success' });
            setIntegrationToDelete(null);
            await refreshIntegrations();
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Ошибка удаления интеграции';
            setSnack({ open: true, msg, sev: 'error' });
        } finally {
            setIntegrationDeleting(false);
        }
    };

    const generateIntegrationKey = async () => {
        if (!org || !isSuperAdmin) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/integrations/keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scopes: ['tasks:read'] }),
            });
            const data = (await res.json().catch(() => ({}))) as {
                keyId?: string;
                keySecret?: string;
                error?: string;
            };
            if (!res.ok || !data.keyId || !data.keySecret) {
                setSnack({ open: true, msg: data.error || res.statusText, sev: 'error' });
                return;
            }
            setGeneratedKeyId(data.keyId);
            setGeneratedKeySecret(data.keySecret);
            setIntegrationKeyDialogOpen(true);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Ошибка создания ключа';
            setSnack({ open: true, msg, sev: 'error' });
        }
    };

    return {
        integrationDialogOpen,
        integrationSubmitting,
        integrationDialogMode,
        integrationType,
        integrationName,
        integrationWebhookUrl,
        integrationProjectId,
        integrationConfigJson,
        integrationToEdit,
        integrationToDelete,
        integrationDeleting,
        integrationSecretDialogOpen,
        integrationWebhookSecret,
        integrationKeyDialogOpen,
        generatedKeyId,
        generatedKeySecret,
        setIntegrationDialogOpen,
        setIntegrationToDelete,
        openIntegrationDialog,
        openEditIntegrationDialog,
        submitIntegrationRequest,
        toggleIntegrationStatus,
        confirmDeleteIntegration,
        generateIntegrationKey,
        setIntegrationType,
        setIntegrationName,
        setIntegrationWebhookUrl,
        setIntegrationProjectId,
        setIntegrationConfigJson,
        setIntegrationSecretDialogOpen,
        setIntegrationKeyDialogOpen,
    };
}
