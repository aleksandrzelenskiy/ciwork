import type { OrgRole } from '@/types/org';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_DURATION_DAYS = 10;

export function roleLabel(role: OrgRole) {
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

export function integrationTypeLabel(value: string) {
    switch (value) {
        case 'google_sheets':
            return 'Google Sheets';
        case 'telegram':
            return 'Telegram';
        case 'erp_1c':
            return '1C ERP';
        case 'n8n_webhook':
            return 'Webhook';
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
