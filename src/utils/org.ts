import type { OrgRole } from '@/types/org';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_DURATION_DAYS = 10;

type TranslateFn = (key: string, fallback?: string, params?: Record<string, string | number>) => string;

export function roleLabel(role: OrgRole, t?: TranslateFn) {
    if (t) {
        switch (role) {
            case 'owner':
                return t('org.roles.owner', 'Владелец');
            case 'org_admin':
                return t('org.roles.admin', 'Администратор');
            case 'manager':
                return t('org.roles.manager', 'Менеджер');
            case 'executor':
                return t('org.roles.executor', 'Исполнитель');
            case 'viewer':
                return t('org.roles.viewer', 'Наблюдатель');
            default:
                return role;
        }
    }
    switch (role) {
        case 'owner':
            return 'Owner';
        case 'org_admin':
            return 'Admin';
        case 'manager':
            return 'Manager';
        case 'executor':
            return 'Executor';
        case 'viewer':
            return 'Viewer';
        default:
            return role;
    }
}

export function integrationTypeLabel(value: string, t?: TranslateFn) {
    switch (value) {
        case 'google_sheets':
            return t ? t('org.integrations.type.googleSheets', 'Google Sheets') : 'Google Sheets';
        case 'telegram':
            return t ? t('org.integrations.type.telegram', 'Telegram') : 'Telegram';
        case 'erp_1c':
            return t ? t('org.integrations.type.erp', '1C ERP') : '1C ERP';
        default:
            return value;
    }
}

export function normalizeBaseUrl(url: string | undefined | null) {
    if (!url) return '';
    return url.replace(/\/+$/, '');
}

// Универсальная склейка URL, когда base может быть невалидным.
export function makeAbsoluteUrl(base: string, path: string) {
    try {
        return new URL(path, base).toString();
    } catch {
        const cleanBase = normalizeBaseUrl(base);
        const cleanPath = path.replace(/^\/+/, '');
        return `${cleanBase}/${cleanPath}`;
    }
}
