import * as React from 'react';

import { defaultOrgSettings } from '@/app/workspace/components/OrgSetDialog';
import type { OrgSettingsFormValues } from '@/app/workspace/components/OrgSetDialog';
import { useI18n } from '@/i18n/I18nProvider';

export default function useOrgSettings(org: string | undefined) {
    const { t } = useI18n();
    const [orgSettingsOpen, setOrgSettingsOpen] = React.useState(false);
    const [orgSettingsData, setOrgSettingsData] = React.useState<OrgSettingsFormValues | null>(null);
    const [orgSettingsLoading, setOrgSettingsLoading] = React.useState(false);
    const [orgSettingsError, setOrgSettingsError] = React.useState<string | null>(null);
    const [orgSettingsSaving, setOrgSettingsSaving] = React.useState(false);

    const fetchOrgSettings = React.useCallback(async () => {
        if (!org) return;
        setOrgSettingsLoading(true);
        setOrgSettingsError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/settings`, { cache: 'no-store' });
            const data = (await res.json()) as { settings?: OrgSettingsFormValues | null; error?: string };
            if (!res.ok || data.error) {
                setOrgSettingsError(data.error || t('org.settings.error.load', 'Не удалось загрузить реквизиты'));
                setOrgSettingsData(null);
                return;
            }
            if (data.settings) {
                setOrgSettingsData({ ...defaultOrgSettings, ...data.settings });
            } else {
                setOrgSettingsData(null);
            }
        } catch (error: unknown) {
            const msg =
                error instanceof Error ? error.message : t('org.settings.error.load', 'Ошибка загрузки реквизитов');
            setOrgSettingsError(msg);
            setOrgSettingsData(null);
        } finally {
            setOrgSettingsLoading(false);
        }
    }, [org, t]);

    const saveOrgSettings = React.useCallback(
        async (values: OrgSettingsFormValues) => {
            if (!org) return { ok: false, error: t('org.settings.error.save', 'Не удалось сохранить реквизиты') };
            setOrgSettingsSaving(true);
            try {
                const res = await fetch(`/api/org/${encodeURIComponent(org)}/settings`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values),
                });
                const data = await res.json();
                if (!res.ok || data?.error) {
                    return {
                        ok: false,
                        error: data?.error || t('org.settings.error.save', 'Не удалось сохранить реквизиты'),
                    };
                }
                if (data?.settings) {
                    setOrgSettingsData({ ...defaultOrgSettings, ...data.settings });
                }
                return { ok: true };
            } finally {
                setOrgSettingsSaving(false);
            }
        },
        [org, t]
    );

    return {
        orgSettingsOpen,
        orgSettingsData,
        orgSettingsLoading,
        orgSettingsError,
        orgSettingsSaving,
        setOrgSettingsOpen,
        fetchOrgSettings,
        saveOrgSettings,
    };
}
