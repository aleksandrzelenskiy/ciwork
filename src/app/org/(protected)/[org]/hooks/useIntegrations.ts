import * as React from 'react';

import type { IntegrationDTO } from '@/types/org';
import { useI18n } from '@/i18n/I18nProvider';

type UseIntegrationsState = {
    integrations: IntegrationDTO[];
    integrationsLoading: boolean;
    integrationsError: string | null;
    fetchIntegrations: () => Promise<void>;
};

export default function useIntegrations(
    org: string | undefined,
    canManage: boolean
): UseIntegrationsState {
    const { t } = useI18n();
    const [integrations, setIntegrations] = React.useState<IntegrationDTO[]>([]);
    const [integrationsLoading, setIntegrationsLoading] = React.useState(false);
    const [integrationsError, setIntegrationsError] = React.useState<string | null>(null);

    const fetchIntegrations = React.useCallback(async () => {
        if (!org || !canManage) return;
        setIntegrationsLoading(true);
        setIntegrationsError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/integrations`, { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as {
                integrations?: IntegrationDTO[];
                error?: string;
            };
            if (!res.ok || !Array.isArray(data.integrations)) {
                setIntegrations([]);
                setIntegrationsError(data.error || t('org.integrations.error.load', 'Не удалось загрузить интеграции'));
                return;
            }
            setIntegrations(data.integrations);
        } catch (error) {
            const msg = error instanceof Error ? error.message : t('org.integrations.error.load', 'Ошибка загрузки интеграций');
            setIntegrations([]);
            setIntegrationsError(msg);
        } finally {
            setIntegrationsLoading(false);
        }
    }, [org, canManage, t]);

    return {
        integrations,
        integrationsLoading,
        integrationsError,
        fetchIntegrations,
    };
}
